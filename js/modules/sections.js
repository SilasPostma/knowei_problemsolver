/*
 * Generic section unlock/gate controller for the one-page layout. Not tied
 * to upload/connections/advice specifics — app.js decides *when* a section
 * unlocks (a "Volgende" click), this module only knows *how*: reveal the
 * section's content and keep the top-bar step indicator in sync. Unlocking
 * never moves the viewport — the user is already looking at the section
 * they just finished, so "Volgende" only reveals what comes next in place;
 * scrolling stays reserved for explicit navigation ("Terug", clicking a
 * step in the top bar). Locked/unlocked state starts out correct in the raw
 * HTML (`.onepage-section.is-locked` + `.section-content[hidden]`) so
 * nothing here is required for the page to render in a sane resting state.
 *
 * Public interface used by app.js:
 *  - init()                     puts sections/steps in sync, wires the step nav
 *  - unlock(num)                 reveals section `num` in place if still locked
 *                                — no scrolling, no focus change
 *  - lockFrom(num)               re-locks section `num` and everything after it
 *  - scrollToSection(num)        smooth-scrolls to a section without touching
 *                                its lock state (used by "Terug" and step nav)
 *  - scrollToSectionIfNeeded(num) same smooth scroll, but only if the section
 *                                isn't already substantially in view — used
 *                                after "Volgende" so newly-revealed content
 *                                below the fold gets a gentle nudge into
 *                                view, without yanking the page around when
 *                                the user can already see it.
 */
window.KnoweiSections = (function () {
  let sections = []; // { el, num, lockEl, contentEl, locked }
  let stepEls;
  let unlockedUpTo = 1;
  let observer;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function findSection(num) {
    return sections.find((s) => s.num === num);
  }

  function updateSteps() {
    stepEls.forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle('is-locked', n > unlockedUpTo);
    });
  }

  function activateStep(num) {
    stepEls.forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle('is-active', n === num);
      el.classList.toggle('is-done', n < num);
    });
  }

  // Only advances the active/done highlight when the section actually in
  // view is unlocked — scrolling a locked section's heading into view (the
  // page intentionally lets you preview it) must never make it look "active".
  function setActiveFromScroll(num) {
    const target = findSection(num);
    if (!target || target.locked) return;
    activateStep(num);
  }

  // Every caller here only ever targets an already-unlocked section, so the
  // active step is set immediately rather than waiting on the
  // IntersectionObserver — the last section in particular may not have
  // enough room below it to scroll fully into the observer's band.
  function scrollToSection(num) {
    const target = findSection(num);
    if (!target) return;
    target.el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    activateStep(num);
  }

  // A section counts as "already in view" once its heading has scrolled
  // past the sticky top bar and its body still has meaningful room left in
  // the viewport — matches the sticky offset sections already scroll-margin
  // for (see `.onepage-section { scroll-margin-top }` in css/styles.css).
  const STICKY_TOP_OFFSET = 88; // ~5.5rem, keep in sync with scroll-margin-top
  const MIN_VISIBLE_PX = 160;

  function isSubstantiallyInView(el) {
    const rect = el.getBoundingClientRect();
    return rect.top <= STICKY_TOP_OFFSET + 40 && rect.top > -rect.height + MIN_VISIBLE_PX;
  }

  function scrollToSectionIfNeeded(num) {
    const target = findSection(num);
    if (!target) return;
    if (isSubstantiallyInView(target.el)) {
      activateStep(num);
      return;
    }
    scrollToSection(num);
  }

  // Purely a reveal — no scroll, no focus change. The user stays exactly
  // where they are; the newly unlocked section fades in below/beside
  // whatever they're already looking at.
  function unlock(num) {
    const target = findSection(num);
    if (!target || !target.locked) return;

    target.locked = false;
    target.el.classList.remove('is-locked');
    if (target.lockEl) target.lockEl.hidden = true;
    target.contentEl.hidden = false;
    unlockedUpTo = Math.max(unlockedUpTo, num);
    updateSteps();
  }

  function lockFrom(num) {
    sections.forEach((s) => {
      if (s.num < num) return;
      s.locked = true;
      s.el.classList.add('is-locked');
      if (s.lockEl) s.lockEl.hidden = false;
      s.contentEl.hidden = true;
    });
    unlockedUpTo = num - 1;
    updateSteps();
    activateStep(1);
  }

  function init() {
    sections = Array.from(document.querySelectorAll('.onepage-section')).map((el) => ({
      el,
      num: Number(el.dataset.section),
      lockEl: el.querySelector('.section-lock'),
      contentEl: el.querySelector('.section-content'),
      locked: el.classList.contains('is-locked'),
    }));
    unlockedUpTo = sections.filter((s) => !s.locked).reduce((max, s) => Math.max(max, s.num), 1);

    stepEls = document.querySelectorAll('.step');
    stepEls.forEach((el) => {
      el.addEventListener('click', () => {
        const n = Number(el.dataset.step);
        if (n <= unlockedUpTo) scrollToSection(n);
      });
    });
    updateSteps();

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveFromScroll(Number(entry.target.dataset.section));
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s.el));
  }

  return {
    init,
    unlock,
    lockFrom,
    scrollToSection,
    scrollToSectionIfNeeded,
  };
})();
