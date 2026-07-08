/*
 * Read-only access to the two Google Sheets tabs that back the mockup:
 *  - Keyword_Effect: a matrix, rows keyed by keyword, columns keyed by effect
 *    name, cells hold comma-separated concept codes (ids into LD_Concept).
 *  - LD_Concept: one row per concept, keyed by `id`.
 *
 * Fetched via opensheet.elk.sh (a thin JSON proxy over the Sheets API) since
 * the client edits these sheets directly — no write-back, no auth needed.
 */
window.KnoweiSheets = (function () {
  const SHEET_ID = '1whJwRawdK0MtBFvpDUZMIRzUB-HoRgEH_dxv5BXszZs';
  const TAB_KEYWORD_EFFECT = 'Keyword_Effect';
  const TAB_LD_CONCEPT = 'LD_Concept';

  const CONCEPT_FIELDS = [
    'id',
    'name',
    'description',
    'box_name',
    'box_url',
    'advice',
    'inhouse_klant',
    'futures',
    'knowei_modules',
  ];

  function sheetUrl(tabName) {
    return `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(tabName)}`;
  }

  async function fetchTab(tabName) {
    const res = await fetch(sheetUrl(tabName));
    if (!res.ok) throw new Error(`Kon tabblad "${tabName}" niet ophalen (HTTP ${res.status})`);
    return res.json();
  }

  // The Keyword_Effect sheet's first column header is blank (it's the row's
  // keyword), so opensheet keys it as "". Read positionally instead of by
  // name so this keeps working if the client ever labels that header cell.
  // The "description" column (shown when a hub bubble is clicked) is pulled
  // out separately — everything else is treated as an effect column.
  function normalizeKeywordEffectRow(raw) {
    const keys = Object.keys(raw);
    const keywordKey = keys[0];
    const keyword = (raw[keywordKey] || '').trim();
    const description = (raw.description || '').trim();
    const effects = {};
    keys.slice(1).forEach((key) => {
      if (key.trim().toLowerCase() === 'description') return;
      effects[key.trim()] = (raw[key] || '').trim();
    });
    return { keyword, description, effects };
  }

  // The client's sheet can end up with more than one row for the same
  // keyword (e.g. pasted in while editing). Merge them instead of silently
  // keeping only the first match — union the codes per effect column so no
  // links get dropped.
  function mergeKeywordEffectRows(rows) {
    const merged = new Map(); // keyword (lowercase) -> { keyword, description, effects }
    rows.forEach((row) => {
      const key = row.keyword.toLowerCase();
      if (!key) return;
      if (!merged.has(key)) {
        merged.set(key, { keyword: row.keyword, description: row.description, effects: { ...row.effects } });
        return;
      }
      const existing = merged.get(key);
      if (!existing.description && row.description) existing.description = row.description;
      Object.keys(row.effects).forEach((effectName) => {
        const value = row.effects[effectName];
        if (!value) return;
        existing.effects[effectName] = existing.effects[effectName]
          ? `${existing.effects[effectName]},${value}`
          : value;
      });
    });
    return Array.from(merged.values());
  }

  function normalizeConcept(raw) {
    const concept = {};
    CONCEPT_FIELDS.forEach((field) => {
      concept[field] = (raw[field] || '').trim();
    });
    return concept;
  }

  async function fetchKeywordEffectRows() {
    const raw = await fetchTab(TAB_KEYWORD_EFFECT);
    return mergeKeywordEffectRows(raw.map(normalizeKeywordEffectRow));
  }

  async function fetchConcepts() {
    const raw = await fetchTab(TAB_LD_CONCEPT);
    return raw.map(normalizeConcept);
  }

  function buildConceptMap(concepts) {
    const map = new Map();
    concepts.forEach((concept) => {
      if (concept.id) map.set(concept.id.toLowerCase(), concept);
    });
    return map;
  }

  function findKeywordEffectRow(keywordEffectRows, keyword) {
    const target = (keyword || '').trim().toLowerCase();
    if (!target) return null;
    return keywordEffectRows.find((row) => row.keyword.toLowerCase() === target) || null;
  }

  function getEffectCodes(row, effectName) {
    const target = (effectName || '').trim().toLowerCase();
    if (!row || !target) return '';
    const matchKey = Object.keys(row.effects).find((key) => key.toLowerCase() === target);
    return matchKey ? row.effects[matchKey] : '';
  }

  // Splits a "codes" cell (e.g. "3,4,5") into resolved LD_Concept objects.
  // Empty cells resolve to []; codes with no matching concept are skipped
  // with a console warning instead of throwing.
  function resolveCodesToConcepts(codesStr, conceptMap) {
    if (!codesStr || !codesStr.trim()) return [];
    const codes = codesStr
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    const concepts = [];
    codes.forEach((code) => {
      const concept = conceptMap.get(code.toLowerCase());
      if (!concept) {
        console.warn(`[KnoweiSheets] Code "${code}" komt niet voor in LD_Concept — overgeslagen.`);
        return;
      }
      concepts.push(concept);
    });
    return concepts;
  }

  // For one devtool row ({ ervaren, doen, effect }), looks up both the
  // "ervaren" and "doen" values as candidate keywords against Keyword_Effect,
  // reads the codes under the row's effect column, and resolves each to a
  // concept. Returns a flat array (may contain duplicates across rows).
  function resolveConceptsForKeywordRow(devtoolRow, keywordEffectRows, conceptMap) {
    const candidates = [devtoolRow.ervaren, devtoolRow.doen].map((v) => (v || '').trim()).filter(Boolean);

    const concepts = [];
    candidates.forEach((keyword) => {
      const row = findKeywordEffectRow(keywordEffectRows, keyword);
      if (!row) return; // no Keyword_Effect entry for this keyword yet — not an error
      const codesStr = getEffectCodes(row, devtoolRow.effect);
      concepts.push(...resolveCodesToConcepts(codesStr, conceptMap));
    });
    return concepts;
  }

  // Runs resolveConceptsForKeywordRow across every devtool row and dedupes
  // the result by concept id.
  function resolveAllConcepts(devtoolRows, keywordEffectRows, conceptMap) {
    const seen = new Set();
    const result = [];
    devtoolRows.forEach((devtoolRow) => {
      resolveConceptsForKeywordRow(devtoolRow, keywordEffectRows, conceptMap).forEach((concept) => {
        if (seen.has(concept.id)) return;
        seen.add(concept.id);
        result.push(concept);
      });
    });
    return result;
  }

  // Groups resolved concepts by the matched Keyword_Effect keyword ("hub"),
  // for the connections diagram: one hub bubble per matched keyword, fanning
  // out to its concept leaves (zero, one, or many — never assume 1:1).
  function resolveHubs(devtoolRows, keywordEffectRows, conceptMap) {
    const hubs = new Map(); // keyword (lowercase) -> { keyword, description, concepts, seenIds }

    devtoolRows.forEach((devtoolRow) => {
      [devtoolRow.ervaren, devtoolRow.doen]
        .map((v) => (v || '').trim())
        .filter(Boolean)
        .forEach((keyword) => {
          const row = findKeywordEffectRow(keywordEffectRows, keyword);
          if (!row) return;
          const concepts = resolveCodesToConcepts(getEffectCodes(row, devtoolRow.effect), conceptMap);
          if (!concepts.length) return;

          const key = row.keyword.toLowerCase();
          if (!hubs.has(key)) {
            hubs.set(key, { keyword: row.keyword, description: row.description, concepts: [], seenIds: new Set() });
          }
          const hub = hubs.get(key);
          concepts.forEach((concept) => {
            if (hub.seenIds.has(concept.id)) return;
            hub.seenIds.add(concept.id);
            hub.concepts.push(concept);
          });
        });
    });

    return Array.from(hubs.values()).map(({ keyword, description, concepts }) => ({ keyword, description, concepts }));
  }

  // Display helpers — capitalize the first letter for presentation (sheet
  // data is often all-lowercase) and truncate long labels so they fit inside
  // the small round bubbles in the diagram.
  function capitalize(str) {
    const trimmed = (str || '').trim();
    if (!trimmed) return trimmed;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  function truncate(str, maxLen) {
    const trimmed = (str || '').trim();
    if (trimmed.length <= maxLen) return trimmed;
    return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
  }

  let cache = null;
  function loadAll() {
    if (cache) return cache;
    cache = Promise.all([fetchKeywordEffectRows(), fetchConcepts()]).then(
      ([keywordEffectRows, concepts]) => ({
        keywordEffectRows,
        conceptMap: buildConceptMap(concepts),
      })
    );
    // Don't cache a failed fetch — let the next call retry.
    cache.catch(() => {
      cache = null;
    });
    return cache;
  }

  return {
    CONCEPT_FIELDS,
    fetchKeywordEffectRows,
    fetchConcepts,
    buildConceptMap,
    findKeywordEffectRow,
    getEffectCodes,
    resolveCodesToConcepts,
    resolveConceptsForKeywordRow,
    resolveAllConcepts,
    resolveHubs,
    capitalize,
    truncate,
    loadAll,
  };
})();
