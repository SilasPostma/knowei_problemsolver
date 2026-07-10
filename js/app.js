/*
 * Page wiring only. Each section's own behavior lives in its module
 * (js/modules/upload.js, connections.js, advice.js); the generic unlock/
 * scroll/step-indicator mechanics live in js/modules/sections.js. This file
 * just connects them: which module to (re)render when a section unlocks,
 * and resetting all of them together on restart.
 */
(function () {
  document.getElementById('upload-next').addEventListener('click', () => {
    window.KnoweiConnections.render(window.KnoweiUpload.getKeywordRows());
    window.KnoweiSections.unlock(2);
  });

  document.getElementById('verbanden-next').addEventListener('click', () => {
    window.KnoweiAdvice.render(window.KnoweiUpload.getKeywordRows(), window.KnoweiConnections.getSelectedComplexity());
    window.KnoweiSections.unlock(3);
  });

  // "Terug" only scrolls — sections already stay unlocked once reached, so
  // going back never needs to touch lock state.
  document.querySelectorAll('[data-prev]').forEach((btn) => {
    btn.addEventListener('click', () => window.KnoweiSections.scrollToSection(Number(btn.dataset.prev)));
  });

  document.getElementById('restart').addEventListener('click', () => {
    window.KnoweiUpload.reset();
    window.KnoweiConnections.reset();
    window.KnoweiSections.lockFrom(2);
    window.KnoweiSections.scrollToSection(1);
  });

  window.KnoweiUpload.init();
  window.KnoweiConnections.init();
  window.KnoweiAdvice.init();
  window.KnoweiSections.init();
})();
