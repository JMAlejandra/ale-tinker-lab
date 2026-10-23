# 0001: Deploy on Vercel with Neon Postgres

Status: accepted (2026-10-23)

## Context

ale-tinker-lab started from the T3 Docker scaffold, which only covered local development. It needs a hosted production app, a preview per branch, and a managed Postgres, on free tiers.

## Decision

**Hosting.** Vercel (Hobby plan) builds a preview deployment for every branch and deploys `main` to production. Functions run in `cle1` (set in `vercel.json`), next to the Neon database in `aws-us-east-2`, so each query stays in-region.

**Database.** Neon hosts Postgres. The Neon branch `production` serves production. The Neon branch `dev` serves every Vercel preview and holds fake data only.

**Pooled vs direct connections.** Each environment has two connection strings:

- `DATABASE_URL`: Neon's pooled (PgBouncer, transaction mode) string. The app uses it, because serverless functions open many short-lived connections and the pooler absorbs them. The existing `postgres` (postgres.js) driver works through it: it uses protocol-level prepared statements, which Neon's pooler supports, and never SQL-level `PREPARE`.
- `DATABASE_URL_UNPOOLED`: the direct string. drizzle-kit (`npm run db:*`) always uses it, because migrations need a real session. `drizzle.config.ts` falls back to `DATABASE_URL` when it's unset, which covers local Postgres with no pooler.

Vercel holds both variables per scope: Production gets the `production` strings, Preview gets the `dev` strings. The GitHub environments `dev` and `production` each hold only `DATABASE_URL_UNPOOLED`.

**Migrations run in two places, on purpose.**

1. Vercel's build command is `npm run build:deploy` (`db:migrate`, then `next build`), so a deployment never serves code ahead of its schema. It is deliberately not named `vercel-build`, which Vercel runs automatically.
2. `.github/workflows/migrate.yml` runs on every push to `main`: it migrates `dev`, then `production`. It runs under a concurrency group, so two migrations never run at once.

Both paths migrate production after a merge. Whichever runs second finds nothing to apply. The redundancy keeps `dev` current even though no preview builds `main`, and production still gets migrated if one of the two paths fails.

**Table prefix.** Every table is named `ale_tinker_lab_<name>` through `pgTableCreator` in `src/server/db/schema.ts`, and drizzle-kit only manages tables matching `ale_tinker_lab_*`. This replaced the scaffold's `t3-docker-scaffold_` prefix before any database had applied a migration, so the initial migration was regenerated rather than renamed.

## Consequences

- Every schema change needs a committed drizzle-kit migration. Nothing else changes a deployed database's schema.
- Vercel's build command applies to previews too, so every preview build migrates the shared `dev` database, including previews of branches whose migrations aren't merged yet. `dev` holds fake data only, so this is accepted. Per-PR Neon branches are the likely fix if it becomes a problem.
- Migrations must stay backward-compatible with the code currently in production. They can run a few minutes before the new deployment goes live.
- The Docker setup stays for local development on Linux only. Production never runs in Docker.
