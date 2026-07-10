/*
 * Screen 3 (Advies): the complexity banner, the "oorzaken" accordion (one
 * expandable item per L&D concept selected on stap 2), the toolbox-match
 * summary next to it, and the advice/custom-toolbox note below that summary.
 *
 * Public interface used by app.js:
 *  - init()                              grab DOM refs, called once on page load
 *  - render(conceptEntries, complexity)   builds the banner + accordion +
 *                                          toolbox summary for the concepts
 *                                          selected on stap 2 (see
 *                                          KnoweiConnections.getSelectedConceptEntries)
 *                                          and the stap-2 complexity pick —
 *                                          only does this once per visit;
 *                                          stays as-is on repeat "Volgende"
 *                                          clicks until reset() runs
 *  - reset()                              puts screen 3 back to its fresh
 *                                          -load state (so the next visit
 *                                          re-renders)
 */
window.KnoweiAdvice = (function () {
  let complexityBanner, complexityValue, complexityNote;
  let adviceLoading, adviceEmpty, adviceLayout;
  let oorzakenList, toolboxSummaryList, adviceNoteText, adviceNoteCta;
  let hasRendered = false;

  const KNOWEI_URL = 'https://knowei.nl';

  // Complexity labels for the four pictures on stap 2 — the modifier values
  // match `data-complexity` on `.complexity-option` and the
  // `.complexity-banner.complexity-*` accent classes below.
  const COMPLEXITY_LABELS = {
    eenvoudig: 'Eenvoudig',
    ingewikkeld: 'Ingewikkeld',
    complex: 'Complex',
    chaotisch: 'Chaotisch',
  };

  function splitModules(value) {
    return (value || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  // One collapsed row per selected concept: just the oorzaak name and an
  // expand toggle on the right. Expanded, it reveals the uitleg plus two
  // distinguishable tag groups (keywords vs. bestaande modules) and the
  // knowei.nl link. Native <details>/<summary> so expand/collapse needs no
  // extra JS and stays keyboard-accessible.
  function buildOorzaakItem({ concept, keywords }) {
    const details = document.createElement('details');
    details.className = 'oorzaak-item';

    const summary = document.createElement('summary');
    summary.className = 'oorzaak-summary';
    const name = document.createElement('span');
    name.className = 'oorzaak-name';
    name.textContent = window.KnoweiSheets.capitalize(concept.name || concept.id);
    summary.appendChild(name);
    const toggle = document.createElement('span');
    toggle.className = 'oorzaak-toggle';
    toggle.setAttribute('aria-hidden', 'true');
    summary.appendChild(toggle);
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'oorzaak-body';

    const uitleg = document.createElement('p');
    uitleg.className = 'oorzaak-uitleg';
    uitleg.textContent = concept.description ? window.KnoweiSheets.capitalize(concept.description) : 'Geen uitleg beschikbaar.';
    body.appendChild(uitleg);

    const keywordGroup = document.createElement('div');
    keywordGroup.className = 'oorzaak-tags-group';
    const keywordTitle = document.createElement('p');
    keywordTitle.className = 'oorzaak-tags-title';
    keywordTitle.textContent = 'Keywords';
    keywordGroup.appendChild(keywordTitle);
    const keywordTags = document.createElement('div');
    keywordTags.className = 'oorzaak-tags';
    keywords.forEach((keyword) => {
      const tag = document.createElement('span');
      tag.className = 'advice-tag advice-tag-keyword';
      tag.textContent = window.KnoweiSheets.capitalize(keyword);
      keywordTags.appendChild(tag);
    });
    keywordGroup.appendChild(keywordTags);
    body.appendChild(keywordGroup);

    const modules = splitModules(concept['bestaande_module (Opleiding)']);
    if (modules.length) {
      const moduleGroup = document.createElement('div');
      moduleGroup.className = 'oorzaak-tags-group';
      const moduleTitle = document.createElement('p');
      moduleTitle.className = 'oorzaak-tags-title';
      moduleTitle.textContent = 'Bestaande modules';
      moduleGroup.appendChild(moduleTitle);
      const moduleTags = document.createElement('div');
      moduleTags.className = 'oorzaak-tags';
      modules.forEach((module) => {
        const tag = document.createElement('span');
        tag.className = 'advice-tag advice-tag-module';
        tag.textContent = module;
        moduleTags.appendChild(tag);
      });
      moduleGroup.appendChild(moduleTags);
      body.appendChild(moduleGroup);
    }

    const footer = document.createElement('div');
    footer.className = 'oorzaak-footer';
    const cta = document.createElement('a');
    cta.className = 'advice-row-cta';
    cta.href = KNOWEI_URL;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.title = 'Naar Knowei.nl';
    cta.textContent = 'Zie modules →';
    footer.appendChild(cta);
    body.appendChild(footer);

    details.appendChild(body);
    return details;
  }

  // A concept's own "match strength" — the average of its toolbox percentage
  // columns (blanks excluded). Used both for the toolbox summary and to pick
  // which concept's advice text is featured under it.
  function ownAverage(concept) {
    const values = window.KnoweiSheets.getToolboxFields()
      .map((f) => window.KnoweiSheets.parsePercent(concept[f]))
      .filter((v) => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  function pickTopConcept(concepts) {
    let best = null;
    let bestAvg = -1;
    concepts.forEach((concept) => {
      const avg = ownAverage(concept);
      if (avg !== null && avg > bestAvg) {
        bestAvg = avg;
        best = concept;
      }
    });
    return best || concepts[0] || null;
  }

  // Averages every toolbox percentage column across the selected concepts —
  // blank cells (not yet filled in on the sheet) are excluded from that
  // toolbox's average rather than counted as 0%. Toolboxes with no data at
  // all across the selected concepts are left out of the summary entirely.
  // Sorted highest match first, same as the reference layout.
  function buildToolboxAverages(concepts) {
    return window.KnoweiSheets.getToolboxFields()
      .map((field) => {
        const values = concepts.map((c) => window.KnoweiSheets.parsePercent(c[field])).filter((v) => v !== null);
        if (!values.length) return null;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { field, avg };
      })
      .filter(Boolean)
      .sort((a, b) => b.avg - a.avg);
  }

  // toolboxUrls: the toolbox_url sheet, keyed lowercase — see
  // KnoweiSheets.fetchToolboxUrls(). Falls back to the generic Knowei link
  // for any toolbox column that doesn't have a row there yet.
  function buildToolboxRow({ field, avg }, toolboxUrls) {
    const row = document.createElement('a');
    row.className = 'toolbox-row';
    row.href = toolboxUrls.get(field.trim().toLowerCase()) || KNOWEI_URL;
    row.target = '_blank';
    row.rel = 'noopener';

    const pct = document.createElement('span');
    pct.className = 'toolbox-row-pct';
    pct.textContent = `${Math.round(avg)}%`;
    row.appendChild(pct);

    const label = document.createElement('span');
    label.className = 'toolbox-row-label';
    label.textContent = window.KnoweiSheets.capitalize(field);
    row.appendChild(label);

    const arrow = document.createElement('span');
    arrow.className = 'toolbox-row-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    row.appendChild(arrow);

    return row;
  }

  async function render(conceptEntries, selectedComplexity) {
    if (hasRendered) return;
    hasRendered = true;

    adviceLoading.hidden = false;
    adviceEmpty.hidden = true;
    adviceLayout.hidden = true;
    oorzakenList.innerHTML = '';
    toolboxSummaryList.innerHTML = '';
    complexityBanner.hidden = true;
    complexityBanner.className = 'complexity-banner';

    // The concept entries themselves are already resolved by connections.js;
    // this only needs loadAll() (cached, so effectively free here) for the
    // toolbox_url links. The delay below is purely for the "AI is working" feel.
    const [{ toolboxUrls }] = await Promise.all([
      window.KnoweiSheets.loadAll(),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
    adviceLoading.hidden = true;

    if (!conceptEntries.length) {
      adviceEmpty.textContent =
        'Nog geen advies beschikbaar — ga terug naar stap 2 en selecteer minimaal één concept.';
      adviceEmpty.hidden = false;
      return;
    }

    if (selectedComplexity) {
      complexityBanner.classList.add(`complexity-${selectedComplexity}`);
      complexityValue.textContent = COMPLEXITY_LABELS[selectedComplexity];
      complexityNote.textContent = 'Gekozen op stap 2, op basis van het verbandenpatroon dat het beste bij jouw verbanden paste.';
      complexityBanner.hidden = false;
    }

    conceptEntries.forEach((entry) => oorzakenList.appendChild(buildOorzaakItem(entry)));

    const concepts = conceptEntries.map((e) => e.concept);

    const averages = buildToolboxAverages(concepts);
    if (averages.length) {
      averages.forEach((avg) => toolboxSummaryList.appendChild(buildToolboxRow(avg, toolboxUrls)));
    } else {
      const empty = document.createElement('p');
      empty.className = 'toolbox-summary-empty';
      empty.textContent = 'Nog geen toolbox-percentages beschikbaar voor deze concepten.';
      toolboxSummaryList.appendChild(empty);
    }

    const topConcept = pickTopConcept(concepts);
    adviceNoteText.textContent =
      topConcept && topConcept.advice
        ? window.KnoweiSheets.capitalize(topConcept.advice)
        : 'Gebruik de bestaande modules hierboven voor een bewezen aanpak, of kies hiernaast de toolbox die het beste aansluit op jouw situatie.';
    adviceNoteCta.href = KNOWEI_URL;

    adviceLayout.hidden = false;
  }

  function reset() {
    hasRendered = false;
  }

  function init() {
    complexityBanner = document.getElementById('complexity-banner');
    complexityValue = document.getElementById('complexity-value');
    complexityNote = document.getElementById('complexity-note');
    adviceLoading = document.getElementById('advice-loading');
    adviceEmpty = document.getElementById('advice-empty');
    adviceLayout = document.getElementById('advice-layout');
    oorzakenList = document.getElementById('oorzaken-list');
    toolboxSummaryList = document.getElementById('toolbox-summary-list');
    adviceNoteText = document.getElementById('advice-note-text');
    adviceNoteCta = document.getElementById('advice-note-cta');
  }

  return {
    init,
    render,
    reset,
  };
})();
