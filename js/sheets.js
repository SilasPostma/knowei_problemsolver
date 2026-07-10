/*
 * Read-only access to the three Google Sheets tabs that back the mockup:
 *  - Keyword_Effect: a matrix, rows keyed by keyword, columns keyed by effect
 *    name, cells hold comma-separated concept codes (ids into LD_concept_v2).
 *  - LD_concept_v2: one row per concept, keyed by `id`. Columns from
 *    "advice" onward are treated as toolbox match-percentages — see
 *    fetchConcepts()/getToolboxFields() — so the client can add a toolbox
 *    column later with no code change.
 *  - toolbox_url: { toolbox, url } — order-page link per toolbox column
 *    name, joined case-insensitively against LD_concept_v2's toolbox columns.
 *
 * Fetched via opensheet.elk.sh (a thin JSON proxy over the Sheets API) since
 * the client edits these sheets directly — no write-back, no auth needed.
 */
window.KnoweiSheets = (function () {
  const SHEET_ID = '1whJwRawdK0MtBFvpDUZMIRzUB-HoRgEH_dxv5BXszZs';
  const TAB_KEYWORD_EFFECT = 'Keyword_Effect';
  const TAB_LD_CONCEPT = 'LD_concept_v2';
  const TAB_TOOLBOX_URL = 'toolbox_url';

  // LD_concept_v2's columns aren't hardcoded — they're read straight off
  // whatever the sheet returns (fetchConcepts fills these in), so the client
  // can add a new toolbox column any time without a code change. The
  // convention: every column after "advice" is a toolbox match-percentage.
  let CONCEPT_FIELDS = [];
  let TOOLBOX_FIELDS = [];

  // Sheet cells are strings like "90%" or "" (not yet filled in). Returns
  // null for blank/unparseable cells so callers can exclude them from an
  // average instead of treating "not assessed" as 0%.
  function parsePercent(value) {
    if (!value) return null;
    const match = String(value).trim().match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  }

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

  function normalizeConcept(raw, fields) {
    const concept = {};
    fields.forEach((field) => {
      concept[field] = (raw[field] || '').trim();
    });
    return concept;
  }

  async function fetchKeywordEffectRows() {
    const raw = await fetchTab(TAB_KEYWORD_EFFECT);
    return mergeKeywordEffectRows(raw.map(normalizeKeywordEffectRow));
  }

  // Derives CONCEPT_FIELDS/TOOLBOX_FIELDS from the sheet's own column order
  // on every fetch, so a client edit (renaming, reordering, or adding a
  // toolbox column) is picked up automatically — see the comment above the
  // `let` declarations.
  async function fetchConcepts() {
    const raw = await fetchTab(TAB_LD_CONCEPT);
    const fields = raw.length ? Object.keys(raw[0]) : [];
    const adviceIndex = fields.findIndex((f) => f.trim().toLowerCase() === 'advice');
    CONCEPT_FIELDS = fields;
    TOOLBOX_FIELDS = adviceIndex === -1 ? [] : fields.slice(adviceIndex + 1);
    return raw.map((row) => normalizeConcept(row, fields));
  }

  // toolbox_url: { toolbox, url } rows mapping a toolbox column name (as it
  // appears in LD_concept_v2) to its order-page link. Matched case
  // -insensitively since the two sheets don't always agree on capitalization.
  async function fetchToolboxUrls() {
    const raw = await fetchTab(TAB_TOOLBOX_URL);
    const map = new Map();
    raw.forEach((row) => {
      const name = (row.toolbox || '').trim().toLowerCase();
      const url = (row.url || '').trim();
      if (name && url) map.set(name, url);
    });
    return map;
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

  // Same hub -> concept data as resolveHubs, reshaped so each unique concept
  // (deduped by id) carries every hub keyword that led to it — used both by
  // the connections diagram's selection tracking and by stap 3's table/
  // toolbox summary.
  function getConceptsWithKeywords(hubs) {
    const map = new Map();
    hubs.forEach((hub) => {
      hub.concepts.forEach((concept) => {
        if (!map.has(concept.id)) map.set(concept.id, { concept, keywords: [] });
        map.get(concept.id).keywords.push(hub.keyword);
      });
    });
    return Array.from(map.values());
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
    cache = Promise.all([fetchKeywordEffectRows(), fetchConcepts(), fetchToolboxUrls()]).then(
      ([keywordEffectRows, concepts, toolboxUrls]) => ({
        keywordEffectRows,
        conceptMap: buildConceptMap(concepts),
        toolboxUrls,
      })
    );
    // Don't cache a failed fetch — let the next call retry.
    cache.catch(() => {
      cache = null;
    });
    return cache;
  }

  return {
    // Functions, not static properties — CONCEPT_FIELDS/TOOLBOX_FIELDS are
    // only known once fetchConcepts() (via loadAll()) has resolved at least
    // once, so callers must read them after awaiting loadAll(), not before.
    getConceptFields: () => CONCEPT_FIELDS,
    getToolboxFields: () => TOOLBOX_FIELDS,
    parsePercent,
    fetchKeywordEffectRows,
    fetchConcepts,
    fetchToolboxUrls,
    buildConceptMap,
    findKeywordEffectRow,
    getEffectCodes,
    resolveCodesToConcepts,
    resolveConceptsForKeywordRow,
    resolveAllConcepts,
    resolveHubs,
    getConceptsWithKeywords,
    capitalize,
    truncate,
    loadAll,
  };
})();
