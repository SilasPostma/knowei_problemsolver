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
  function normalizeKeywordEffectRow(raw) {
    const keys = Object.keys(raw);
    const keywordKey = keys[0];
    const keyword = (raw[keywordKey] || '').trim();
    const effects = {};
    keys.slice(1).forEach((key) => {
      effects[key.trim()] = (raw[key] || '').trim();
    });
    return { keyword, effects };
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
    return raw.map(normalizeKeywordEffectRow);
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
    loadAll,
  };
})();
