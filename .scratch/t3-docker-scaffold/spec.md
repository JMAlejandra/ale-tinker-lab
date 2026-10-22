Status: ready-for-agent

# T3 Docker Scaffold

## Problem Statement

Every time a new web app project starts, setting up a working local dev environment (Next.js + database + tooling) from scratch is repetitive and error-prone — installing the right Node version locally, standing up Postgres, wiring migrations, and configuring CI all get redone per project, with drift between projects each time.

The user wants a reusable **Scaffold** repository based on the T3 stack that they can start new **Downstream projects** from via GitHub's template mechanism, where the entire local dev environment runs in Docker Compose — no local Node/Postgres install required to get the app running — with sensible defaults for migrations, CI, and env var handling already wired up.

## Solution

Build a GitHub template repository, bootstrapped from the official `create-t3-app` CLI (Next.js App Router, tRPC, Drizzle ORM, Tailwind, npm — no NextAuth), with a dev-only Docker Compose environment (`app` + `db` + `drizzle-studio` services), hot reload via bind mounts, a persistent named volume for Postgres data, a single root `.env`/`.env.example` pair, host-installed npm scripts as the primary migration/seed workflow (with a documented container-only fallback), and GitHub Actions CI (lint, typecheck, build, test) as separate composable workflow files. The scaffold keeps the **Stock example** that `create-t3-app` generates rather than adding a custom one, so the wiring is provably correct out of the box.

Production deployment is explicitly out of scope for the scaffold — each Downstream project decides its own production database and hosting target.

## User Stories

1. As a developer starting a new project, I want to create a new repository from the scaffold's "Use this template" button, so that I get a working T3 project structure without manually re-assembling boilerplate.
2. As a developer with a fresh clone of a Downstream project, I want to run `docker compose up` and get a fully working dev environment, so that I don't need Node or Postgres installed locally to start working.
3. As a developer, I want the Next.js app running in Docker to hot-reload when I edit source files on the host, so that my edit-save-view loop isn't slowed down by rebuilds.
4. As a developer, I want Postgres data to persist across `docker compose down`/`up` and container rebuilds, so that I don't lose local data every time I restart my environment.
5. As a developer, I want a single `.env` file (with a checked-in `.env.example` template) to configure both the `app` and `db` services, so that I don't have to keep credentials in sync across multiple files.
6. As a developer, I want `DATABASE_URL` composed from `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` rather than hardcoded, so that switching to a hosted Postgres (e.g. Neon) later doesn't require restructuring env handling.
7. As a developer, I want Drizzle Studio available as an always-on Compose service, so that I can inspect/edit local data without manually running `drizzle-kit studio` from the host.
8. As a developer, I want to run Drizzle migrations and seed scripts via host-installed npm scripts, so that I get full IDE/editor integration (e.g. Drizzle Kit tooling) and fast iteration.
9. As a developer without Node installed on my host, I want a documented `docker compose exec app ...` fallback for every migration/seed npm script, so that I can still work entirely inside containers if I choose to.
10. As a developer on a fresh clone, I want the initial migration for the stock example already generated and checked into the repo, so that one migrate command gets me a working schema without first having to run `drizzle-kit generate` myself.
11. As a developer opening a pull request, I want lint, typecheck, build, and test checks to run automatically in CI, so that regressions are caught before merge.
12. As a developer, I want the CI test workflow to run Jest against a real Postgres instance (via a GitHub Actions `services:` container), so that tests exercise real Drizzle queries rather than mocks.
13. As a developer reading the CI configuration, I want lint/typecheck/build/test each defined as separate workflow files sharing a composite setup action, so that I can add, remove, or modify one concern (e.g. delete the test workflow for a project with no tests yet) without touching the others.
14. As a developer, I want the scaffold to explicitly document how to add NextAuth later, so that I know auth was deliberately left out rather than forgotten, and how to bring it in when a project needs it.
15. As a developer, I want the Postgres port published to the host and configurable via `.env`, so that it doesn't collide with another local Postgres instance I might already be running.
16. As a developer inspecting the container setup, I want `node_modules` isolated from the host via an anonymous volume layered over the bind mount, so that host-vs-container native binary mismatches don't break the app.
17. As a developer reading the repo's `CONTEXT.md` and `docs/adr/`, I want the scaffold's own architectural decisions (dev-only Docker scope, auth omission, host-script-as-primary migration path) documented, so that I understand why the scaffold is shaped the way it is rather than assuming these were oversights.
18. As a developer following the README, I want a documented manual smoke-test checklist (hot reload works, data persists across restart, Drizzle Studio reachable, container-only fallback works without host Node), so that I can verify the properties CI can't check automatically after making changes to the Docker setup.

## Implementation Decisions

- **Bootstrap**: Repository initialized via the official `npm create t3-app@latest` CLI with Next.js App Router, tRPC, Drizzle ORM, Tailwind CSS, npm selected, NextAuth declined. The CLI's generated Stock example (default tRPC + Drizzle + UI wiring) is kept as-is — no custom example is added, no removal tooling is built.
- **Docker images**: Single-stage, dev-only `Dockerfile` based on `node:24-bookworm-slim`. No multi-stage build, no prod target — see ADR 0001.
- **Compose topology**: One `docker-compose.yml`, dev-only (no `docker-compose.prod.yml`). Three services:
  - `app` — Next.js dev server, source bind-mounted from host for hot reload, with an anonymous volume layered over `node_modules` so the container's own install isn't shadowed by the host's.
  - `db` — Postgres, with a named volume for data persistence across restarts/rebuilds. Port published to host, host-side port configurable via `.env` (e.g. `POSTGRES_PORT`) to avoid collisions with other local Postgres instances.
  - `drizzle-studio` — always-on Compose service running `drizzle-kit studio`, no opt-in profile required.
- **Env vars**: Single root `.env` (git-ignored) and `.env.example` (checked in). `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are the source of truth; `DATABASE_URL` is composed from them so the connection string isn't hardcoded and swapping to a hosted Postgres later doesn't require restructuring.
- **Migrations/seeding**: Host-installed npm scripts (e.g. `npm run db:migrate`, `npm run db:seed`) are the primary, documented workflow — requires Node on the host. Every such script has a documented `docker compose exec app npm run ...` equivalent as a no-host-Node fallback. See ADR 0003 for why host scripts are primary despite the scaffold's original zero-install framing.
- **Initial migration**: The Drizzle migration for the Stock example's schema is generated ahead of time and checked into the repo (not generated on first run), so a fresh clone + one migrate command produces a working schema immediately.
- **Auth**: NextAuth is not included. README documents how to add it to a Downstream project. See ADR 0002.
- **CI workflows**: Four separate GitHub Actions workflow files — `lint.yml`, `typecheck.yml`, `build.yml`, `test.yml` — each independent, sharing checkout/`setup-node`/`npm ci` steps via a composite action (not copy-pasted per file). `test.yml` runs Jest against a real Postgres via a `services:` container, applying the checked-in migration before running tests.
- **Distribution**: Repository is marked as a GitHub template repository ("Use this template").
- **Domain docs**: `CONTEXT.md` (Scaffold, Downstream project, Stock example) and `docs/adr/0001`–`0003` already exist and should be treated as authoritative for terminology and rationale; keep them in sync if implementation decisions here change during the build.
- **Out of scope infrastructure**: No prod Dockerfile stage, no prod compose file, no production database provisioning or hosting decision — left entirely to each Downstream project.

## Testing Decisions

- Good tests here exercise the Stock example's tRPC procedures and Drizzle queries against a **real** Postgres instance, not mocks — the existing repo goal (per the original planning prompt) was explicit about wanting integration-style confidence over mocked unit tests for the DB layer.
- **Primary automated seam**: Jest, Node environment only (no jsdom/RTL), run against a real Postgres — locally via `docker compose exec app npm test` (or host `npm test` pointed at the containerized `db`), and in CI via `test.yml`'s `services:` Postgres container with the checked-in migration applied first.
- **Automated proxy checks** (not unit tests, but CI-enforced): `build.yml` proves the Docker image builds and `next build` succeeds; `test.yml` proves migrations apply cleanly against a fresh Postgres and Jest passes.
- **Manual smoke-test checklist** (documented in README, not automated — no reasonable unit-test seam exists for these): hot reload triggers on host file save; Postgres data survives `docker compose down && up`; Drizzle Studio is reachable on its published port; the `docker compose exec app ...` fallback works for migrations/seeding without host Node installed.
- No prior art in this repo yet (greenfield) — this establishes the pattern future Downstream projects will inherit and extend.

## Out of Scope

- Production Docker build target, production compose file, or any production deployment tooling.
- Choosing or provisioning a production database (Neon or otherwise).
- NextAuth or any other auth implementation — only documentation on how to add it later.
- A custom example feature beyond the CLI's Stock example, and any tooling to remove/replace it.
- Component-level (jsdom/React Testing Library) test setup — Jest is Node-environment only for now.
- CI deployment workflows (e.g. auto-deploy on merge to main) — only lint/typecheck/build/test are in scope.

## Further Notes

- This spec covers the scaffold repository itself, not any Downstream project built from it.
- ADR 0003 documents a real tension worth keeping visible during implementation: the original goal was zero local installs, but host-installed scripts are the primary migration/seed path by deliberate choice. Don't silently "fix" this back to container-only — it was a considered trade-off, not an inconsistency.
- If implementation surfaces new architectural decisions meeting the ADR bar (hard to reverse, surprising without context, real trade-off), record them in `docs/adr/` following the existing numbering.
