/*
 * Screen 3 (Advies): the complexity banner and the grouped advice/toolbox
 * cards built from the resolved L&D concepts.
 *
 * Public interface used by app.js:
 *  - init()                              grab DOM refs, called once on page load
 *  - render(devtoolRows, complexity)      (re)builds the banner + advice cards
 *                                          for the current stap-1 keyword rows
 *                                          and the stap-2 complexity pick
 */
window.KnoweiAdvice = (function () {
  let complexityBanner, complexityValue, complexityNote;
  let adviceLoading, adviceEmpty, adviceList;

  // knowei_modules is intentionally left out — only these two feed the
  // "Kijk bijvoorbeeld naar" subline under each concept.
  const ALTERNATIVE_FIELDS = ['inhouse_klant', 'futures'];
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

  // Same hub→concept data as the diagram, reshaped so each unique concept
  // carries every keyword that led to it (a shared concept lists more than
  // one) — what the advice cards need to show "why this was surfaced".
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

  // Groups concepts by their toolbox (box_name) — one card per box, listing
  // every concept that recommends it, instead of one card per concept
  // repeating the same box. Concepts with no box_name yet (client still
  // filling in the sheet) each get their own fallback group.
  function getBoxesWithConcepts(hubs) {
    const boxes = new Map();
    getConceptsWithKeywords(hubs).forEach((entry) => {
      const key = entry.concept.box_name || entry.concept.box_url || `concept-${entry.concept.id}`;
      if (!boxes.has(key)) {
        boxes.set(key, { boxName: entry.concept.box_name, boxUrl: entry.concept.box_url, entries: [] });
      }
      boxes.get(key).entries.push(entry);
    });
    return Array.from(boxes.values());
  }

  // One row per concept: name + its keyword tag(s) on the same line
  // (tags right-aligned), plus an optional subline linking out to the two
  // toolbox alternatives (inhouse-training / toekomstmodule) that mention
  // it — knowei_modules is left out on purpose, that column isn't shown here.
  function buildConceptItem({ concept, keywords }) {
    const item = document.createElement('div');
    item.className = 'advice-concept-item';

    const line = document.createElement('div');
    line.className = 'advice-concept-line';

    const name = document.createElement('span');
    name.className = 'advice-concept-name';
    name.textContent = window.KnoweiSheets.capitalize(concept.name || concept.id);
    line.appendChild(name);

    const tags = document.createElement('span');
    tags.className = 'advice-concept-tags';
    keywords.forEach((keyword) => {
      const tag = document.createElement('span');
      tag.className = 'advice-tag';
      tag.textContent = window.KnoweiSheets.capitalize(keyword);
      tags.appendChild(tag);
    });
    line.appendChild(tags);

    item.appendChild(line);

    const alternatives = ALTERNATIVE_FIELDS.map((field) => concept[field]).filter(Boolean);
    if (alternatives.length) {
      const sub = document.createElement('p');
      sub.className = 'advice-concept-sub';
      sub.append('Kijk bijvoorbeeld naar: ');
      alternatives.forEach((value, i) => {
        if (i > 0) sub.append(' en ');
        const link = document.createElement('a');
        link.href = KNOWEI_URL;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = window.KnoweiSheets.capitalize(value);
        sub.appendChild(link);
      });
      sub.append('.');
      item.appendChild(sub);
    }

    return item;
  }

  // One card per toolbox mentioned in the keywords — lists every concept
  // that points to it, then that box's order link, so the "these concepts
  // are also covered together in X" pitch sits right under the concepts it
  // refers to. Concepts with no box_name yet still get a card (each on its
  // own, via the fallback grouping in getBoxesWithConcepts) but without the
  // footer, since there's no toolbox to link to.
  function buildAdviceCard(box) {
    const card = document.createElement('article');
    card.className = 'advice-card';
    if (box.boxName) card.classList.add('has-box');

    const group = document.createElement('div');
    group.className = 'advice-concept-group';
    box.entries.forEach((entry) => group.appendChild(buildConceptItem(entry)));
    card.appendChild(group);

    if (box.boxName) {
      const footer = document.createElement('div');
      footer.className = 'advice-card-footer';

      const heading = document.createElement('p');
      heading.className = 'advice-box-heading';
      heading.textContent = 'Deze concepten worden ook gezamenlijk behandeld in:';
      footer.appendChild(heading);

      const firstConcept = box.entries[0].concept;
      const adviceText = document.createElement('p');
      adviceText.className = 'advice-box-text';
      adviceText.textContent = firstConcept.advice
        ? window.KnoweiSheets.capitalize(firstConcept.advice)
        : 'Geen adviestekst beschikbaar.';
      footer.appendChild(adviceText);

      const cta = document.createElement('a');
      cta.className = 'btn btn-primary advice-box-cta';
      cta.href = box.boxUrl || KNOWEI_URL;
      cta.target = '_blank';
      cta.rel = 'noopener';
      cta.textContent = window.KnoweiSheets.capitalize(box.boxName);
      footer.appendChild(cta);

      card.appendChild(footer);
    }

    return card;
  }

  // Shown once, after every box block — not tied to any single box, so it
  // just points at knowei.nl for now instead of a real order flow.
  function buildCustomToolboxBlock() {
    const block = document.createElement('div');
    block.className = 'advice-custom-toolbox';

    const heading = document.createElement('p');
    heading.className = 'advice-custom-heading';
    heading.textContent = 'Wil je een toolbox op maat?';
    block.appendChild(heading);

    const cta = document.createElement('a');
    cta.className = 'btn btn-primary advice-custom-cta';
    cta.href = KNOWEI_URL;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.textContent = 'Neem contact op';
    block.appendChild(cta);

    return block;
  }

  async function render(devtoolRows, selectedComplexity) {
    adviceLoading.hidden = false;
    adviceEmpty.hidden = true;
    adviceList.hidden = true;
    adviceList.innerHTML = '';
    complexityBanner.hidden = true;
    complexityBanner.className = 'complexity-banner';

    try {
      const { keywordEffectRows, conceptMap } = await window.KnoweiSheets.loadAll();
      const hubs = window.KnoweiSheets.resolveHubs(devtoolRows, keywordEffectRows, conceptMap);

      await new Promise((resolve) => setTimeout(resolve, 800));
      adviceLoading.hidden = true;

      if (!hubs.length) {
        adviceEmpty.textContent =
          'Nog geen advies beschikbaar — ga terug naar stap 1 en vul keywords in die matchen met de Keyword_Effect sheet.';
        adviceEmpty.hidden = false;
        return;
      }

      if (selectedComplexity) {
        complexityBanner.classList.add(`complexity-${selectedComplexity}`);
        complexityValue.textContent = COMPLEXITY_LABELS[selectedComplexity];
        complexityNote.textContent = 'Gekozen op stap 2, op basis van het verbandenpatroon dat het beste bij jouw verbanden paste.';
        complexityBanner.hidden = false;
      }

      const sectionTitle = document.createElement('h2');
      sectionTitle.className = 'advice-section-title';
      sectionTitle.textContent = 'L&D Concepten';
      adviceList.appendChild(sectionTitle);

      // One card per toolbox — if the keywords point to more than one box,
      // this naturally repeats: each box gets its own card with its own
      // concept list, advice and order link.
      getBoxesWithConcepts(hubs).forEach((box) => {
        adviceList.appendChild(buildAdviceCard(box));
      });

      adviceList.appendChild(buildCustomToolboxBlock());
      adviceList.hidden = false;
    } catch (err) {
      console.error('[KnoweiSheets] Kon advies niet opbouwen:', err);
      adviceEmpty.textContent = 'Fout bij laden van Google Sheets data (zie console).';
      adviceEmpty.hidden = false;
    }
  }

  function init() {
    complexityBanner = document.getElementById('complexity-banner');
    complexityValue = document.getElementById('complexity-value');
    complexityNote = document.getElementById('complexity-note');
    adviceLoading = document.getElementById('advice-loading');
    adviceEmpty = document.getElementById('advice-empty');
    adviceList = document.getElementById('advice-list');
  }

  return {
    init,
    render,
  };
})();
