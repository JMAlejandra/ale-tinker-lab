# 10: Round end screen and personal best

**What to build:** Finishing a Round shows how it went: score, whether it is a new personal best, accuracy, average response time, best streak, and a staff with every prompted note coloured by result, with Play again and Change settings. See spec "Screens → End screen", "Scoring" (accuracy, average), Decisions D14, D16.

**Blocked by:** 08

**Status:** done

## Acceptance criteria

- [ ] Shown only for a completed Round (never after an exit, never for Practice)
- [ ] Score, accuracy as count and percentage of the 20 new prompts, average response time over all attempts, best streak
- [ ] A "New personal best" badge per D16, compared against the best before this Round was saved
- [ ] The staff is redrawn with every note prompted in the Round, low to high, coloured green (always correct), amber (mixed) or red (always missed), with a legend so colour is not the only cue; readable at 320 px
- [ ] Play again starts a new Round with the same settings (audio stays unlocked); Change settings returns to setup, where the personal best is up to date
- [ ] Component tests cover the stats, the badge (first Round, higher, equal/lower), note colouring, and both actions

## Files likely touched

`_components/end-screen.tsx`, `_components/staff-reading-game.tsx` (shell), tests

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
