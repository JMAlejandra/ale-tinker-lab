# 02: Notes, staff positions and shared types

**What to build:** The pure note-theory core every other part builds on: canonical notes, where each note sits on the staff for each clef, which notes each range preset contains, and how notes are named for the player. Also the shared domain and entity types (settings, session, attempt, profile) so later tickets can work in parallel. Built test-first. See spec "Concepts and terminology", "Settings", "Persistence and data model → Entities", Decisions D1, D7, D9.

**Blocked by:** 01

**Status:** done

## Acceptance criteria

- [ ] Module `src/modules/staff-reading-game/` exists with a barrel `index.ts` exporting only the public surface
- [ ] Types for: letter, canonical note (letter + octave, e.g. `G4`), clef, mode, session type, range preset, note naming, and the four entities (LocalProfile, Settings, Session, Attempt) with exactly the spec's fields; default settings constant matches the Settings table
- [ ] Parse and format canonical notes; invalid strings are rejected
- [ ] Note ↔ step for each clef, step 0 = bottom line (E4 treble, G2 bass); top line is step 8 (F5, A3)
- [ ] Visible area is steps −4..12 (A3–C6 treble, C2–E4 bass); a helper clamps any step into it (snap for out-of-range placement)
- [ ] Ledger lines needed for a step are computed (none on the staff; e.g. C4 treble → one below; A3 → two below; C6 → two above)
- [ ] Every range preset returns exactly the notes in the spec table for both clefs, low to high
- [ ] Display name by naming: letters or Spanish solfège (C=Do … B=Si), with or without octave (`G`, `G4`, `Sol`, `Sol4`)
- [ ] Note → MIDI number and frequency (A4 = 440 Hz) for the audio engine
- [ ] Letters in scale order C D E F G A B are exported for the answer buttons
- [ ] Unit tests cover all of the above, including both clefs' boundaries

## Files likely touched

`src/modules/staff-reading-game/index.ts`, `staff-reading-game.types.ts`, `staff-reading-game.notes.ts`, `__tests__/staff-reading-game.notes.test.ts`

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
