# 09: Play Place the note

**What to build:** The second mode: the player sees a note name on a prompt card and places it on the empty staff, by mouse, touch or keyboard, in Practice or a Round, with the same feedback, scoring, saving and stats as Name mode. See spec "Place the note", "Scoring" (touch window), "Feedback and sound" (Place rows, preview sound), Decisions D8, D9, D13, D20–D22.

**Blocked by:** 08

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A prompt card above the staff shows the note in the current naming, with the octave only when strict octave is on
- [ ] The notehead can go anywhere in the visible area regardless of range preset
- [ ] Mouse: ghost follows the pointer and a click commits. Touch: tap places a provisional notehead, drag or the up/down buttons adjust it, Confirm commits. Keyboard: arrows move, Enter commits
- [ ] Up/down and Confirm buttons sit in thumb reach, at least 44 × 44 px, shown per D20; Confirm is disabled until a notehead is placed
- [ ] Correctness follows strict octave on/off; the attempt stores the placed canonical note as the answer
- [ ] Feedback: correct → placed notehead green + check; wrong → placed notehead red + cross and the correct note shown in green; text and screen-reader announcement as in Name mode
- [ ] Sound: plays the placed note; when wrong, the correct note about 400 ms later; with preview sound on, each step change plays its note
- [ ] Attempts committed with Confirm use the shifted speed-bonus window (D13)
- [ ] Component tests cover the keyboard path, the Confirm flow, strict on/off correctness, wrong-answer feedback and sound calls, and preview sound

## Files likely touched

`_components/game-screen.tsx`, `_components/place-controls.tsx`, `_components/prompt-card.tsx`, the session hook, tests

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
