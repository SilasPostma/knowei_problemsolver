# One-pager conversion — plan

## Goal

Turn the current three-screen wizard (Upload → Verbanden → Advies, switched via button clicks) into a single continuously scrolling page. Sections below the current one stay visible but locked, and unlock in place as the user completes what's above them, instead of the page swapping screens.

## What's already there

The three screens map almost exactly onto your seven steps already. Screen 1 covers steps 1–2: choosing a kaart, uploading the (mocked) photo, the AI-reading simulation, and keyword highlighting in the description. Screen 2 covers steps 3–5: it's already gated behind screen 1, already shows a loading state before the connections diagram renders, and already ends with the four-image complexity picker. Screen 3 covers steps 6–7: it's gated behind a complexity pick and renders the grouped advice cards. So this isn't a rebuild of the product — it's changing how the three sections sit on the page and how the gate between them behaves.

I checked knowei.nl directly, and it's worth noting it already scrolls this way itself: short narrative paragraphs revealed as you scroll, with a "SCROLL" cue at the top. That's a useful reference point, since it means a scroll-driven reveal is consistent with the brand's own site, not something we'd be bolting on. I also pulled the LeadBuddy source (`src/index.css`, `Themas.tsx`, `TopNav.tsx`) to confirm our CSS tokens, sticky top bar, square-cornered cards with a left accent border, and uppercase small-caps labels are already a faithful match — no styling changes needed for this phase, this is purely structural.

## What makes an unlock feel natural, not gimmicky

A few things came out of research into progressive disclosure and scroll-triggered reveals that I think should shape the implementation. First, locked sections should stay visible as a preview rather than disappearing entirely — showing a dimmed, non-interactive version of what's coming (or at minimum its heading) lets the user see the full shape of the journey up front, which reduces the "how much is left" anxiety that fully-hidden gating creates. Second, the unlock itself should never hijack scroll — the user always drives scrolling; the most JS should do is a gentle, short auto-scroll nudge toward the newly unlocked section once it appears, not force a jump. Third, because each of your three gates is a real task (finish the input, pick a complexity image) rather than passive reading, an explicit confirming action fits better than "you scrolled past it, therefore unlocked" — that matches what's already built (the disabled-until-ready buttons) and avoids accidentally unlocking a section because the user scrolled too far. Fourth, motion needs a `prefers-reduced-motion` fallback, and locked/unlocked state should live in the DOM as real markup (not content injected only after JS decides to reveal it), so nothing depends on an animation successfully firing. Fifth, the existing step indicator in the top bar is a good foundation for a progress cue through the page — it should track scroll position (which section is in view) and let the user click back up to a completed section, but not jump ahead to a locked one.

## Section structure

Section 1 (Upload) behaves as it does today — nothing about it is gated, keyword highlighting already happens live as you type. What changes is the end of it: instead of a "Volgende" button swapping to a new screen, completing the three inputs (kaart, photo, description set) unlocks Section 2 in place — the locked preview below it animates into its loading state and the page nudges down to it.

Section 2 (Verbanden) starts locked beneath Section 1: a dimmed card showing just the "Verbanden visualisatie" heading and a lock cue, so the user knows it's coming. Once unlocked it behaves exactly as today — loading state, then the diagram, then the complexity picker. Picking a complexity image is the gate for Section 3, same as today's disabled "Volgende" button.

Section 3 (Advies) starts locked beneath Section 2 the same way, and unlocks once a complexity image is picked, replaying the existing loading-then-cards sequence in place rather than after a screen switch.

The devtool tables (keyword table, concepts debug table) stay attached to their respective sections exactly as now — those are unaffected by the unlock mechanics.

## Code cleanup, since we're touching this anyway

`app.js` is currently 947 lines in one IIFE covering eight distinct concerns: screen/section navigation, the kaart dropdown, the devtool keyword table, the connections diagram (layout math, rendering, and click interaction all mixed together), the complexity picker, the advice screen, the description/highlight logic, and the mock photo upload plus reset. It's genuinely well-commented and not messy today, but it's grown into a single file doing everything, which is exactly the shape that turns into spaghetti once we start adding scroll-driven unlock logic on top. Since this refactor touches the navigation layer anyway, I want to split it into focused modules under `js/modules/`, following the same pattern `sheets.js` already uses (an IIFE exposing a small object on `window`): one module for the generic unlock/section-gate controller (reusable, not feature-specific), one for the upload section, one for the connections section, and one for the advice section, with `app.js` shrinking down to just wiring them together. No bundler needed — this stays plain `<script>` tags loaded in order, same as today.

You specifically flagged the connections chart code for review, and that's the right instinct — `buildConnectionsLayout` and its overlap-resolution pass (`resolveOverlaps`) are the most intricate part of the codebase: it place hubs and leaves on an arc, then runs up to 800 randomized relaxation passes to push overlapping circles apart. It's correct and already has good inline reasoning comments, but it's an O(n²)-per-pass algorithm with no early exit besides "nothing moved" — fine at the scale a handful of keywords and concepts produce, but worth pulling into its own module with its inputs and outputs clearly typed (plain data in, plain data out, no DOM), so it's easier to reason about and safe to unit-test later if the concept count ever grows.

## Two things I don't want to assume

You wrote step 1 as "Select Card + Enter text or upload video" — today it's a photo upload (mocked, always resolves to the same sample image), not video. I want to check whether that's a new requirement before I scope it in, since it changes what Section 1 needs to do.

I also want to confirm the locked-section treatment before building it: a dimmed preview card that shows the section's title and a short "ontgrendelt na stap X" note (my recommendation, based on the research above), versus something more minimal like just a greyed-out heading with no supporting copy.

## Proposed stages

Consistent with how we've been working, I'd do this in reviewable stages rather than one big change: first, extract `app.js` into modules with zero visual or behavioral change, so we can confirm the site still works identically before anything else moves; second, restructure the HTML/CSS into one continuous page with locked/unlocked visual states (still driven by the existing click-based gating, no scroll logic yet); third, add the scroll-position progress tracking and the unlock-animation-plus-nudge behavior on top; fourth, a polish pass covering `prefers-reduced-motion`, mobile widths, and focus handling when a section unlocks. I'd pause for your review after each stage rather than pushing straight through.
