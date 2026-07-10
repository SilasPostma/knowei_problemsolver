/*
 * Screen 2 (Verbanden): the concepts debug table, the connections diagram
 * (hub keyword -> leaf L&D concept layout, rendering and click interaction),
 * and the complexity picker.
 *
 * Public interface used by app.js:
 *  - init()                     wire up all listeners, called once on page load
 *  - render(devtoolRows)        builds the debug table + diagram for the
 *                                current stap-1 keyword rows — only does this
 *                                once per visit to stap 1; once generated it
 *                                stays as-is (no re-fetch, no re-randomized
 *                                layout) until reset() runs
 *  - getSelectedComplexity()    the complexity picked by the user, or null
 *  - getSelectedConceptEntries() the L&D concepts selected by clicking their
 *                                bubble (each with the hub keyword(s) that
 *                                led to it) — only leaf/concept bubbles are
 *                                selectable, the central keyword bubble is
 *                                informational only
 *  - reset()                    puts screen 2 back to its fresh-load state
 */
window.KnoweiConnections = (function () {
  let toggleConceptsBtn, conceptsTableWrap;
  let connectionsWrap, connectionsLoading, connectionsCanvas, connectionsEmpty;
  let complexityOptions, verbandenNextBtn, selectionRequirement;
  let tooltipBox, tooltipLine, tooltipDot;
  let selectedComplexity = null;
  let selectedConceptIds = new Set();
  let lastHubs = [];
  let hasRendered = false;

  // ---------- Devtool: hidden concepts debug table (Stage 2/3 join result) ----------
  // The header row is rebuilt from KnoweiSheets.getConceptFields() every time
  // too (not hardcoded in index.html) — LD_concept_v2's columns are read off
  // the live sheet, so a client-added column shows up here automatically.
  async function renderConceptsDebugTable(devtoolRows) {
    const statusEl = document.getElementById('concepts-debug-status');
    const thead = document.getElementById('concepts-table-head');
    const tbody = document.getElementById('concepts-table-body');
    statusEl.textContent = 'Data laden vanuit Google Sheets...';
    tbody.innerHTML = '';

    try {
      const { keywordEffectRows, conceptMap } = await window.KnoweiSheets.loadAll();
      const concepts = window.KnoweiSheets.resolveAllConcepts(devtoolRows, keywordEffectRows, conceptMap);
      const fields = window.KnoweiSheets.getConceptFields();

      thead.innerHTML = '';
      const headRow = document.createElement('tr');
      fields.forEach((field) => {
        const th = document.createElement('th');
        th.textContent = field;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);

      statusEl.textContent = concepts.length
        ? `${concepts.length} gekoppelde L&D concept(en) gevonden voor de huidige keywords.`
        : 'Geen gekoppelde L&D concepten gevonden voor de huidige keywords.';

      concepts.forEach((concept) => {
        const tr = document.createElement('tr');
        fields.forEach((field) => {
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
  //
  // Cost note: this is O(n^2) per pass, up to 800 passes. Fine at mockup
  // scale (a handful of hubs/concepts); if the concept count grows a lot,
  // this is the first place to optimize (e.g. a spatial grid to cut down
  // the pair count instead of checking every pair every pass).
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

  // How long a bubble must be hovered before its description reveals — long
  // enough that just passing the cursor over the canvas doesn't spam the
  // tooltip with every bubble it crosses.
  const HOVER_DELAY_MS = 250;
  let hoverTimer = null;

  function detailFor(node, fullLabel) {
    return node.type === 'hub'
      ? {
          eyebrow: 'Keyword',
          title: fullLabel,
          body: node.hub.description
            ? window.KnoweiSheets.capitalize(node.hub.description)
            : 'Geen beschrijving beschikbaar voor dit keyword.',
        }
      : {
          eyebrow: 'L&D concept',
          title: fullLabel,
          body: node.concept.description
            ? window.KnoweiSheets.capitalize(node.concept.description)
            : 'Geen beschrijving beschikbaar.',
        };
  }

  // ---------- Hover tooltip: a small card pinned to the canvas's corner,
  // connected to whichever bubble is hovered by a thin line + dot — the
  // description always reads in the same place instead of a floating box
  // jumping around the canvas, while still visibly pointing at its bubble.
  // Purely hover-driven: it shows HOVER_DELAY_MS after entering a bubble and
  // hides the instant the cursor leaves — clicking never shows or hides it.
  function positionTooltipLine(bubbleX, bubbleY) {
    const left = tooltipBox.offsetLeft;
    const top = tooltipBox.offsetTop;
    const right = left + tooltipBox.offsetWidth;
    const bottom = top + tooltipBox.offsetHeight;
    const anchorX = Math.min(Math.max(bubbleX, left), right);
    const anchorY = Math.min(Math.max(bubbleY, top), bottom);

    tooltipLine.setAttribute('x1', bubbleX);
    tooltipLine.setAttribute('y1', bubbleY);
    tooltipLine.setAttribute('x2', anchorX);
    tooltipLine.setAttribute('y2', anchorY);
    tooltipDot.setAttribute('cx', bubbleX);
    tooltipDot.setAttribute('cy', bubbleY);
  }

  // Uses a CSS class rather than the `hidden` attribute/property — SVG
  // elements don't reliably support the `.hidden` IDL property (assigning it
  // silently no-ops instead of setting the content attribute in some
  // browsers), which was leaving the connector line visible after the
  // tooltip should have closed.
  function showTooltip(node, fullLabel, bubbleX, bubbleY) {
    const { eyebrow, title, body } = detailFor(node, fullLabel);
    tooltipBox.querySelector('.connections-tooltip-eyebrow').textContent = eyebrow;
    tooltipBox.querySelector('.connections-tooltip-title').textContent = title;
    tooltipBox.querySelector('.connections-tooltip-body').textContent = body;
    tooltipBox.classList.add('is-visible');
    tooltipLine.parentElement.classList.add('is-visible');
    positionTooltipLine(bubbleX, bubbleY);
  }

  function hideTooltip() {
    tooltipBox.classList.remove('is-visible');
    tooltipLine.parentElement.classList.remove('is-visible');
  }

  // The canvas has a fixed, finite viewport (see `.connections-canvas` in
  // css/styles.css) — the diagram itself is laid out at whatever "natural"
  // size the bubbles need (see buildConnectionsLayout), then this scales
  // that whole layout down (via CSS transform, so text/borders/everything
  // scales together) to fit inside the viewport instead of overflowing it.
  // Small diagrams (natural size already <= viewport) render at 1:1 — the
  // layout already fills the viewport width in that case (see `width` in
  // buildConnectionsLayout), so scale is a no-op and nothing looks shrunk.
  function renderConnectionsCanvas(hubs) {
    connectionsCanvas.innerHTML = '';

    const viewportWidth = connectionsCanvas.clientWidth || 900;
    const viewportHeight = connectionsCanvas.clientHeight || 560;

    const { width, height, nodes, lines } = buildConnectionsLayout(hubs, viewportWidth);
    const scale = Math.min(1, viewportWidth / width, viewportHeight / height);

    const inner = document.createElement('div');
    inner.className = 'connections-canvas-inner';
    inner.style.width = `${width}px`;
    inner.style.height = `${height}px`;
    const offsetX = Math.max(0, (viewportWidth - width * scale) / 2);
    const offsetY = Math.max(0, (viewportHeight - height * scale) / 2);
    inner.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

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
    inner.appendChild(svg);

    nodes.forEach((node, i) => {
      const el = document.createElement('div');
      const isHub = node.type === 'hub';
      el.className = isHub ? 'node node-hub' : 'node node-leaf';
      if (isHub) el.classList.add('is-not-clickable');
      if (!isHub && selectedConceptIds.has(node.concept.id)) el.classList.add('is-selected');
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      el.style.width = `${node.radius * 2}px`;
      el.style.height = `${node.radius * 2}px`;

      const fullLabel = window.KnoweiSheets.capitalize(node.label);
      el.textContent = window.KnoweiSheets.truncate(fullLabel, isHub ? 20 : 26);
      el.title = fullLabel;
      el.style.animationDelay = `${(i * 0.06).toFixed(2)}s`;

      // Screen-space position of this bubble's center (accounting for the
      // scale-to-fit transform on `inner`) — needed to point the hover
      // tooltip's connector line at the right spot.
      const screenX = offsetX + node.x * scale;
      const screenY = offsetY + node.y * scale;

      // Hover (after HOVER_DELAY_MS) reveals the tooltip for any bubble —
      // keywords included, so their description is still readable even
      // though the keyword bubble itself isn't clickable. Leaving the
      // bubble hides it immediately; clicking never shows or hides it.
      el.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => showTooltip(node, fullLabel, screenX, screenY), HOVER_DELAY_MS);
      });
      el.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        hideTooltip();
      });

      // Only L&D concepts (the outer/leaf bubbles) are selectable — the
      // central keyword bubble is informational only (hover still works,
      // click does nothing).
      if (!isHub) {
        el.addEventListener('click', () => {
          const nowSelected = el.classList.toggle('is-selected');
          if (nowSelected) selectedConceptIds.add(node.concept.id);
          else selectedConceptIds.delete(node.concept.id);
          updateVerbandenNextState();
        });
      }

      inner.appendChild(el);
    });

    connectionsCanvas.appendChild(inner);
  }

  async function renderConnectionsDiagram(devtoolRows) {
    hideTooltip();
    connectionsWrap.classList.remove('is-ready');
    connectionsCanvas.hidden = true;
    connectionsEmpty.hidden = true;
    connectionsLoading.hidden = false;

    try {
      const { keywordEffectRows, conceptMap } = await window.KnoweiSheets.loadAll();
      const hubs = window.KnoweiSheets.resolveHubs(devtoolRows, keywordEffectRows, conceptMap);
      lastHubs = hubs;

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

  // ---------- Public entry point: renders both the diagram and its debug table ----------
  // Guarded to run once — repeated "Volgende" clicks (e.g. after going back
  // to stap 1 and forward again without changing anything) must not
  // re-fetch or re-randomize the already-built diagram.
  async function render(devtoolRows) {
    if (hasRendered) return;
    hasRendered = true;
    await Promise.all([renderConceptsDebugTable(devtoolRows), renderConnectionsDiagram(devtoolRows)]);
  }

  // "Volgende" needs both a complexity pick and at least one selected L&D
  // concept — the requirement text under the canvas mirrors whichever half
  // is still missing via `.is-satisfied`.
  function updateVerbandenNextState() {
    const hasSelection = selectedConceptIds.size > 0;
    verbandenNextBtn.disabled = !(selectedComplexity && hasSelection);
    selectionRequirement.classList.toggle('is-satisfied', hasSelection);
  }

  function reset() {
    hasRendered = false;

    conceptsTableWrap.classList.remove('is-visible');
    toggleConceptsBtn.textContent = 'Devtool: toon gekoppelde data-tabel';

    hideTooltip();
    selectedConceptIds = new Set();
    lastHubs = [];
    selectionRequirement.classList.remove('is-satisfied');

    selectedComplexity = null;
    verbandenNextBtn.disabled = true;
    complexityOptions.forEach((b) => {
      b.classList.remove('is-selected');
      b.setAttribute('aria-checked', 'false');
    });
  }

  // Builds the persistent hover-tooltip card + its connector line/dot once —
  // both live outside `connectionsCanvas` (which gets wiped on every
  // render) so they survive across re-renders untouched.
  function buildTooltip() {
    const box = document.createElement('div');
    box.className = 'connections-tooltip';
    box.innerHTML = `
      <p class="connections-tooltip-eyebrow"></p>
      <p class="connections-tooltip-title"></p>
      <p class="connections-tooltip-body"></p>
    `;
    connectionsWrap.appendChild(box);
    tooltipBox = box;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'connections-tooltip-line');
    const line = document.createElementNS(svgNS, 'line');
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('r', '4');
    svg.appendChild(line);
    svg.appendChild(dot);
    connectionsWrap.appendChild(svg);
    tooltipLine = line;
    tooltipDot = dot;
  }

  function init() {
    toggleConceptsBtn = document.getElementById('toggle-concepts-table');
    conceptsTableWrap = document.getElementById('concepts-table-wrap');
    connectionsWrap = document.getElementById('connections-canvas-wrap');
    connectionsLoading = document.getElementById('connections-loading');
    connectionsCanvas = document.getElementById('connections-canvas');
    connectionsEmpty = document.getElementById('connections-empty');
    complexityOptions = document.querySelectorAll('.complexity-option');
    verbandenNextBtn = document.getElementById('verbanden-next');
    selectionRequirement = document.getElementById('selection-requirement');

    buildTooltip();

    toggleConceptsBtn.addEventListener('click', () => {
      const visible = conceptsTableWrap.classList.toggle('is-visible');
      toggleConceptsBtn.textContent = visible
        ? 'Devtool: verberg gekoppelde data-tabel'
        : 'Devtool: toon gekoppelde data-tabel';
    });

    // ---------- Complexity picker: human judgement replaces the auto-score ----------
    // The user picks the image that best matches the connections pattern they
    // just saw; that pick (not a formula) drives the complexity shown on stap 3.
    complexityOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedComplexity = btn.dataset.complexity;
        complexityOptions.forEach((b) => {
          const isSelected = b === btn;
          b.classList.toggle('is-selected', isSelected);
          b.setAttribute('aria-checked', String(isSelected));
        });
        updateVerbandenNextState();
      });
    });
  }

  return {
    init,
    render,
    getSelectedComplexity: () => selectedComplexity,
    getSelectedConceptEntries: () =>
      window.KnoweiSheets.getConceptsWithKeywords(lastHubs).filter((entry) => selectedConceptIds.has(entry.concept.id)),
    reset,
  };
})();
