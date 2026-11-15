# 01: Test and format tooling

**What to build:** Prefactor so every later ticket can pass the three gates (`npm run check`, `npm test`, `npm run format:check`) and can write React component tests. No game code. See spec Decisions D2, D3.

**Blocked by:** None (can start immediately)

**Status:** done

## Acceptance criteria

- [ ] `npm run format:check` passes on the whole repo; the reformat of existing files is purely mechanical (Prettier output only, no hand edits)
- [ ] Jest also picks up `src/**/*.test.tsx`, and transforms TSX with the automatic JSX runtime
- [ ] Dev dependencies added: `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jest-environment-jsdom`; `package-lock.json` updated
- [ ] A file with a `/** @jest-environment jsdom */` docblock can render a component and use `@testing-library/jest-dom` matchers (type-checked too); proven by one tiny smoke component test, kept in the repo
- [ ] The existing database test still runs in the node environment and passes
- [ ] `npm run check`, `npm test`, `npm run format:check` all pass

## Files likely touched

`package.json`, `package-lock.json`, `jest.config.cjs`, a Jest setup file, `tsconfig.json` (only if needed for types), existing source files (formatting only), one smoke test under `src/`

Paths under `_components/` are relative to `src/app/staff-reading-game/`; `staff-reading-game.*` files are in `src/modules/staff-reading-game/`.
