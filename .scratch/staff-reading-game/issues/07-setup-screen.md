# 07: Setup screen and route

**What to build:** The Experiment is reachable at `/staff-reading-game` (linked from the home page) and opens on the setup screen, where the player chooses every setting, sees them remembered on the next visit, and sees their personal best. Start hands the chosen settings to the game (the game screen itself arrives in ticket 08; until then Start may show a placeholder). See spec "Settings", "Screens → Setup screen", "Mobile and accessibility", Decisions D1, D5, D6, D16.

**Blocked by:** 04

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `/staff-reading-game` renders a client-side game shell; the home page links to it
- [ ] Two large mode cards (Place the note, Name the note) and a Practice/Round switch
- [ ] Clef, range preset, note naming, sound; strict octave and preview sound appear only in Place mode
- [ ] Defaults match the spec; every change is saved through the progress storage and restored on reload
- [ ] Personal best for the current mode + clef + range preset is shown when one exists and updates as those settings change
- [ ] A Start button calls an `onStart(settings)` hook supplied by the shell (which will also unlock audio)
- [ ] A subtle notice appears when progress is not being saved (storage unavailable)
- [ ] Usable at 320 px wide in portrait; tap targets at least 44 × 44 px; all controls are labelled, keyboard-operable, and state is not conveyed by colour alone
- [ ] Component tests cover defaults, conditional Place-only settings, persistence calls, personal best display, the notice, and Start

## Files likely touched

`src/app/staff-reading-game/page.tsx`, `_components/staff-reading-game.tsx` (shell), `_components/setup-screen.tsx`, tests beside them, `src/app/page.tsx` (link)

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
