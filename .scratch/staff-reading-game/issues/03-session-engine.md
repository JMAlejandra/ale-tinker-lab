# 03: Session engine: note selection, re-queue, scoring, game states

**What to build:** The whole game as pure logic with no DOM, audio or storage: a reducer that starts a session from settings, serves prompts, judges a committed answer, scores it, re-queues misses, and ends a Round. Randomness and time are injected so tests are deterministic. Built test-first. See spec "Game modes" (correctness rules), "Session types", "Note selection and re-queue", "Scoring", "Game states", Decisions D8–D17.

**Blocked by:** 02

**Status:** ready-for-agent

## Acceptance criteria

- [ ] States: `setup`, `prompting`, `feedback`, `summary` (Practice exited), `ended` (Round completed); answers are ignored outside `prompting`
- [ ] New prompts are uniform over the preset, never the note just shown; Place mode with strict octave off draws by letter (D8)
- [ ] Correctness: Name mode by letter; Place mode by letter (strict off) or exact pitch (strict on)
- [ ] A miss re-queues the note 3–5 prompts ahead; end-of-Round, adjacency and the 2-per-note Round cap follow the spec and D10–D12
- [ ] A Round is 20 new prompts plus re-queues and ends only when all are answered, including a miss on the final prompt; Practice never ends on its own
- [ ] Points follow the formula, the multiplier table and the shifted touch window (D13); re-queued prompts and Practice award 0; wrong is 0 and resets the streak; 20 fast correct answers total 5,025
- [ ] Each answer yields an attempt record with position, target note, answer, isCorrect, responseMs, points, streakAfter, wasRequeued
- [ ] Derived stats: score, streak, best streak, progress (answered new / 20), notes answered, accuracy on first-time prompts (D14), average response time over all attempts, per-note result for the end screen (always correct / mixed / always missed)
- [ ] Exit from a Round gives an incomplete session and returns to `setup`; exit from Practice goes to `summary`
- [ ] A response timer helper measures prompt-shown → commit and excludes time while paused (page hidden), with an injected clock
- [ ] Unit tests cover selection, every re-queue rule, scoring boundaries (1 s, 5 s, 2 s/6 s touch, streak 4→5, 9→10), Round completion and exit

## Files likely touched

`staff-reading-game.queue.ts`, `staff-reading-game.scoring.ts`, `staff-reading-game.session.ts`, `staff-reading-game.types.ts` (additions), `index.ts`, matching files in `__tests__/`

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
