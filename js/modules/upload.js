/*
 * Screen 1 (Upload): kaart dropdown, the devtool keyword table, the
 * description text + highlight logic, and the mocked photo upload.
 *
 * Public interface used by app.js and the other modules:
 *  - init()             wire up all listeners, called once on page load
 *  - getKeywordRows()   devtool rows ({ feiten, ervaren, doen, effect }),
 *                       needed by the connections/advice modules to resolve
 *                       hubs and concepts
 *  - reset()            puts screen 1 back to its fresh-load state
 */
window.KnoweiUpload = (function () {
  // ---------- Kaart dropdown (mock options replacing image upload) ----------
  const KAART_OPTIONS = [
    { id: '', label: '– Kies een voorbeeldkaart –', image: null },
    {
      id: 'knoop',
      label: 'We praten eindeloos, Niemand hakt de knoop door.',
      image: 'assets/images/knoop_doorhakken.png',
    }
  ];

  let kaartSelect, kaartPreview, uploadNextBtn;
  let dropzone, dropzoneContent;
  let descriptionInput, textSetDisplay, editBtn, aiReading;
  let toggleBtn, tableWrap, keywordTableBody;

  const COLUMN_CLASSES = ['feiten', 'ervaren', 'doen', 'effect'];

  const DEFAULT_KEYWORD_ROWS = [
    ['MT overleggen', 'vermoeiend', 'delen meningen', 'loopt uit de tijd'],
    ['8 MT leden', 'tijdrovend', 'vooruit schuiven', 'loopt uit de tijd'],
  ];

  // Gate stap 1's "Volgende" on all three inputs being done: a kaart chosen,
  // a photo uploaded, and the resulting description text generated (not
  // mid-edit).
  function updateUploadNextState() {
    uploadNextBtn.disabled = !(kaartSelect.value && dropzone.classList.contains('has-file') && isTextSet());
  }

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

  // ---------- Devtool: hidden keyword table ----------
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

  // ---------- Description text: type -> Enter to set -> Edit to revert ----------
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

  // ---------- Photo upload: mocked — no real file dialog, always uses the sample photo ----------
  const CARD_TEXT =
    'We vinden MT overleggen vermoeiend en tijdrovend. De overleggen lopen altijd uit, we (8 MT leden) delen veel meningen, maar uiteindelijk neemt niemand een besluit, we schuiven het steeds voor ons uit.';
  const MOCK_PHOTO_SRC = 'assets/images/voorbeeld_text_image.jpeg';

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

  function defaultDropzoneMarkup() {
    return `
      <div class="dropzone-icon">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M8 13V3M3 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="dropzone-title">Sleep foto hierheen</p>
      <p class="dropzone-sub">of klik om te uploaden</p>
    `;
  }

  // ---------- Reset: puts screen 1 back to its fresh-load state ----------
  function reset() {
    kaartSelect.value = '';
    renderKaartPreview();

    dropzone.classList.remove('has-file');
    dropzoneContent.innerHTML = defaultDropzoneMarkup();

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
  }

  function init() {
    kaartSelect = document.getElementById('kaart-select');
    kaartPreview = document.getElementById('kaart-preview');
    uploadNextBtn = document.getElementById('upload-next');
    dropzone = document.getElementById('dropzone');
    dropzoneContent = document.getElementById('dropzone-content');
    descriptionInput = document.getElementById('description-input');
    textSetDisplay = document.getElementById('text-set-display');
    editBtn = document.getElementById('edit-description');
    aiReading = document.getElementById('ai-reading');
    toggleBtn = document.getElementById('toggle-keywords');
    tableWrap = document.getElementById('keyword-table-wrap');
    keywordTableBody = document.getElementById('keyword-table-body');

    KAART_OPTIONS.forEach((opt) => {
      const el = document.createElement('option');
      el.value = opt.id;
      el.textContent = opt.label;
      kaartSelect.appendChild(el);
    });

    kaartSelect.addEventListener('change', () => {
      renderKaartPreview();
      updateUploadNextState();
    });
    renderKaartPreview();

    toggleBtn.addEventListener('click', () => {
      const visible = tableWrap.classList.toggle('is-visible');
      toggleBtn.textContent = visible ? 'Devtool: verberg keyword tabel' : 'Devtool: toon keyword tabel';
    });

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

    descriptionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        setText();
      }
    });

    editBtn.addEventListener('click', editText);

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
  }

  return {
    init,
    getKeywordRows,
    reset,
  };
})();
