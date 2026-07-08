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

  document.getElementById('restart').addEventListener('click', () => showScreen(1));

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

  showScreen(1);
})();
