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
      id: "rood-01",
      label: "We praten eindeloos, maar niemand hakt de knoop door.",
      image: "assets/images/kaarten/rood-01-we-praten-eindeloos-niemand-hakt-de-knoop.webp",
    },
    {
      id: "blauw-01",
      label: "We willen vernieuwen we houden vast aan gisteren.",
      image: "assets/images/kaarten/blauw-01-we-willen-vernieuwen-we-houden-vast-aan.webp",
    },
    {
      id: "blauw-02",
      label: "We leveren meer dan we hebben.",
      image: "assets/images/kaarten/blauw-02-we-leveren-meer-dan-we-hebben.webp",
    },
    {
      id: "blauw-03",
      label: "We beloven meer dan we hebben.",
      image: "assets/images/kaarten/blauw-03-we-beloven-meer-dan-we-hebben.webp",
    },
    {
      id: "blauw-04",
      label: "Vandaag de winst morgen de rekening.",
      image: "assets/images/kaarten/blauw-04-vandaag-de-winst-morgen-de-rekening.webp",
    },
    {
      id: "blauw-05",
      label: "Buiten roept om beweging binnen blijft het stil.",
      image: "assets/images/kaarten/blauw-05-buiten-roept-om-beweging-binnen-blijft-het.webp",
    },
    {
      id: "blauw-06",
      label: "We zijn zo druk met vandaag dat morgen niet past.",
      image: "assets/images/kaarten/blauw-06-we-zijn-zo-druk-met-vandaag-dat-morgen-niet.webp",
    },
    {
      id: "blauw-07",
      label: "De markt beweegt wij blijven zitten.",
      image: "assets/images/kaarten/blauw-07-de-markt-beweegt-wij-blijven-zitten.webp",
    },
    {
      id: "blauw-08",
      label: "We maken grote plannen we zetten kleine stapjes.",
      image: "assets/images/kaarten/blauw-08-we-maken-grote-plannen-we-zetten-kleine.webp",
    },
    {
      id: "blauw-09",
      label: "We zoeken informatie we verdrinken in data.",
      image: "assets/images/kaarten/blauw-09-we-zoeken-informatie-we-verdrinken-in-data.webp",
    },
    {
      id: "blauw-10",
      label: "Geen budget wel verwachtingen.",
      image: "assets/images/kaarten/blauw-10-geen-budget-wel-verwachtingen.webp",
    },
    {
      id: "blauw-11",
      label: "Iedereen knikt niemand beweegt.",
      image: "assets/images/kaarten/blauw-11-iedereen-knikt-niemand-beweegt.webp",
    },
    {
      id: "blauw-12",
      label: "Op korte termijn scoren op lange termijn hopen.",
      image: "assets/images/kaarten/blauw-12-op-korte-termijn-scoren-op-lange-termijn.webp",
    },
    {
      id: "blauw-13",
      label: "We willen vertrouwen, maar controleren voor de zekerheid.",
      image: "assets/images/kaarten/blauw-13-we-willen-vertrouwen-maar-controleren-voor.webp",
    },
    {
      id: "blauw-14",
      label: "We zitten vast tussen iets nieuws proberen en niets durven verliezen.",
      image: "assets/images/kaarten/blauw-14-we-zitten-vast-tussen-iets-nieuws-proberen.webp",
    },
    {
      id: "blauw-15",
      label: "We hebben alles behalve tijd.",
      image: "assets/images/kaarten/blauw-15-we-hebben-alles-behalve-tijd.webp",
    },
    {
      id: "blauw-16",
      label: "We zijn te druk om te groeien.",
      image: "assets/images/kaarten/blauw-16-we-zijn-te-druk-om-te-groeien.webp",
    },
    {
      id: "blauw-17",
      label: "Iedereen werkt hard maar niet aan hetzelfde verhaal.",
      image: "assets/images/kaarten/blauw-17-iedereen-werkt-hard-maar-niet-aan-hetzelfde.webp",
    },
    {
      id: "blauw-18",
      label: "Teveel werk of te weinig richting.",
      image: "assets/images/kaarten/blauw-18-teveel-werk-of-te-weinig-richting.webp",
    },
    {
      id: "blauw-19",
      label: "We concurreren intern en verliezen extern.",
      image: "assets/images/kaarten/blauw-19-we-concurreren-intern-en-verliezen-extern.webp",
    },
    {
      id: "blauw-20",
      label: "Ze plannen een week in een dag.",
      image: "assets/images/kaarten/blauw-20-ze-plannen-een-week-in-een-dag.webp",
    },
    {
      id: "blauw-21",
      label: "Wij praten zij fluisteren.",
      image: "assets/images/kaarten/blauw-21-wij-praten-zij-fluisteren.webp",
    },
    {
      id: "blauw-22",
      label: "We lossen het niet op we praten er omheen.",
      image: "assets/images/kaarten/blauw-22-we-lossen-het-niet-op-we-praten-er-omheen.webp",
    },
    {
      id: "blauw-23",
      label: "Volgen of vooruitgaan.",
      image: "assets/images/kaarten/blauw-23-volgen-of-vooruitgaan.webp",
    },
    {
      id: "blauw-24",
      label: "De een rent, de ander zit stil.",
      image: "assets/images/kaarten/blauw-24-de-een-rent-de-ander-zit-stil.webp",
    },
    {
      id: "blauw-25",
      label: "We keizen voor harmonie en krijgen ruis terug.",
      image: "assets/images/kaarten/blauw-25-we-kiezen-voor-harmonie-en-krijgen-ruis-terug.webp",
    },
    {
      id: "blauw-26",
      label: "Iedereen wil veiligheid niemand wil beginnen.",
      image: "assets/images/kaarten/blauw-26-iedereen-wil-veiligheid-niemand-wil-beginnen.webp",
    },
    {
      id: "bruin-01",
      label: "Wij rennen hard de vraag rent harder.",
      image: "assets/images/kaarten/bruin-01-wij-rennen-hard-de-vraag-rent-harder.webp",
    },
    {
      id: "bruin-02",
      label: "De toekomst klopt aan wij vergaderen nog.",
      image: "assets/images/kaarten/bruin-02-de-toekomst-klopt-aan-wij-vergaderen-nog.webp",
    },
    {
      id: "bruin-03",
      label: "Korte termijn wint, lange termijn kijkt teleurgesteld toe.",
      image: "assets/images/kaarten/bruin-03-korte-termijn-wint-lange-termijn-kijkt.webp",
    },
    {
      id: "bruin-04",
      label: "We willen vernieuwen maar wel zonder risico.",
      image: "assets/images/kaarten/bruin-04-we-willen-vernieuwen-maar-wel-zonder-risico.webp",
    },
    {
      id: "bruin-05",
      label: "Informatie genoeg duidelijkheid niet.",
      image: "assets/images/kaarten/bruin-05-informatie-genoeg-duidelijkheid-niet.webp",
    },
    {
      id: "bruin-06",
      label: "Wij zijn druk soms met het verkeerde.",
      image: "assets/images/kaarten/bruin-06-wij-zijn-druk-soms-met-het-verkeerde.webp",
    },
    {
      id: "bruin-07",
      label: "Wij mogen veel behalve beslissen.",
      image: "assets/images/kaarten/bruin-07-wij-mogen-veel-behalve-beslissen.webp",
    },
    {
      id: "bruin-08",
      label: "Autonomie gewenst conformeren verplicht.",
      image: "assets/images/kaarten/bruin-08-autonomie-gewenst-conformeren-verplicht.webp",
    },
    {
      id: "bruin-09",
      label: "Wij werken samen ieder op z'n eigen eiland.",
      image: "assets/images/kaarten/bruin-09-wij-werken-samen-ieder-op-zn-eigen-eiland.webp",
    },
    {
      id: "bruin-10",
      label: "Boven weten ze alles beneden mogen we raden.",
      image: "assets/images/kaarten/bruin-10-boven-weten-ze-alles-beneden-mogen-we-raden.webp",
    },
    {
      id: "bruin-11",
      label: "Het proces klopt de praktijk niet.",
      image: "assets/images/kaarten/bruin-11-het-proces-klopt-de-praktijk-niet.webp",
    },
    {
      id: "bruin-12",
      label: "Iedereen voelt het noemand zegt het.",
      image: "assets/images/kaarten/bruin-12-iedereen-voelt-het-niemand-zegt-het.webp",
    },
    {
      id: "bruin-13",
      label: "We schuiven stoelen geen ideeen.",
      image: "assets/images/kaarten/bruin-13-we-schuiven-stoelen-geen-ideeen.webp",
    },
    {
      id: "bruin-14",
      label: "Schaarste in middelen overloed in verwachtingen.",
      image: "assets/images/kaarten/bruin-14-schaarste-in-middelen-overvloed-in.webp",
    },
    {
      id: "bruin-15",
      label: "We hebben rollen geen richting.",
      image: "assets/images/kaarten/bruin-15-we-hebben-rollen-geen-richting.webp",
    },
    {
      id: "bruin-16",
      label: "We mogen meedenken niet mee beslissen.",
      image: "assets/images/kaarten/bruin-16-we-mogen-meedenken-niet-mee-beslissen.webp",
    },
    {
      id: "bruin-17",
      label: "We zeggen \"ja\" en doen misschien.",
      image: "assets/images/kaarten/bruin-17-we-zeggen-ja-en-doen-misschien.webp",
    },
    {
      id: "bruin-18",
      label: "Iedereen is expert behalve in samenwerken.",
      image: "assets/images/kaarten/bruin-18-iedereen-is-expert-behalve-in-samenwerken.webp",
    },
    {
      id: "bruin-19",
      label: "Het is ieders probleem dus van niemand.",
      image: "assets/images/kaarten/bruin-19-het-is-ieders-probleem-dus-van-niemand.webp",
    },
    {
      id: "bruin-20",
      label: "We zijn te druk om beter te worden.",
      image: "assets/images/kaarten/bruin-20-we-zijn-te-druk-om-beter-te-worden.webp",
    },
    {
      id: "bruin-21",
      label: "We wilden autonomie we kregen vooraal meningen.",
      image: "assets/images/kaarten/bruin-21-we-wilden-autonomie-we-kregen-vooral-meningen.webp",
    },
    {
      id: "bruin-22",
      label: "Zelfsturing: ik stuur mezelf jullie de rest.",
      image: "assets/images/kaarten/bruin-22-zelfsturing-ik-stuur-mezelf-jullie-de-rest.webp",
    },
    {
      id: "groen-01",
      label: "Elke dag een brandje nooit een plan.",
      image: "assets/images/kaarten/groen-01-elke-dag-een-brandje-nooit-een-plan.webp",
    },
    {
      id: "groen-02",
      label: "Verandering zonder waarom is gewoon ruis.",
      image: "assets/images/kaarten/groen-02-verandering-zonder-waarom-is-gewoon-ruis.webp",
    },
    {
      id: "groen-03",
      label: "Brandje blussen is geen strategie.",
      image: "assets/images/kaarten/groen-03-brandjes-blussen-is-geen-strategie.webp",
    },
    {
      id: "groen-04",
      label: "Het protocol zegt nee, zelfs als ja beter is.",
      image: "assets/images/kaarten/groen-04-het-protocol-zegt-nee-zelfs-als-ja-beter-is.webp",
    },
    {
      id: "groen-05",
      label: "We willen samenwerken maar botsen op de regels.",
      image: "assets/images/kaarten/groen-05-we-willen-samenwerken-maar-botsen-op-de.webp",
    },
    {
      id: "groen-06",
      label: "Structuur hebben we genoeg richting te weinig.",
      image: "assets/images/kaarten/groen-06-structuur-hebben-we-genoeg-richting-te-weinig.webp",
    },
    {
      id: "groen-07",
      label: "Mijn manager hoort me wel, maar luistert niet.",
      image: "assets/images/kaarten/groen-07-mijn-manager-hoort-me-wel-maar-luistert-niet.webp",
    },
    {
      id: "groen-08",
      label: "We werken samen maar het voelt niet als samen.",
      image: "assets/images/kaarten/groen-08-we-werken-samen-maar-het-voelt-niet-als-samen.webp",
    },
    {
      id: "groen-09",
      label: "Er wordt over ons besloten niet met ons.",
      image: "assets/images/kaarten/groen-09-er-wordt-over-ons-besloten-niet-met-ons.webp",
    },
    {
      id: "groen-10",
      label: "We praten over cultuur, maar leven de bijsluiter.",
      image: "assets/images/kaarten/groen-10-we-praten-over-cultuur-maar-leven-de.webp",
    },
    {
      id: "groen-11",
      label: "We vragen om initiatief maar volgen het script.",
      image: "assets/images/kaarten/groen-11-we-vragen-om-initiatief-maar-volgen-het.webp",
    },
    {
      id: "groen-12",
      label: "We willen vertrouwen maar controleren voor de zekerheid.",
      image: "assets/images/kaarten/groen-12-we-willen-vertrouwen-maar-controleren-voor.webp",
    },
    {
      id: "groen-13",
      label: "We praten eindeloos maar niemand beslist.",
      image: "assets/images/kaarten/groen-13-we-praten-eindeloos-maar-niemand-beslist.webp",
    },
    {
      id: "groen-14",
      label: "Iedereen voelt de spanning maar niemand benoemt haar.",
      image: "assets/images/kaarten/groen-14-iedereen-voelt-de-spanning-maar-niemand.webp",
    },
    {
      id: "groen-15",
      label: "Belangrijke dingen hoor ik pas als ze gebeurd zijn.",
      image: "assets/images/kaarten/groen-15-belangrijke-dingen-hoor-ik-pas-als-ze.webp",
    },
    {
      id: "groen-16",
      label: "Iedereen knikt niemand doet.",
      image: "assets/images/kaarten/groen-16-iedereen-knikt-niemand-doet.webp",
    },
    {
      id: "groen-17",
      label: "Twee managers nul duidelijkheid.",
      image: "assets/images/kaarten/groen-17-twee-managers-nul-duidelijkheid.webp",
    },
    {
      id: "groen-18",
      label: "Fouten zijn verboden \" leren\" verwachten ze wel.",
      image: "assets/images/kaarten/groen-18-fouten-zijn-verboden-leren-verwachten-ze-wel.webp",
    },
    {
      id: "groen-19",
      label: "Ze willen dat het gisteren af is.",
      image: "assets/images/kaarten/groen-19-ze-willen-dat-het-gisteren-af-is.webp",
    },
    {
      id: "groen-20",
      label: "We rennen door maar leren niets.",
      image: "assets/images/kaarten/groen-20-we-rennen-door-maar-leren-niets.webp",
    },
    {
      id: "groen-21",
      label: "We willen verandering maar niet beginnen.",
      image: "assets/images/kaarten/groen-21-we-willen-verandering-maar-niet-beginnen.webp",
    },
    {
      id: "groen-22",
      label: "Ik mag beslissen denk ik...",
      image: "assets/images/kaarten/groen-22-ik-mag-beslissen-denk-ik.webp",
    },
    {
      id: "groen-23",
      label: "Sommige krijgen kansen anderen krijgen taken.",
      image: "assets/images/kaarten/groen-23-sommige-krijgen-kansen-anderen-krijgen-taken.webp",
    },
    {
      id: "groen-24",
      label: "We wachten op sturing terwijl we zelf kunnen bewegen.",
      image: "assets/images/kaarten/groen-24-we-wachten-op-sturing-terwijl-we-zelf-kunnen.webp",
    },
    {
      id: "groen-25",
      label: "Eigenaarschap zoeken we maar geven het niet.",
      image: "assets/images/kaarten/groen-25-eigenaarschap-zoeken-we-maar-geven-het-niet.webp",
    },
    {
      id: "rood-02",
      label: "Belangrijke dingen hoor ik pas achteraf.",
      image: "assets/images/kaarten/rood-02-belangrijke-dingen-hoor-ik-pas-achteraf.webp",
    },
    {
      id: "rood-03",
      label: "We zijn zo druk met vandaag dat morgen niet meer past.",
      image: "assets/images/kaarten/rood-03-we-zijn-zo-druk-met-vandaag-dat-morgen-niet.webp",
    },
    {
      id: "rood-04",
      label: "Het protocol zegt nee zelfs als ja beter is.",
      image: "assets/images/kaarten/rood-04-het-protocol-zegt-nee-zelfs-als-ja-beter-is.webp",
    },
    {
      id: "rood-05",
      label: "Er wordt over ons besloten niet met ons.",
      image: "assets/images/kaarten/rood-05-er-wordt-over-ons-besloten-niet-met-ons.webp",
    },
    {
      id: "rood-06",
      label: "We hebben structuur genoeg, maar geen samenhang.",
      image: "assets/images/kaarten/rood-06-we-hebben-structuur-genoeg-geen-samenhang.webp",
    },
    {
      id: "rood-07",
      label: "We praten over cultuur maar leven de bijsluiter.",
      image: "assets/images/kaarten/rood-07-we-praten-over-cultuur-maar-leven-de.webp",
    },
    {
      id: "rood-08",
      label: "Dat is niet mijn probleem, zegt iedereen.",
      image: "assets/images/kaarten/rood-08-dat-is-niet-mijn-probleem-zegt-iedereen.webp",
    },
    {
      id: "rood-09",
      label: "Weerstand is hier makkelijker dan eerlijkheid.",
      image: "assets/images/kaarten/rood-09-weerstand-is-hier-makkelijker-dan-eerlijkheid.webp",
    },
    {
      id: "rood-10",
      label: "Iedereen knikt daarna gebeurt er niets.",
      image: "assets/images/kaarten/rood-10-iedereen-knikt-daarna-gebeurt-er-niets.webp",
    },
    {
      id: "rood-11",
      label: "We zijn te druk om echt te investeren in groei.",
      image: "assets/images/kaarten/rood-11-we-zijn-te-druk-om-echt-te-investeren-in.webp",
    },
    {
      id: "rood-12",
      label: "We rennen vooruit, maar niemand weet waarheen.",
      image: "assets/images/kaarten/rood-12-we-rennen-vooruit-niemand-weet-waarheen.webp",
    },
    {
      id: "rood-13",
      label: "Elke dag voelt als brandjes blussen.",
      image: "assets/images/kaarten/rood-13-elke-dag-voelt-als-brandjes-blussen.webp",
    },
    {
      id: "rood-14",
      label: "We nemen nooit de tijd om te kijken wat beter kan.",
      image: "assets/images/kaarten/rood-14-we-nemen-nooit-de-tijd-om-te-kijken-wat.webp",
    },
    {
      id: "rood-15",
      label: "Waarom moeten we dit eigenlijk anders doen?",
      image: "assets/images/kaarten/rood-15-waarom-moeten-we-dit-eigenlijk-anders-doen.webp",
    },
    {
      id: "rood-16",
      label: "Het lijkt alsof niemand zich eigenaar voelt van het resultaat.",
      image: "assets/images/kaarten/rood-16-het-lijkt-alsof-niemand-zich-eigenaar-voelt.webp",
    },
    {
      id: "rood-17",
      label: "Te veel regels, te weinig ruimte voor maatwerk.",
      image: "assets/images/kaarten/rood-17-te-veel-regels-te-weinig-ruimte-voor-maatwerk.webp",
    },
    {
      id: "rood-18",
      label: "We horen pas achteraf wat we hadden moeten weten.",
      image: "assets/images/kaarten/rood-18-we-horen-pas-achteraf-wat-we-hadden-moeten.webp",
    },
    {
      id: "rood-19",
      label: "We willen vertrouwen maar controleren voor de zekerheid.",
      image: "assets/images/kaarten/rood-19-we-willen-vertrouwen-maar-controleren-voor.webp",
    },
    {
      id: "rood-20",
      label: "Ontwikkelen mag als het maar niets kost.",
      image: "assets/images/kaarten/rood-20-ontwikkelen-mag-als-het-maar-niets-kost.webp",
    },
    {
      id: "rood-21",
      label: "Mijn talent wil verder, de begroting niet.",
      image: "assets/images/kaarten/rood-21-mijn-talent-wil-verder-de-begroting-niet.webp",
    },
    {
      id: "rood-22",
      label: "Ik wil best groeien maar niet alleen in mijn pauze.",
      image: "assets/images/kaarten/rood-22-ik-wil-best-groeien-maar-niet-alleen-in-mijn.webp",
    },
    {
      id: "rood-23",
      label: "Steeds hetzelfde doen en andere resultaten verwachten.",
      image: "assets/images/kaarten/rood-23-steeds-hetzelfde-doen-en-andere-resultaten.webp",
    },
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

  // Gate stap 1's "Volgende" on a kaart chosen and the description text set
  // (not mid-edit). A photo is optional — typing the description directly is
  // enough to continue; a photo is only needed if the user prefers that over
  // typing. If a photo *is* uploaded, its (mocked) OCR text overwrites
  // whatever was typed, handled in useMockPhoto/simulateAiReading below.
  function updateUploadNextState() {
    uploadNextBtn.disabled = !(kaartSelect.value && isTextSet());
  }

  // Warm the browser cache for every kaart image up front, so switching the
  // dropdown never shows a blank gap while the picked image is fetched.
  function preloadKaartImages() {
    KAART_OPTIONS.forEach((opt) => {
      if (opt.image) new Image().src = opt.image;
    });
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
    preloadKaartImages();

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
