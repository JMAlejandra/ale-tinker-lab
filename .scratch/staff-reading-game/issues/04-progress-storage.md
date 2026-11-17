# 04: Progress storage in the browser

**What to build:** One progress-storage interface through which everything is read and written, with a browser implementation: profile, settings, sessions and attempts survive a reload, old data migrates or resets safely, and the game keeps working when storage is unavailable. Built test-first. See spec "Persistence and data model", "Edge cases" (storage rows), Decisions D16, D24.

**Blocked by:** 02

**Status:** done

## Acceptance criteria

- [ ] An asynchronous `ProgressStorage` interface covers: get-or-create local profile, load/save settings, save (upsert) a session, add an attempt, list sessions and their attempts, personal best for mode + clef + range preset, and whether progress is being persisted
- [ ] The browser implementation keeps one versioned document (`schemaVersion: 1`) in `localStorage`, validated with Zod on load
- [ ] IDs are client-generated UUIDs; every top-level record carries `ownerId`; timestamps are ISO 8601 UTC; `syncedAt` and `linkedUserId` are null
- [ ] Settings round-trip, and missing settings yield the defaults
- [ ] Personal best is computed from completed Round sessions only (never Practice, never incomplete), per D16
- [ ] Retention: at most 1,000 attempts; trimming removes whole sessions, oldest first, never the session in progress
- [ ] Older or unknown schema versions go through a migration step; data that fails migration or validation is reset without throwing
- [ ] When `localStorage` is missing, throws on access, or is full, the same interface keeps working from memory and reports that progress is not being saved; no call throws to the caller
- [ ] One-time hint flags are stored under a separate key and survive a data reset
- [ ] Unit tests cover round-trips, personal best, retention, migration/reset, and the unavailable and quota-exceeded paths with a fake storage

## Files likely touched

`staff-reading-game.storage.ts`, `staff-reading-game.validators.ts`, `staff-reading-game.errors.ts` (if needed), `index.ts`, matching files in `__tests__/`

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
