# 08: Play Name the note: Practice and Round sessions

**What to build:** The first fully playable game: from Start, the player names notes shown on the staff in a Practice session or a 20-note Round, with feedback, sound, live stats, re-queued misses, and progress saved. This wires the session engine, staff, audio and storage together in the game screen. A completed Round may land on a minimal placeholder end state (ticket 10 builds the real end screen). See spec "Name the note", "Session types", "Feedback and sound", "Screens → Game screen", "Mobile and accessibility", "Edge cases", Decisions D14, D17–D19.

**Blocked by:** 03, 05, 06, 07

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Start unlocks audio, begins loading samples and starts a session with the chosen settings; settings are locked while it runs
- [ ] The staff shows one notehead from the range preset; seven answer buttons in scale order use the current naming and fit one row at 360 px, each at least 44 × 44 px, in thumb reach
- [ ] Tap/click commits; keys C D E F G A B and 1–7 also commit; Escape exits
- [ ] Feedback: correct → green + check icon + text; wrong → the chosen button red + cross, the correct one green; then the game advances by itself after about 600 ms / 1,200 ms; input during feedback is ignored
- [ ] Sound: the shown note plays only after the answer; the mute toggle works at any time and updates the Sound setting
- [ ] Top bar: Round shows progress (n/20), score and streak; Practice shows notes answered, running accuracy and streak; plus mute and exit
- [ ] Results are announced to screen readers ("Correct, G" / "Wrong, it was E") in the current naming
- [ ] Response time pauses while the page is hidden
- [ ] Persistence: the session is saved at start, every attempt at commit, and the session again at the end; exiting a Round saves it as incomplete and returns to setup; exiting Practice shows a short summary (notes answered, accuracy) with a way back to setup
- [ ] A one-time hint about the silent switch is shown on iPhone
- [ ] Double-tapping buttons never zooms; rotating or resizing keeps all game state
- [ ] Component tests cover a correct and a wrong answer, keyboard paths, input lock during feedback, Round completion, exit paths, and the storage calls (fake timers, fake audio, fake storage)

## Files likely touched

`_components/staff-reading-game.tsx` (shell), `_components/game-screen.tsx`, `_components/answer-buttons.tsx`, `_components/top-bar.tsx`, `_components/practice-summary.tsx`, a session hook beside them, tests

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
