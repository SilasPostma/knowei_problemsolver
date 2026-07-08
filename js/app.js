(function () {
  const screens = document.querySelectorAll('.screen');
  const stepEls = document.querySelectorAll('.step');

  function showScreen(step) {
    screens.forEach((el) => el.classList.toggle('is-active', el.id === `screen-${step}`));
    stepEls.forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle('is-active', n === step);
      el.classList.toggle('is-done', n < step);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (step === 2) {
      renderConceptsDebugTable();
      renderConnectionsDiagram();
    } else if (step === 3) {
      renderAdviceScreen();
    }
  }

  document.querySelectorAll('[data-next]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(Number(btn.dataset.next)));
  });
  document.querySelectorAll('[data-prev]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(Number(btn.dataset.prev)));
  });
  document.querySelectorAll('.step').forEach((el) => {
    el.addEventListener('click', () => showScreen(Number(el.dataset.step)));
    el.style.cursor = 'pointer';
  });

  document.getElementById('restart').addEventListener('click', () => {
    resetApp();
    showScreen(1);
  });

  // ---------- Kaart dropdown (mock options replacing image upload) ----------
  const KAART_OPTIONS = [
    { id: '', label: '– Kies een voorbeeldkaart –', image: null },
    {
      id: 'knoop',
      label: 'We praten eindeloos, Niemand hakt de knoop door.',
      image: 'assets/images/knoop_doorhakken.png',
    }
  ];

  const kaartSelect = document.getElementById('kaart-select');
  const kaartPreview = document.getElementById('kaart-preview');
  const uploadNextBtn = document.getElementById('upload-next');

  // Gate stap 1's "Volgende" on all three inputs being done: a kaart chosen,
  // a photo uploaded, and the resulting description text generated (not
  // mid-edit). Safe to call any time after the elements above and `dropzone`
  // /`isTextSet` (declared further down) exist — every caller fires from an
  // event handler, i.e. after the whole script has finished its first pass.
  function updateUploadNextState() {
    uploadNextBtn.disabled = !(kaartSelect.value && dropzone.classList.contains('has-file') && isTextSet());
  }

  KAART_OPTIONS.forEach((opt) => {
    const el = document.createElement('option');
    el.value = opt.id;
    el.textContent = opt.label;
    kaartSelect.appendChild(el);
  });

  function renderKaartPreview() {
    const opt = KAART_OPTIONS.find((o) => o.id === kaartSelect.value);
    kaartPreview.innerHTML = '';
    if (!opt || !opt.id) return;

    if (opt.image) {
      const img = document.createElement('img');
      img.src = opt.image;
      img.alt = opt.label;
      img.className = 'kaart-preview-img';
      kaartPreview.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'kaart-preview-placeholder';
      placeholder.textContent = 'Geen voorbeeldafbeelding beschikbaar';
      kaartPreview.appendChild(placeholder);
    }
  }

  kaartSelect.addEventListener('change', () => {
    renderKaartPreview();
    updateUploadNextState();
  });
  renderKaartPreview();

  // ---------- Devtool: hidden keyword table ----------
  const toggleBtn = document.getElementById('toggle-keywords');
  const tableWrap = document.getElementById('keyword-table-wrap');
  toggleBtn.addEventListener('click', () => {
    const visible = tableWrap.classList.toggle('is-visible');
    toggleBtn.textContent = visible ? 'Devtool: verberg keyword tabel' : 'Devtool: toon keyword tabel';
  });

  const keywordTableBody = document.getElementById('keyword-table-body');
  const COLUMN_CLASSES = ['feiten', 'ervaren', 'doen', 'effect'];

  document.getElementById('add-row').addEventListener('click', () => {
    const row = document.createElement('tr');
    for (let i = 0; i < 4; i++) {
      const td = document.createElement('td');
      td.innerHTML = '<input type="text" placeholder="..." />';
      row.appendChild(td);
    }
    keywordTableBody.appendChild(row);
  });

  keywordTableBody.addEventListener('input', () => {
    if (isTextSet()) renderHighlightedText();
  });

  function getKeywordEntries() {
    const entries = [];
    keywordTableBody.querySelectorAll('tr').forEach((row) => {
      row.querySelectorAll('input').forEach((input, i) => {
        const val = input.value.trim();
        if (val) entries.push({ text: val, cls: COLUMN_CLASSES[i] });
      });
    });
    return entries;
  }

  // Same devtool table, but grouped per row instead of flattened — this is
  // what the Keyword_Effect/LD_Concept join needs (ervaren + doen + effect
  // per row, not just a flat keyword list).
  function getKeywordRows() {
    const rows = [];
    keywordTableBody.querySelectorAll('tr').forEach((row) => {
      const inputs = row.querySelectorAll('input');
      const values = COLUMN_CLASSES.reduce((acc, cls, i) => {
        acc[cls] = (inputs[i] ? inputs[i].value : '').trim();
        return acc;
      }, {});
      if (values.ervaren || values.doen) rows.push(values);
    });
    return rows;
  }

  // ---------- Devtool: hidden concepts debug table (Stage 2/3 join result) ----------
  const toggleConceptsBtn = document.getElementById('toggle-concepts-table');
  const conceptsTableWrap = document.getElementById('concepts-table-wrap');
  toggleConceptsBtn.addEventListener('click', () => {
    const visible = conceptsTableWrap.classList.toggle('is-visible');
    toggleConceptsBtn.textContent = visible
      ? 'Devtool: verberg gekoppelde data-tabel'
      : 'Devtool: toon gekoppelde data-tabel';
  });

  async function renderConceptsDebugTable() {
    const statusEl = document.getElementById('concepts-debug-status');
    const tbody = document.getElementById('concepts-table-body');
    statusEl.textContent = 'Data laden vanuit Google Sheets...';
    tbody.innerHTML = '';

    try {
      const { keywordEffectRows, conceptMap } = await window.KnoweiSheets.loadAll();
      const devtoolRows = getKeywordRows();
      const concepts = window.KnoweiSheets.resolveAllConcepts(devtoolRows, keywordEffectRows, conceptMap);

      statusEl.textContent = concepts.length
        ? `${concepts.length} gekoppelde L&D concept(en) gevonden voor de huidige keywords.`
        : 'Geen gekoppelde L&D concepten gevonden voor de huidige keywords.';

      concepts.forEach((concept) => {
        const tr = document.createElement('tr');
        window.KnoweiSheets.CONCEPT_FIELDS.forEach((field) => {
          const td = document.createElement('td');
          const content = document.createElement('div');
          content.className = 'concepts-cell-content';
          content.textContent = concept[field] || '';
          td.appendChild(content);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('[KnoweiSheets] Kon sheet-data niet laden:', err);
      statusEl.textContent = 'Fout bij laden van Google Sheets data (zie console).';
    }
  }

  // ---------- Connections diagram: hub (keyword) -> leaves (L&D concepts) ----------
  const connectionsWrap = document.getElementById('connections-canvas-wrap');
  const connectionsLoading = document.getElementById('connections-loading');
  const connectionsCanvas = document.getElementById('connections-canvas');
  const connectionsEmpty = document.getElementById('connections-empty');
  const conceptDetail = document.getElementById('concept-detail');

  // Small random offset applied to every placement angle, so the fan-out
  // doesn't look mechanically even. Safe to add freely because the overlap
  // relaxation pass below doesn't care how nodes got to their starting
  // position — it pushes apart whatever ends up too close regardless.
  const ANGLE_JITTER_DEG = 14;
  function angleJitter() {
    return (Math.random() - 0.5) * 2 * ANGLE_JITTER_DEG;
  }

  // Spreads `count` items across an arc centered on `centerDeg`, widening the
  // spread a bit as more items need to fit (still capped by `maxSpread`).
  function arcAngles(count, centerDeg, maxSpread) {
    if (count <= 0) return [];
    if (count === 1) return [centerDeg + angleJitter()];
    const spread = Math.min(maxSpread, 30 + count * 22);
    const start = centerDeg - spread / 2;
    const step = spread / (count - 1);
    return Array.from({ length: count }, (_, i) => start + i * step + angleJitter());
  }

  // angleDeg follows standard math convention (0 = right, 90 = up) but y is
  // negated to account for screen space growing downward.
  function polarOffset(angleDeg, radius) {
    const rad = (angleDeg * Math.PI) / 180;
    return { dx: radius * Math.cos(rad), dy: -radius * Math.sin(rad) };
  }

  // Circle diameters (kept in sync with the inline sizing in
  // renderConnectionsCanvas) and the minimum gap enforced between any two
  // circle edges.
  const NODE_RADIUS = { hub: 52, leaf: 42 };
  const NODE_GAP = 14;

  // Guarantees no two circles ever overlap, regardless of how the initial
  // arc math placed them: repeatedly finds any pair closer than the sum of
  // their radii (+ gap) and pushes them apart along the line between their
  // centers, until nothing overlaps or the iteration budget runs out. Hub
  // positions are marked `fixed` so they anchor the layout; only leaves move.
  // This is what makes it safe to later add random angle jitter — relaxation
  // absorbs the randomness without ever letting circles touch.
  function resolveOverlaps(nodes, width, height) {
    const margin = 4;
    const pairs = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) pairs.push([i, j]);
    }

    for (let iter = 0; iter < 800; iter++) {
      let moved = false;
      // Processing pairs in the same fixed order every iteration can settle
      // into a stable back-and-forth cycle (A pushes B, B's next correction
      // re-pushes A by the same amount) that never fully closes a residual
      // gap. Shuffling the order each pass breaks that symmetry.
      for (let k = pairs.length - 1; k > 0; k--) {
        const swap = Math.floor(Math.random() * (k + 1));
        [pairs[k], pairs[swap]] = [pairs[swap], pairs[k]];
      }
      for (const [i, j] of pairs) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.fixed && b.fixed) continue;

        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius + NODE_GAP;
        if (dist === 0) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        }
        if (dist < minDist) {
          // Split the correction between whichever side(s) can actually
          // move. If one side is fixed, the other must cover the full
          // deficit alone — splitting it evenly regardless (as if both
          // sides always move) leaves a permanent residual violation
          // whenever a hub is involved, since the fixed side never
          // contributes its half.
          const totalOverlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const aMovable = !a.fixed;
          const bMovable = !b.fixed;
          if (aMovable && bMovable) {
            const half = totalOverlap / 2;
            a.x += nx * half;
            a.y += ny * half;
            b.x -= nx * half;
            b.y -= ny * half;
          } else if (aMovable) {
            a.x += nx * totalOverlap;
            a.y += ny * totalOverlap;
          } else if (bMovable) {
            b.x -= nx * totalOverlap;
            b.y -= ny * totalOverlap;
          }
          moved = true;
        }
      }
      // Keep every (movable) node inside the canvas while relaxing.
      nodes.forEach((n) => {
        if (n.fixed) return;
        n.x = Math.min(width - n.radius - margin, Math.max(n.radius + margin, n.x));
        n.y = Math.min(height - n.radius - margin, Math.max(n.radius + margin, n.y));
      });
      if (!moved) break;
    }
  }

  // Concepts can be reached from more than one hub (a concept shared across
  // keywords) — those render as a single bubble positioned between their
  // hubs, with a connecting line to each, instead of duplicating the bubble
  // once per hub.
  function buildConnectionsLayout(hubs, containerWidth) {
    const height = 560;
    const hubY = height / 2;
    const minSpacing = 260;
    const width = Math.max(containerWidth, hubs.length * minSpacing + 100);
    const spacingX = width / (hubs.length + 1);
    const leafRadius = 150;
    // Shared concepts sit further out than regular per-hub leaves — with
    // evenly spaced hubs, a hub's own "straight up" leaf can otherwise land
    // close to a shared bubble's midpoint (same x, similar radius). The
    // overlap relaxation pass below is the real guarantee; this just gives
    // it a better starting point so relaxation has to do less work.
    const sharedRadius = leafRadius + 65;

    const hubPositions = hubs.map((hub, i) => ({ x: spacingX * (i + 1), y: hubY }));
    const nodes = hubs.map((hub, i) => ({
      type: 'hub',
      x: hubPositions[i].x,
      y: hubPositions[i].y,
      radius: NODE_RADIUS.hub,
      fixed: true,
      label: hub.keyword,
      hub,
    }));
    const links = []; // { fromIndex, toIndex } — resolved to line coords after relaxation

    const conceptEntries = new Map(); // concept id -> { concept, hubIndices }
    hubs.forEach((hub, hubIndex) => {
      hub.concepts.forEach((concept) => {
        if (!conceptEntries.has(concept.id)) {
          conceptEntries.set(concept.id, { concept, hubIndices: [] });
        }
        conceptEntries.get(concept.id).hubIndices.push(hubIndex);
      });
    });

    const perHub = new Map(); // hubIndex -> entries only connected to that one hub
    const shared = [];
    conceptEntries.forEach((entry) => {
      if (entry.hubIndices.length === 1) {
        const hubIndex = entry.hubIndices[0];
        if (!perHub.has(hubIndex)) perHub.set(hubIndex, []);
        perHub.get(hubIndex).push(entry);
      } else {
        shared.push(entry);
      }
    });

    perHub.forEach((entries, hubIndex) => {
      const hubX = hubPositions[hubIndex].x;
      const aboveCount = Math.ceil(entries.length / 2);
      const belowCount = entries.length - aboveCount;
      const angles = [...arcAngles(aboveCount, 90, 150), ...arcAngles(belowCount, 270, 150)];

      entries.forEach((entry, i) => {
        const { dx, dy } = polarOffset(angles[i], leafRadius);
        const leafIndex = nodes.length;
        nodes.push({
          type: 'leaf',
          x: hubX + dx,
          y: hubY + dy,
          radius: NODE_RADIUS.leaf,
          fixed: false,
          label: entry.concept.name || entry.concept.id,
          concept: entry.concept,
        });
        links.push({ fromIndex: hubIndex, toIndex: leafIndex });
      });
    });

    // Shared concepts sit above the midpoint of the hubs they connect to.
    // Multiple shared concepts spread sideways (via angle, same as regular
    // leaves) rather than stacking vertically, so they can't drift back up
    // into the hub row above.
    shared.forEach((entry, i) => {
      const xs = entry.hubIndices.map((hubIndex) => hubPositions[hubIndex].x);
      const midX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const stackAngle = Math.ceil(i / 2) * 18 * (i % 2 === 0 ? 1 : -1);
      const { dx, dy } = polarOffset(90 + stackAngle + angleJitter(), sharedRadius);
      const leafIndex = nodes.length;
      nodes.push({
        type: 'leaf',
        x: midX + dx,
        y: hubY + dy,
        radius: NODE_RADIUS.leaf,
        fixed: false,
        label: entry.concept.name || entry.concept.id,
        concept: entry.concept,
      });
      entry.hubIndices.forEach((hubIndex) => {
        links.push({ fromIndex: hubIndex, toIndex: leafIndex });
      });
    });

    resolveOverlaps(nodes, width, height);

    const lines = links.map((link) => ({
      x1: nodes[link.fromIndex].x,
      y1: nodes[link.fromIndex].y,
      x2: nodes[link.toIndex].x,
      y2: nodes[link.toIndex].y,
    }));

    return { width, height, nodes, lines };
  }

  function renderConnectionsCanvas(hubs) {
    connectionsCanvas.innerHTML = '';
    connectionsCanvas.style.width = '';

    const { width, height, nodes, lines } = buildConnectionsLayout(hubs, connectionsCanvas.clientWidth || 900);
    connectionsCanvas.style.width = `${width}px`;
    connectionsCanvas.style.height = `${height}px`;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    lines.forEach((line) => {
      const el = document.createElementNS(svgNS, 'line');
      el.setAttribute('x1', line.x1);
      el.setAttribute('y1', line.y1);
      el.setAttribute('x2', line.x2);
      el.setAttribute('y2', line.y2);
      svg.appendChild(el);
    });
    connectionsCanvas.appendChild(svg);

    nodes.forEach((node, i) => {
      const el = document.createElement('div');
      const isHub = node.type === 'hub';
      el.className = isHub ? 'node node-hub' : 'node node-leaf';
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      el.style.width = `${node.radius * 2}px`;
      el.style.height = `${node.radius * 2}px`;

      const fullLabel = window.KnoweiSheets.capitalize(node.label);
      el.textContent = window.KnoweiSheets.truncate(fullLabel, isHub ? 20 : 26);
      el.title = fullLabel;
      el.style.animationDelay = `${(i * 0.06).toFixed(2)}s`;

      el.addEventListener('click', () => {
        if (isHub) {
          showDetail(
            {
              eyebrow: 'Keyword',
              title: fullLabel,
              body: node.hub.description
                ? window.KnoweiSheets.capitalize(node.hub.description)
                : 'Geen beschrijving beschikbaar voor dit keyword.',
            },
            el
          );
        } else {
          showDetail(
            {
              eyebrow: node.concept.box_name ? window.KnoweiSheets.capitalize(node.concept.box_name) : 'L&D concept',
              title: fullLabel,
              body: node.concept.description
                ? window.KnoweiSheets.capitalize(node.concept.description)
                : 'Geen beschrijving beschikbaar.',
            },
            el
          );
        }
      });
      connectionsCanvas.appendChild(el);
    });
  }

  function showDetail({ eyebrow, title, body }, el) {
    document.querySelectorAll('.node.is-selected').forEach((n) => n.classList.remove('is-selected'));
    el.classList.add('is-selected');

    document.getElementById('concept-detail-eyebrow').textContent = eyebrow;
    document.getElementById('concept-detail-title').textContent = title;
    document.getElementById('concept-detail-body').textContent = body;
    conceptDetail.hidden = false;
  }

  document.getElementById('concept-detail-close').addEventListener('click', () => {
    conceptDetail.hidden = true;
    document.querySelectorAll('.node.is-selected').forEach((n) => n.classList.remove('is-selected'));
  });

  // ---------- Complexity picker: human judgement replaces the auto-score ----------
  // The user picks the image that best matches the connections pattern they
  // just saw; that pick (not a formula) drives the complexity shown on stap 3.
  const complexityOptions = document.querySelectorAll('.complexity-option');
  const verbandenNextBtn = document.getElementById('verbanden-next');
  let selectedComplexity = null;

  complexityOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedComplexity = btn.dataset.complexity;
      complexityOptions.forEach((b) => {
        const isSelected = b === btn;
        b.classList.toggle('is-selected', isSelected);
        b.setAttribute('aria-checked', String(isSelected));
      });
      verbandenNextBtn.disabled = false;
    });
  });

  async function renderConnectionsDiagram() {
    conceptDetail.hidden = true;
    connectionsWrap.classList.remove('is-ready');
    connectionsCanvas.hidden = true;
    connectionsEmpty.hidden = true;
    connectionsLoading.hidden = false;

    try {
      const { keywordEffectRows, conceptMap } = await window.KnoweiSheets.loadAll();
      const devtoolRows = getKeywordRows();
      const hubs = window.KnoweiSheets.resolveHubs(devtoolRows, keywordEffectRows, conceptMap);

      // Small fixed delay on top of the real fetch time, so the reveal reads
      // as "AI is working" rather than an instant layout swap.
      await new Promise((resolve) => setTimeout(resolve, 900));

      connectionsLoading.hidden = true;
      connectionsWrap.classList.add('is-ready');

      if (!hubs.length) {
        connectionsEmpty.textContent =
          'Nog geen verbanden gevonden — vul de keyword-tabel op stap 1 met keywords die voorkomen in de Keyword_Effect sheet.';
        connectionsEmpty.hidden = false;
        return;
      }
      connectionsCanvas.hidden = false;
      renderConnectionsCanvas(hubs);
    } catch (err) {
      console.error('[KnoweiSheets] Kon verbanden niet opbouwen:', err);
      connectionsLoading.hidden = true;
      connectionsEmpty.textContent = 'Fout bij laden van Google Sheets data (zie console).';
      connectionsEmpty.hidden = false;
    }
  }

  // ---------- Advice & toolbox screen ----------
  const complexityBanner = document.getElementById('complexity-banner');
  const complexityValue = document.getElementById('complexity-value');
  const complexityNote = document.getElementById('complexity-note');
  const adviceLoading = document.getElementById('advice-loading');
  const adviceEmpty = document.getElementById('advice-empty');
  const adviceList = document.getElementById('advice-list');

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

  async function renderAdviceScreen() {
    adviceLoading.hidden = false;
    adviceEmpty.hidden = true;
    adviceList.hidden = true;
    adviceList.innerHTML = '';
    complexityBanner.hidden = true;
    complexityBanner.className = 'complexity-banner';

    try {
      const { keywordEffectRows, conceptMap } = await window.KnoweiSheets.loadAll();
      const devtoolRows = getKeywordRows();
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

  // ---------- Description text: type -> Enter to set -> Edit to revert ----------
  const descriptionInput = document.getElementById('description-input');
  const textSetDisplay = document.getElementById('text-set-display');
  const editBtn = document.getElementById('edit-description');
  const aiReading = document.getElementById('ai-reading');

  function isTextSet() {
    return !textSetDisplay.hidden;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightText(text, entries) {
    if (!entries.length) return escapeHtml(text);

    const sorted = [...entries].sort((a, b) => b.text.length - a.text.length);
    const lowerToClass = new Map();
    sorted.forEach((e) => {
      const key = e.text.toLowerCase();
      if (!lowerToClass.has(key)) lowerToClass.set(key, e.cls);
    });

    const pattern = sorted.map((e) => escapeRegex(e.text)).join('|');
    const re = new RegExp(pattern, 'gi');

    let result = '';
    let lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      result += escapeHtml(text.slice(lastIndex, match.index));
      const cls = lowerToClass.get(match[0].toLowerCase());
      result += `<span class="hl hl-${cls}">${escapeHtml(match[0])}</span>`;
      lastIndex = match.index + match[0].length;
      if (re.lastIndex === match.index) re.lastIndex++;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
  }

  function renderHighlightedText() {
    const entries = getKeywordEntries();
    textSetDisplay.innerHTML = highlightText(descriptionInput.value, entries);
  }

  function setText() {
    if (!descriptionInput.value.trim()) return;
    renderHighlightedText();
    descriptionInput.hidden = true;
    textSetDisplay.hidden = false;
    editBtn.hidden = false;
    updateUploadNextState();
  }

  function editText() {
    descriptionInput.hidden = false;
    textSetDisplay.hidden = true;
    editBtn.hidden = true;
    descriptionInput.focus();
    updateUploadNextState();
  }

  descriptionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setText();
    }
  });

  editBtn.addEventListener('click', editText);

  // ---------- Photo upload: mocked — no real file dialog, always uses the sample photo ----------
  const CARD_TEXT =
    'We vinden MT overleggen vermoeiend en tijdrovend. De overleggen lopen altijd uit, we (8 MT leden) delen veel meningen, maar uiteindelijk neemt niemand een besluit, we schuiven het steeds voor ons uit.';
  const MOCK_PHOTO_SRC = 'assets/images/voorbeeld_text_image.jpeg';

  const dropzone = document.getElementById('dropzone');
  const dropzoneContent = document.getElementById('dropzone-content');

  dropzone.addEventListener('click', useMockPhoto);
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('has-file');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('has-file'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    useMockPhoto();
  });

  function useMockPhoto() {
    dropzone.classList.add('has-file');
    dropzoneContent.innerHTML = `
      <img src="${MOCK_PHOTO_SRC}" class="dropzone-preview" alt="Geüploade kaart" />
      <p class="dropzone-sub">kaart-foto.jpg</p>
    `;
    simulateAiReading();
  }

  function simulateAiReading() {
    descriptionInput.hidden = true;
    textSetDisplay.hidden = true;
    editBtn.hidden = true;
    aiReading.hidden = false;

    setTimeout(() => {
      aiReading.hidden = true;
      descriptionInput.value = CARD_TEXT;
      setText();
    }, 1500);
  }

  // ---------- Reset: puts screen 1 back to its fresh-load state ----------
  // Lets a salesperson re-run the same demo for a new audience without
  // manually clearing every field by hand.
  const DEFAULT_KEYWORD_ROWS = [
    ['MT overleggen', 'vermoeiend', 'delen meningen', 'loopt uit de tijd'],
    ['8 MT leden', 'tijdrovend', 'vooruit schuiven', 'loopt uit de tijd'],
  ];

  function resetApp() {
    kaartSelect.value = '';
    renderKaartPreview();

    dropzone.classList.remove('has-file');
    dropzoneContent.innerHTML = `
      <div class="dropzone-icon">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M8 13V3M3 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="dropzone-title">Sleep foto hierheen</p>
      <p class="dropzone-sub">of klik om te uploaden</p>
    `;

    descriptionInput.value = '';
    descriptionInput.hidden = false;
    textSetDisplay.hidden = true;
    textSetDisplay.innerHTML = '';
    editBtn.hidden = true;
    updateUploadNextState();

    Array.from(keywordTableBody.querySelectorAll('tr')).forEach((row, i) => {
      if (i >= DEFAULT_KEYWORD_ROWS.length) {
        row.remove();
        return;
      }
      row.querySelectorAll('input').forEach((input, c) => {
        input.value = DEFAULT_KEYWORD_ROWS[i][c];
      });
    });

    tableWrap.classList.remove('is-visible');
    toggleBtn.textContent = 'Devtool: toon keyword tabel';
    conceptsTableWrap.classList.remove('is-visible');
    toggleConceptsBtn.textContent = 'Devtool: toon gekoppelde data-tabel';

    conceptDetail.hidden = true;
    document.querySelectorAll('.node.is-selected').forEach((n) => n.classList.remove('is-selected'));

    selectedComplexity = null;
    verbandenNextBtn.disabled = true;
    complexityOptions.forEach((b) => {
      b.classList.remove('is-selected');
      b.setAttribute('aria-checked', 'false');
    });
  }

  showScreen(1);
})();
