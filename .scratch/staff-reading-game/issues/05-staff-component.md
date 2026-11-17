# 05: Staff component: drawing and note placement

**What to build:** A reusable SVG staff that draws the clef, the five lines and any number of noteheads with ledger lines and result styling, and that can be used as an input: the player moves a notehead that snaps to lines and spaces by mouse, touch or keyboard. It holds no game rules; it reports steps. See spec "Place the note" steps 2–3, "Mobile and accessibility", "Technical choices" (staff rendering, clef glyphs, interaction), Decisions D7, D20–D22.

**Blocked by:** 02

**Status:** done

## Acceptance criteria

- [ ] Draws treble or bass clef using the Bravura paths (provided in the brief) as inline SVG, with the OFL attribution in a comment
- [ ] Draws noteheads at given steps with correct ledger lines; each notehead can be neutral, ghost (translucent), correct (green + check icon), wrong (red + cross icon), or amber; several noteheads can be laid out left to right (for the end screen)
- [ ] At 320 px wide the staff line spacing is at least 24 px and the whole visible area (steps −4..12) fits; it scales up on wider screens to a sensible maximum
- [ ] Interactive mode — mouse: a ghost follows the pointer, snapped; a click reports a commit at that step
- [ ] Interactive mode — touch/pen: a tap places a provisional notehead and dragging moves it; no commit is reported from the staff itself
- [ ] Interactive mode — keyboard: the staff is focusable; up/down arrows move the notehead one step (first press starts on the middle line); Enter reports a commit when a notehead exists
- [ ] Positions outside the visible area snap to the nearest valid step; a step-change callback fires once per new step (for preview sound)
- [ ] `touch-action: none` on the staff so interacting never scrolls or zooms the page; interaction can be disabled (input lock during feedback)
- [ ] The staff has an accessible name describing what is shown when it is display-only (e.g. the Name-mode notehead is NOT named by letter, so screen readers cannot leak the answer)
- [ ] Component tests (jsdom) cover rendering of ledger lines and states, keyboard movement/commit, and disabled mode; pointer→step conversion is a pure function with unit tests

## Files likely touched

`src/app/staff-reading-game/_components/staff.tsx`, `clef-glyphs.ts` (or similar) beside it, a pure geometry helper in the module or beside the component, tests beside them

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
