# 06: Piano sound engine

**What to build:** Notes can be heard: an audio engine that plays any canonical note in the visible areas with a piano sound, loads its samples lazily in the background, falls back to a simple tone until they are ready, and never blocks or breaks the game. See spec "Feedback and sound", "Edge cases" (sound rows), Decision D23.

**Blocked by:** 02

**Status:** ready-for-agent

## Acceptance criteria

- [ ] The 17 Salamander samples (provided in the brief) are committed under `public/staff-reading-game/piano/` with a short attribution/licence note next to them
- [ ] An audio engine exposes: unlock (call from a user gesture), start loading samples (non-blocking), play a note (optionally after a delay in ms), set muted, and dispose
- [ ] Each note plays from the nearest sample, pitch-shifted by playback rate; until samples are decoded, or if loading fails, a short synthesized tone at the right frequency is used
- [ ] Muted, not unlocked, or without Web Audio support: play is a silent no-op and never throws
- [ ] The engine is created lazily on the client only (no Web Audio access during server render or import)
- [ ] Unit tests with a fake AudioContext cover nearest-sample choice and rate, the fallback tone, mute, delayed play, and failure paths

## Files likely touched

`staff-reading-game.audio.ts`, `index.ts`, `__tests__/staff-reading-game.audio.test.ts`, `public/staff-reading-game/piano/*`

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
