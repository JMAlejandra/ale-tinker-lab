# 04 — CI workflows (lint, typecheck, build, test)

**What to build:** Every pull request gets four independent CI checks — lint, typecheck, build, and test — with the test workflow exercising real Drizzle queries against a real Postgres instance.

**Blocked by:** 01, 03

**Status:** ready-for-human

- [x] Four separate workflow files — `lint.yml`, `typecheck.yml`, `build.yml`, `test.yml` — each independently triggerable/removable
- [x] Shared setup (checkout, `setup-node`, `npm ci`) factored into a composite action used by all four, not copy-pasted — see comment below on why `checkout` stayed in the calling workflows
- [x] `test.yml` runs a real Postgres via a GitHub Actions `services:` container, applies the checked-in initial migration (from ticket 03), then runs Jest (Node environment only, no jsdom/RTL) against it
- [x] `build.yml` runs `next build` (or the Docker image build, or both) to prove the app builds
- [x] All four workflows run on pull requests and pass against the current state of the repo (Stock example + Docker setup from tickets 01–03)

## Comments

No Jest setup existed yet, so this also added it: `jest.config.cjs` (Node
environment, `@swc/jest` transform, no jsdom/RTL), a `test` npm script, and
`src/server/db/__tests__/posts.test.ts`, which inserts and reads back a row
against a real Postgres connection built directly from `DATABASE_URL` (not
through the app's cached `src/server/db/index.ts` connection, so the test can
cleanly close it in `afterAll`).

`actions/checkout` could **not** be moved into the composite action: a
workflow step referencing a local action via `./.github/actions/setup` can
only resolve once the repo is already checked out (that's how the runner
finds the action's own `action.yml`), so `actions/checkout@v4` has to stay as
the first step in every one of the four workflows. The composite action
covers `setup-node` + `npm ci`, which is the reusable part. Flagging this
since it's a partial deviation from the ticket's literal wording, done for a
real platform constraint rather than convenience — worth a `ready-for-human`
look before considering this fully done.

`build.yml` sets `SKIP_ENV_VALIDATION=1` (the same escape hatch
`next.config.js` documents for Docker builds) since no Postgres is needed to
prove the app builds, and the Dockerfile itself never runs `next build`
(dev-only per ADR 0001).

`lint.yml` needed the same `SKIP_ENV_VALIDATION=1` treatment: `next lint`
loads `next.config.js` too, which imports `src/env.js` and validates
`DATABASE_URL`. Missed on the first pass (masked locally by an existing
`.env` file that Next.js auto-loads), caught by the spec-axis code review,
confirmed by running `npm run lint` with no `.env` and no `DATABASE_URL` in
the shell — it throws `Invalid environment variables` without the fix and
passes with it.
