# Staff Reading Game

Status: experimental · Last updated: 2026-11-15

A mobile-first Experiment at `/staff-reading-game` that trains reading notes on a treble or bass staff, by placing a named note or naming a shown note. It runs entirely in the browser, without accounts.

## What it does

Route `/staff-reading-game` (`src/app/staff-reading-game/page.tsx`), linked from the home page. Three screens: setup, game, and end (plus a short Practice summary).

**Modes.** Name the note (default): one note on the staff, seven answer buttons in scale order (C D E F G A B or Do Re Mi Fa Sol La Si). Place the note: a prompt card shows a note name and the player puts a notehead on an empty staff.

**Session types.** Practice is endless and unscored; exiting shows a summary (notes answered, accuracy on first-time prompts). A Round is 20 new prompts plus re-queued misses, scored; it ends on an end screen.

**Settings** (setup screen, remembered, locked during play): mode, session type ("Round (20 notes)"), clef, range preset (Landmarks, Lines, Spaces, Full staff, Extended), note naming, strict octave (Place only), sound, preview sound while placing (Place only). Defaults are `DEFAULT_SETTINGS`: name, practice, treble, full-staff, letters, strict octave off, sound on, preview off. The setup screen also shows the personal best for the chosen mode, clef and range preset, and a notice when progress is not being saved.

**Prompts.** Drawn uniformly from the preset, never the same prompt twice in a row. A miss is re-queued as the 3rd to 5th prompt after it (at the end of a Round if fewer remain). A Round re-queues a note at most twice (Practice has no cap). A re-queued prompt shows a "Review" marker, awards no points, and does not advance Round progress. Place mode with strict octave off prompts a letter; any octave of it is correct.

**Scoring (Round only).** Correct: `round((100 + speed bonus) × multiplier)`. Speed bonus is 50 up to 1 s, falling linearly to 0 at 5 s; a commit via Confirm shifts that window by 1 s. Multiplier by streak including the answer: ×1 (1-4), ×1.5 (5-9), ×2 (10+). Wrong: 0 and the streak resets. Practice stores `points: 0`. Response time pauses while the page is hidden.

**Feedback and sound.** After each commit, input is locked and the game advances itself: 600 ms after a correct answer, 1,200 ms after a wrong one (`FEEDBACK_CORRECT_MS`, `FEEDBACK_WRONG_MS`). Correct is green with a check, wrong is red with a cross, and a live region announces "Correct, G" or "Wrong, it was E". Name mode plays the shown note after the answer only. Place mode plays the placed note, and after a miss the correct note 400 ms later (`WRONG_NOTE_SOUND_DELAY_MS`). A mute toggle in the top bar updates the Sound setting. On iPhone, a one-time hint says the silent switch mutes the game.

**End screen (completed Round).** Score, a "New personal best" badge (strictly higher than the previous best for the same key, or no previous best; otherwise "Personal best: N" quietly), accuracy (count and percent), average response, best streak, and a compact staff of every prompted note: green always correct, amber (tilde) mixed, red always missed. Actions: Play again, Change settings. An exited Round is saved as incomplete and goes straight back to setup.

**Place input.** Chosen per interaction by pointer type. Mouse: a ghost notehead follows the pointer, press and release on the staff commits. Touch and pen: tap places a provisional notehead, drag or the up/down buttons adjust it, Confirm commits. The buttons show on coarse-pointer devices and after any touch, pen or keyboard placement. Keyboard: ArrowUp/ArrowDown anywhere on the game screen (first press lands on the middle line), Enter on the staff commits.

**Keyboard paths.** Name mode: letter keys C-B and number keys 1-7 (also with Shift held and by physical `Digit1`-`Digit7`, for AZERTY). Escape exits from the game screen. Shortcuts ignore Ctrl/Alt/Meta, key repeat and text fields (`game-keys.ts`). Focus moves to the screen heading on every screen change after the first Start.

## How it works

Logic lives in `src/modules/staff-reading-game/` (client-side, no Drizzle). Import only through the barrel `index.ts`. Parts, all named `staff-reading-game.<part>.ts`:

- `types`: `GameSettings`, `DEFAULT_SETTINGS`, `Session`, `Attempt`, `LocalProfile`, `Settings`, and the option lists (`CLEFS`, `MODES`, `RANGE_PRESETS`, ...).
- `notes`: step numbering (0 is the clef's bottom line, visible area is steps -4 to 12), note and step conversion, ledger line steps, range preset notes, display names, MIDI and frequency.
- `queue`: draw of new prompts, re-queue insertion, and the "never repeat" slot choice. Pure.
- `scoring`: `speedBonus`, `streakMultiplier`, `pointsFor`.
- `session`: `sessionReducer` and the selectors. States: `setup`, `prompting`, `feedback`, `summary` (Practice exited), `ended` (Round completed).
- `timer`: `ResponseTimer`, a pausable clock with an injected `now`.
- `validators`: Zod schemas of the stored document and `migrate`.
- `storage`: the `ProgressStorage` interface and the browser implementation.
- `audio`: the Web Audio engine.

**Session reducer.** Actions are `start`, `answer`, `advance`, `exit`. Randomness never enters the reducer: the action creators `startAction(settings, rng)`, `answerAction(input, rng)` and `advanceAction(rng)` call the injected `rng` and put the values (`draw`, `requeueRoll`) in the action, so the reducer is deterministic and tests pass a stub. An Attempt stores `answer` as the chosen letter (Name) or the placed canonical note (Place).

**Controller.** `useGameSession` (`_components/use-game-session.ts`) wraps a plain `createController` object that runs the reducer and every side effect from the event that caused it (so StrictMode never repeats one): response timer, feedback pause, sound, and saving. It writes the Session at start (`completed: false`), each Attempt at commit, and the Session again at the end, through one ordered promise chain. Storage and audio failures never reach the game. `whenSaved()` lets the shell wait for the last write before reading the personal best. Unmounting stops timers; a Round in the feedback of its last prompt is finished as completed.

**Progress storage.** `ProgressStorage` is asynchronous so a server version can replace the browser one. `createBrowserProgressStorage()` keeps one versioned document (`schemaVersion: 1`: profile, settings, sessions, attempts) in `localStorage` under `ale-tinker-lab:staff-reading-game:progress` (`PROGRESS_STORAGE_KEY`), validated on load; a document that fails validation is reset whole. One-time hint flags use a separate key, `ale-tinker-lab:staff-reading-game:hints` (`HINTS_STORAGE_KEY`). Retention keeps at most 1,000 attempts (`MAX_STORED_ATTEMPTS`) by dropping whole sessions, oldest first, never the one in progress. Personal bests are computed from completed Rounds with the same mode, clef and range preset, not stored. If storage is missing, blocked or full, the same interface is served from memory and `isPersisting()` returns false. If reading throws, the stored data is left untouched.

**Audio engine.** `createAudioEngine()` uses the Web Audio API directly. `unlock()` creates and resumes the context (must run in a gesture) and `loadSamples()` decodes the samples in the background; `play(note, { delayMs })` pitch-shifts the nearest sample by playback rate, or plays a short triangle-wave tone until samples are ready. A note requested while the context is not running is dropped. No method throws. Samples are in `public/staff-reading-game/piano/`.

**Staff component.** `_components/staff.tsx` is a custom SVG that holds no game rules: it draws steps (viewBox at least 320 wide, 24 units per staff space, `staff-geometry.ts`) and reports steps through pointer events with `touch-action: none`. Placement is a controlled `role="slider"` (the parent owns the provisional step). Clef paths are in `clef-glyphs.ts`. The `compact` layout is used by the end screen.

**Entry points.** `page.tsx` renders `StaffReadingGame` (`_components/staff-reading-game.tsx`), the shell that owns settings, storage (created after mount), the audio engine (created on the first Start) and the silent-switch hint (`use-silent-switch-hint.ts`), and chooses the screen. It accepts injected `storage`, `audio` and `rng` for tests. Screens: `setup-screen.tsx`, `game-screen.tsx` (with `top-bar.tsx`, `answer-buttons.tsx`, `place-controls.tsx`, `prompt-card.tsx`), `practice-summary.tsx`, `end-screen.tsx`. Colours are Tailwind theme tokens in `src/styles/globals.css`: `paper`, `card`, `ink`, `ink-muted`, `rule`, `accent`, `accent-soft`.

## What it can't do

- No piano keyboard input (planned for v1.1), grand staff, accidentals or key signatures, stats screen, adaptive note selection, sprint session, or Web MIDI input.
- No database sync, accounts or auth. Records carry `ownerId`, UUIDs and `syncedAt: null` so sync can be added later, but there are no Drizzle tables or tRPC procedures.
- No cross-tab coordination: two tabs writing at once is last-write-wins.
- Progress is per browser. Retention caps history at 1,000 attempts.
- UI text is English; solfège changes note names only.
- No end-to-end test suite in the repo. Touch drag, tap timing and iPhone audio are untested outside simulated DOM tests.
- Exit has no confirmation dialog.

## Decisions

The full list (D1-D32) is in the spec's `## Decisions` section, `.scratch/staff-reading-game/spec.md`. There are no ADRs for these. The ones a maintainer needs:

- Jest, not Vitest (D2): the repo already uses Jest. Component tests opt into jsdom per file with a `@jest-environment jsdom` docblock.
- Web Audio instead of Tone.js (D23): a small sampler does the same job without a large dependency.
- Module layout naming (D1): no `service`/`repository` since there is no database access; parts are named for what they hold (`types`, `notes`, `queue`, `scoring`, `session`, `validators`, `storage`, `audio`). Components are colocated in `_components/`.
- Async storage interface (D24): so a server implementation can replace `localStorage`; game logic never touches storage directly.
- Re-queue timing (D11, D29): a miss is inserted as the 3rd to 5th next prompt and may arrive later (a later miss inserted ahead of it, or moved to avoid a repeat), never earlier than 3rd. Identity is the canonical note, or the letter for letter prompts (D10).
- Pointer type drives the Place flow (D20): decided per interaction, not by device sniffing.
- Confirm speed window (D13): the 1 s shift applies to an attempt committed with Confirm, including by keyboard, not to a device type.
- Personal best key is mode, clef and range preset; strict octave is not part of it (D16).
- Counts (D14): `correctCount` and `totalCount` cover first-time prompts only, in both session types.

## Operating it

No environment variables, no migration, no schema change (D4).

Tests: `npm test` runs all of Jest; for this feature use `npx jest src/modules/staff-reading-game src/app/staff-reading-game`. Logic tests are in `src/modules/staff-reading-game/__tests__/`; component tests sit next to the components.

Third-party assets:

- Piano samples: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0, the MP3 conversions from the Tone.js audio repository, used unmodified. 17 files (C, D#, F# and A from C2 to C6) in `public/staff-reading-game/piano/`; see its `README.md`.
- Clef glyphs: treble and bass outlines from the Bravura font (SMuFL), SIL Open Font License 1.1, inlined in `clef-glyphs.ts`.

## Open questions

- Feedback timings (600 ms, 1,200 ms): the spec ticked them as confirmed, but they have not been tried on a real phone. Confirm by playtest.
- Touch drag and tap timing, and iPhone audio (unlock, silent switch hint), need a check on real devices.
- The correct note scheduled 400 ms after a Place miss may still sound if the player exits in that window (D31).
- Retention can trim the session holding the personal-best Round once more than 1,000 attempts are stored, lowering the best.
- In iPhone landscape the silent-switch hint can push the Place controls off screen until dismissed (D31).
