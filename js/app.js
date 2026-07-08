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
    },
    {
      id: 'mt',
      label: 'We vinden MT overleggen vermoeiend en tijdrovend.',
      image: null,
    },
    {
      id: 'eiland',
      label: 'Ieder werkt op zijn eigen eiland, niemand deelt informatie.',
      image: null,
    },
  ];

  const kaartSelect = document.getElementById('kaart-select');
  const kaartPreview = document.getElementById('kaart-preview');

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

  kaartSelect.addEventListener('change', renderKaartPreview);
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

  const TOOLBOX_FIELD_LABELS = {
    inhouse_klant: 'Inhouse-training',
    futures: 'Toekomstmodule',
    knowei_modules: 'Knowei-module',
  };

  // Complexity classification — devtool note (also shown, shorter, in the UI
  // footnote): score = koppelingen + (gedeelde concepten × 2). Shared
  // concepts are weighted extra because cross-cutting dependency between
  // parts of the problem — not just the raw link count — is what actually
  // separates Complex/Chaotic from Simple/Complicated (Cynefin framework).
  // Thresholds (score): 0–4 eenvoudig, 5–9 ingewikkeld, 10–15 complex, 16+
  // chaotisch.
  const COMPLEXITY_LEVELS = [
    { max: 4, label: 'Eenvoudig', modifier: 'eenvoudig' },
    { max: 9, label: 'Ingewikkeld', modifier: 'ingewikkeld' },
    { max: 15, label: 'Complex', modifier: 'complex' },
    { max: Infinity, label: 'Chaotisch', modifier: 'chaotisch' },
  ];

  function computeComplexity(hubs) {
    const totalConnections = hubs.reduce((sum, hub) => sum + hub.concepts.length, 0);
    const conceptHubCount = new Map();
    hubs.forEach((hub) => {
      hub.concepts.forEach((concept) => {
        conceptHubCount.set(concept.id, (conceptHubCount.get(concept.id) || 0) + 1);
      });
    });
    const sharedCount = Array.from(conceptHubCount.values()).filter((n) => n > 1).length;
    const score = totalConnections + sharedCount * 2;
    const level = COMPLEXITY_LEVELS.find((l) => score <= l.max);
    return { score, totalConnections, sharedCount, label: level.label, modifier: level.modifier };
  }

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

  function buildBoxCard(box) {
    const card = document.createElement('article');
    card.className = 'advice-card';

    const label = document.createElement('p');
    label.className = 'card-label';
    label.textContent = 'Toolbox';
    card.appendChild(label);

    const title = document.createElement('h3');
    title.className = 'advice-card-title';
    title.textContent = box.boxName ? window.KnoweiSheets.capitalize(box.boxName) : 'Overig advies';
    card.appendChild(title);

    // Condensed: one line per concept (keyword tag(s) + name only, no
    // description) so a box with several concepts still reads as a quick
    // list rather than a wall of repeated blocks.
    const conceptsWrap = document.createElement('div');
    conceptsWrap.className = 'advice-concepts';
    box.entries.forEach(({ concept, keywords }) => {
      const row = document.createElement('div');
      row.className = 'advice-concept-row';

      keywords.forEach((keyword) => {
        const tag = document.createElement('span');
        tag.className = 'advice-tag';
        tag.textContent = window.KnoweiSheets.capitalize(keyword);
        row.appendChild(tag);
      });

      const name = document.createElement('span');
      name.className = 'advice-concept-name';
      name.textContent = window.KnoweiSheets.capitalize(concept.name || concept.id);
      row.appendChild(name);

      conceptsWrap.appendChild(row);
    });
    card.appendChild(conceptsWrap);

    // Only the first concept's advice is shown — repeating near-identical
    // advice per concept made the card feel cluttered. One clear
    // recommendation per box reads much better.
    const firstConcept = box.entries[0].concept;
    const adviceLabel = document.createElement('p');
    adviceLabel.className = 'card-label advice-label';
    adviceLabel.textContent = 'Advies';
    card.appendChild(adviceLabel);

    const adviceText = document.createElement('p');
    adviceText.className = 'advice-card-text';
    adviceText.textContent = firstConcept.advice
      ? window.KnoweiSheets.capitalize(firstConcept.advice)
      : 'Geen adviestekst beschikbaar.';
    card.appendChild(adviceText);

    // One combined table for the whole box — a row per concept is more
    // scannable than repeating a full 3-column table under each concept.
    const toolboxFields = ['inhouse_klant', 'futures', 'knowei_modules'];
    const hasToolboxData = box.entries.some(({ concept }) => toolboxFields.some((field) => concept[field]));
    if (hasToolboxData) {
      const table = document.createElement('table');
      table.className = 'advice-mini-table';

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Concept', ...toolboxFields.map((field) => TOOLBOX_FIELD_LABELS[field])].forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      box.entries.forEach(({ concept }) => {
        const row = document.createElement('tr');
        const nameTd = document.createElement('td');
        nameTd.textContent = window.KnoweiSheets.capitalize(concept.name || concept.id);
        row.appendChild(nameTd);
        toolboxFields.forEach((field) => {
          const td = document.createElement('td');
          td.textContent = concept[field] || '—';
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      card.appendChild(table);
    }

    // CTA comes last on purpose — the payoff moment should lead straight
    // into "get in touch / buy the box".
    if (box.boxUrl) {
      const cta = document.createElement('a');
      cta.className = 'btn btn-primary advice-cta';
      cta.href = box.boxUrl;
      cta.target = '_blank';
      cta.rel = 'noopener';
      const boxLabel = box.boxName ? window.KnoweiSheets.capitalize(box.boxName) : 'toolbox';
      cta.textContent = `Bekijk ${boxLabel} →`;
      card.appendChild(cta);
    }

    return card;
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

      const complexity = computeComplexity(hubs);
      complexityBanner.classList.add(`complexity-${complexity.modifier}`);
      complexityValue.textContent = complexity.label;
      complexityNote.textContent =
        `${complexity.totalConnections} keyword-concept koppeling(en), waarvan ${complexity.sharedCount} gedeeld ` +
        `tussen meerdere keywords (score ${complexity.score}).`;
      complexityBanner.hidden = false;

      getBoxesWithConcepts(hubs).forEach((box) => {
        adviceList.appendChild(buildBoxCard(box));
      });
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
  }

  function editText() {
    descriptionInput.hidden = false;
    textSetDisplay.hidden = true;
    editBtn.hidden = true;
    descriptionInput.focus();
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
      <div class="dropzone-icon">&#8593;</div>
      <p class="dropzone-title">Sleep foto hierheen</p>
      <p class="dropzone-sub">of klik om te uploaden</p>
    `;

    descriptionInput.value = '';
    descriptionInput.hidden = false;
    textSetDisplay.hidden = true;
    textSetDisplay.innerHTML = '';
    editBtn.hidden = true;

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
  }

  showScreen(1);
})();
