# Staff Reading Game — Functional Spec (v1)

Nov 13, 2026 · Alejandra

## Overview

A mobile-first game inside ale-tinker-lab that trains reading notes on a musical staff, through two modes: place a named note on the staff, or name a note shown on the staff.

The target player is a beginner learning to read treble and bass clef. The game must work well on a portrait phone first and scale up to desktop. It runs without accounts in v1, but its data model is designed so that adding auth later does not require a redesign.

This spec describes behavior. Technical choices are collected at the end as starting points, not requirements.

## Scope

v1 ships both modes, two session types, scoring, sound and local progress; the piano keyboard input follows in v1.1.

| Release | Included |
| --- | --- |
| v1 | Place the note and Name the note modes; Practice and 20-note Round sessions; treble or bass clef; range presets; letter or solfège note names; scoring with speed bonus and streaks; re-queue of missed notes; piano sound; end screen; progress saved locally in an auth-ready shape |
| v1.1 | On-screen piano keyboard as an answer input (one octave on phones) |
| Later | Grand staff (both clefs mixed); stats screen with per-note history; adaptive note selection weighted by past errors; sprint session (60 seconds); accidentals; Web MIDI input from a real keyboard; database sync once auth exists |
| Out of scope | Rhythm, key signatures, multi-note chords, multiplayer or public leaderboards |

## Concepts and terminology

These terms are used throughout the spec, the UI and the code.

| Term | Meaning |
| --- | --- |
| Staff | The five horizontal lines notes are placed on. Never "pentagram" in UI or code. |
| Clef | Treble (bottom line E4, top line F5) or bass (bottom line G2, top line A3). |
| Step | One move from a line to the adjacent space or vice versa; the unit of vertical position. |
| Ledger line | Short line drawn for notes above or below the staff. |
| Visible area | The staff plus 2 ledger lines above and below. Treble: A3–C6. Bass: C2–E4. |
| Canonical note | Letter plus octave in scientific pitch notation (G4). Always stored this way, regardless of display naming. |
| Note naming | How notes are shown to the player: letters (C D E F G A B) or Spanish solfège (Do Re Mi Fa Sol La Si). |
| Prompt | One note the player must answer. |
| Commit | The moment an answer becomes final (click, Confirm tap, button press). |
| Session | One continuous play period: a Practice session or a Round. |
| Attempt | One answered prompt, with its result and timing. |
| Streak | Number of consecutive correct answers in the current session. |

## Settings

Settings are chosen on the setup screen, remembered between visits, and locked while a session is running.

| Setting | Options | Default |
| --- | --- | --- |
| Mode | Place the note, Name the note | Name the note |
| Session type | Practice, Round | Practice |
| Clef | Treble, Bass | Treble |
| Range preset | See table below | Full staff |
| Note naming | Letters, Solfège | Letters |
| Strict octave (Place mode only) | On, Off | Off |
| Sound | On, Off | On |
| Preview sound while placing (Place mode only) | On, Off | Off |

Range presets decide which notes can be prompted. They follow the usual teaching order.

| Preset | Treble notes | Bass notes |
| --- | --- | --- |
| Landmarks | C4, G4, C5 | C3, F3, C4 |
| Lines | E4, G4, B4, D5, F5 | G2, B2, D3, F3, A3 |
| Spaces | F4, A4, C5, E5 | A2, C3, E3, G3 |
| Full staff | E4–F5 | G2–A3 |
| Extended | A3–C6 (staff + 2 ledger lines each side) | C2–E4 (staff + 2 ledger lines each side) |

Solfège maps C=Do, D=Re, E=Mi, F=Fa, G=Sol, A=La, B=Si.

## Game modes

Both modes show one prompt at a time and give feedback after every commit.

### Place the note

The player sees a note name and places it on an empty staff.

1. A prompt card above the staff shows the note in the current naming ("G" or "Sol"). With strict octave on, it includes the octave ("G4" or "Sol4").
2. The player positions a notehead anywhere in the visible area, regardless of range preset, so the range never hints at the answer. The notehead snaps to the nearest line or space, and ledger lines appear as needed.
3. Input differs by device:
   - Mouse or trackpad: a translucent ghost notehead follows the pointer; a click commits.
   - Touch: a tap places a provisional notehead. The player adjusts it by dragging or with up/down buttons, then taps Confirm to commit.
   - Keyboard: up/down arrows move the notehead one step; Enter commits.
4. Correctness: with strict octave off, any position whose letter matches the prompt is correct. With strict octave on, only the exact pitch is correct.

### Name the note

The player sees a note on the staff and picks its name.

1. The staff shows one notehead (with ledger lines if needed) drawn from the active range preset.
2. Below the staff, seven answer buttons appear in scale order: C D E F G A B, or Do Re Mi Fa Sol La Si.
3. A tap or click on a button commits. On keyboards, letter keys C–B and number keys 1–7 also commit.
4. Correctness: the chosen letter matches the shown note's letter. Octave is irrelevant in this mode.

## Session types

Practice is endless and unscored; a Round is 20 new prompts plus any re-queued misses, and scored.

|  | Practice | Round |
| --- | --- | --- |
| Length | Until the player exits | 20 new prompts, plus one extra prompt per re-queued miss |
| Score shown | No | Yes, live and on the end screen |
| Shown during play | Streak, notes answered, running accuracy | Progress (7/20), score, streak |
| Re-queue of misses | Yes | Yes |
| On finish | Exit shows a short summary: notes answered, accuracy | End screen (see Screens) |
| Saved | Yes, as a session with its attempts | Yes, as a session with its attempts |
| Counts for personal best | No | Yes, if completed |

The player can exit a Round early. An exited Round is saved as incomplete, shows no end screen, and never counts for personal best.

## Note selection and re-queue

Prompts are random within the range preset, never the same note twice in a row, and every miss comes back 3–5 prompts later.

- Each new prompt is drawn uniformly from the preset's notes, excluding the note just shown.
- In Place mode with strict octave off, the prompt is a letter, so selection is by letter across the preset (any octave satisfies it).
- On a miss, the same note is inserted as an extra prompt 3–5 positions ahead (random within that window). In a Round, it adds to the 20 new prompts rather than replacing one.
- If fewer than 3 prompts remain in a Round, the missed note is appended at the end, including after a miss on the final prompt. The Round ends once every prompt, re-queued ones included, has been answered.
- A re-queued note that is missed again is re-queued again by the same rule, up to 2 re-queues per note per Round.
- If a re-queued note would land right after the same note, it shifts one position later.

## Scoring (Round only)

A correct answer earns 100 points plus a speed bonus of up to 50, multiplied by the streak multiplier; a wrong answer earns 0.

```math
\text{points} = \operatorname{round}\Big( \big(100 + 50 \cdot \operatorname{clamp}\big(\tfrac{5 - t}{4}, 0, 1\big)\big) \cdot m \Big)
```

Here t is the response time in seconds and m is the streak multiplier. The full bonus applies at 1 second or faster and reaches 0 at 5 seconds. In Place mode on touch devices, where the Confirm tap adds time, the window shifts by 1 second: full bonus up to 2 seconds, 0 at 6 seconds.

| Streak including this answer | Multiplier m |
| --- | --- |
| 1–4 | ×1 |
| 5–9 | ×1.5 |
| 10+ | ×2 |

- A wrong answer scores 0, resets the streak to 0, and is never negative. Re-queued prompts award no points but update the streak normally, so an early miss is never free.
- Response time starts when the prompt is displayed and input is enabled, and stops at commit. It pauses while the page is hidden (tab switch, phone locked).
- Accuracy = correct first answers on the 20 new prompts ÷ 20, shown as a count and a percentage. Re-queued prompts do not count toward accuracy.
- Average response time is the mean over all attempts, re-queued ones included.
- The maximum possible Round score is 5,025 (20 correct, all under 1 second).

## Feedback and sound

Every commit gets visual and audio feedback, then the game advances on its own; input is ignored during feedback.

|  | Correct | Wrong |
| --- | --- | --- |
| Visual | Notehead or button turns green with a check icon | Player's answer turns red with a cross icon; the correct answer appears in green |
| Place mode sound | Plays the placed note | Plays the placed note, then the correct note after about 400 ms |
| Name mode sound | Plays the shown note | Plays the shown note |
| Duration before next prompt | About 600 ms | About 1,200 ms |
| Effect | Streak +1, points awarded | Streak reset, note re-queued |

- In Name mode, sound plays only after the answer, never before, so pitch cannot give the answer away.
- With "Preview sound while placing" on, Place mode plays each note as the notehead moves to a new step.
- A mute toggle is available on the game screen at all times and updates the Sound setting.
- Sound loads in the background. Until it is ready, the game is fully playable and either silent or using a basic synthesized tone. The game never waits for sound to load.
- Audio is unlocked by the Start button press (browsers require a user gesture before playing sound).
- On iPhone, a one-time hint explains that the silent switch mutes the game.

## Screens

Three screens: setup, game and end. All are laid out for a portrait phone first.

### Setup screen

- Two large cards to pick the mode, then a Practice/Round switch.
- Clef, range preset, note naming, strict octave (Place mode only), sound and preview sound.
- The personal best Round score for the current mode, clef and range preset, if one exists.
- A Start button, which also unlocks audio.

### Game screen

- Top bar: progress (Round) or notes answered (Practice), score (Round), streak, mute toggle, exit.
- Center: the staff at full width, with the clef drawn. In Place mode, the prompt card sits above the staff.
- Bottom, in thumb reach: the seven answer buttons (Name mode), or the up/down and Confirm buttons (Place mode on touch).

### End screen (completed Round)

- Score, with a "New personal best" badge when it beats the stored best for the same mode, clef and range preset.
- Accuracy (count and percentage), average response time, best streak.
- The staff redrawn with every note prompted in the Round, each colored by result: green if always correct, amber if mixed, red if always missed.
- Actions: Play again (same settings), Change settings.

## Game states

A session loops between Prompting and Feedback until a Round's last prompt is answered or the player exits.

> Diagram: game states (5 states, one session loop). The diagram lives in the original Docs artifact and was not included in this export.

Input is locked during Feedback. Practice only leaves the loop through exit; a Round leaves after its last prompt, re-queues included, or through exit.

## Persistence and data model

v1 stores everything in the browser, in records shaped exactly like the future database tables, so adding auth means adding a sync step, not redesigning data.

### Principles

- Every record has a client-generated UUID, so local records can later be inserted into the database without ID conflicts, and repeated uploads are safe.
- Every top-level record carries an `ownerId`. In v1 this is a local profile ID generated on first visit. After auth, it maps to the user's account.
- Notes are always stored as canonical notes (G4) plus clef, never as display names.
- Timestamps are ISO 8601 in UTC.
- Stored data has a schema version, so future changes can migrate old data instead of discarding it.
- All reads and writes go through one progress-storage interface. v1 implements it with browser storage; a later implementation talks to the server. Game logic never touches storage directly.
- Individual attempts are stored, not only session totals, so per-note stats and adaptive selection are possible later without new data.

### Entities

| Entity | Fields |
| --- | --- |
| LocalProfile | id, createdAt, linkedUserId (null until auth) |
| Settings | ownerId, mode, sessionType, clef, rangePreset, noteNaming, strictOctave, soundOn, previewSound, updatedAt |
| Session | id, ownerId, mode, sessionType, clef, rangePreset, strictOctave, startedAt, endedAt, completed, score (null for Practice), correctCount, totalCount, bestStreak, syncedAt (null in v1) |
| Attempt | id, sessionId, ownerId, position, targetNote, clef, answer, isCorrect, responseMs, points, streakAfter, wasRequeued, answeredAt, syncedAt (null in v1) |

Personal bests are computed from completed Round sessions, not stored separately.

### Retention

Keep at most the 1,000 most recent attempts; when trimming, remove whole sessions, oldest first. Needing more history than that is the signal to move progress to the database.

### When auth arrives

1. Add `session` and `attempt` tables (and optionally `settings`) mirroring the entities above.
2. On first sign-in, upload all records with `syncedAt` null, mapping the local profile to the user. Uploads are idempotent because IDs are UUIDs.
3. Mark uploaded records as synced and set `linkedUserId` on the local profile.
4. Switch the progress-storage implementation to the server version. The game itself does not change.

## Mobile and accessibility

The game must be fully playable one-handed on a 320 px-wide portrait phone and by keyboard alone on desktop.

- Works from 320 px wide; portrait is the primary layout, landscape is supported.
- All tap targets are at least 44 × 44 px. The seven answer buttons fit in one row at 360 px.
- Staff line spacing is at least 24 px on phones, so the visible area fits on screen.
- Interacting with the staff never scrolls or zooms the page; double-tapping a button never zooms.
- Touch devices use the tap, adjust, Confirm flow in Place mode; mouse devices commit on click.
- Every action has a keyboard path: arrows and Enter in Place mode, letter or number keys in Name mode, Escape to exit a session.
- Correct and wrong are shown with an icon and text as well as color.
- Results are announced to screen readers (for example "Correct, G" or "Wrong, it was E").
- Rotating the device mid-session keeps all game state.

## Edge cases

The game keeps working in every case below; at worst, progress is not saved.

| Situation | Expected behavior |
| --- | --- |
| Sound samples not loaded yet | Game plays normally, silent or with a basic tone |
| Audio blocked or iPhone silent switch on | Game plays normally; one-time hint about the silent switch |
| Repeated taps or clicks during feedback | Ignored |
| Page hidden during a prompt | Response timer pauses and resumes on return |
| Player exits mid-Round | Saved as incomplete; no end screen; not eligible for personal best |
| Browser closed mid-Round | Attempts already answered are saved; the session is saved as incomplete |
| Browser storage unavailable (private mode) or full | Game plays normally; a subtle notice says progress is not being saved |
| Stored data from an older schema version | Migrated; if migration fails, that data is reset without breaking the game |
| Device rotated mid-session | Layout reflows; state is preserved |
| Placement attempted outside the visible area | Snaps to the nearest valid step |
| Miss on the final prompt of a Round | Re-queued as an extra prompt at the end of the Round |

## Open questions

One value is still proposed and not yet confirmed.

- [x] Feedback timings (600 ms correct, 1,200 ms wrong): confirm after first playtest.

## Technical choices (non-binding)

These choices came out of planning and are recorded so they don't have to be rediscovered. None is mandatory: if a better option exists, use it and note why.

| Area | Starting point | Why |
| --- | --- | --- |
| App | Client component inside the existing ale-tinker-lab Next.js (T3) app | The game is fully client-side in v1 |
| Staff rendering | Custom React SVG component, scaled with a viewBox | Notation libraries (VexFlow, abcjs) suit full scores, but fight a single draggable, snapping note |
| Clef glyphs | Treble and bass clef paths copied from the Bravura font (SMuFL, SIL Open Font License) into inline SVG | Avoids font loading and baseline positioning issues |
| Interaction | Pointer events on the SVG, with touch-action disabled on the staff | One API covers mouse, touch and pen |
| Game logic | Pure functions plus a reducer for game state (note ↔ position mapping, note selection, re-queue, scoring) | Easy to test without a DOM or audio |
| Stateful services | Classes are fine where they fit, for example the audio engine and the progress-storage implementations | No hard rule on functional versus class style |
| Sound | Tone.js Sampler with a subset of the Salamander grand piano samples (about one every 3 semitones across the range), self-hosted in /public, loaded lazily after Start | Tone fills in between samples; small download on mobile data |
| Note theory | Hand-rolled helpers in v1; consider the tonal library when accidentals arrive | No accidentals means trivial conversions |
| Persistence | Browser storage behind a progress-storage interface; later, Drizzle tables in the existing Neon database via tRPC, using the `ale_tinker_lab_` table prefix | Matches the auth-ready data model |
| Unit tests | Whatever runner the repo already uses; Vitest if none (Jest is also acceptable) | Covers game logic, especially note ↔ position mapping, re-queue and scoring |
| UI tests | React Testing Library with user-event | Covers setup, Name mode buttons, keyboard paths and the end screen |
| End-to-end tests (later) | Playwright, including mobile device emulation | Drag and touch interactions are hard to test in a simulated DOM |
