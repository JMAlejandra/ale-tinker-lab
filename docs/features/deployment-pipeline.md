# Deployment pipeline

Status: in use · Last updated: 2026-11-13

How a change gets from a branch to Production: Vercel builds and hosts the app, Neon hosts Postgres, and migrations run both in the Vercel build and from a GitHub Actions workflow.

## What it does

- Every pushed branch gets a Vercel Preview, backed by the Neon branch `dev` (fake data only).
- A merge to `main` deploys Production, backed by the Neon branch `production`.
- Every deployment applies pending migrations before building, so it never serves code ahead of its schema.
- After each push to `main`, the `Migrate` workflow migrates `dev`, then `production`.

## How it works

- **Build.** `npm run build:deploy` runs `npm run db:migrate` (drizzle-kit), then `next build`. `vercel.json` only sets `"regions": ["cle1"]`, next to Neon in `aws-us-east-2`.
- **Connection strings.** The app reads the pooled `DATABASE_URL` (validated in `src/env.js`, used by `postgres(env.DATABASE_URL)` in `src/server/db/index.ts`). drizzle-kit reads `DATABASE_URL_UNPOOLED` in `drizzle.config.ts` and falls back to `DATABASE_URL`; it reads `process.env` directly because the workflow provides only the unpooled string.
- **Variables.** Vercel holds both strings per scope: Production gets `production`'s, Preview gets `dev`'s. The GitHub environments `dev` and `production` each hold only the secret `DATABASE_URL_UNPOOLED`.
- **`.github/workflows/migrate.yml`** runs on `push` to `main`, with two jobs:
  - `migrate-dev` (environment `dev`): checkout, `./.github/actions/setup` (Node 24, `npm ci`), `npm run db:migrate`.
  - `migrate-production` (environment `production`, `needs: migrate-dev`): the same steps against `production`.
  - Concurrency group `migrate` with `cancel-in-progress: false`, so two runs of this workflow never overlap.
- drizzle-kit only manages tables matching `ale_tinker_lab_*` (`tablesFilter`); migrations live in `drizzle/`.

## What it can't do

- The Vercel Build Command is set to `npm run build:deploy` in the Vercel dashboard, not in `vercel.json`, so the repo doesn't show it. It applies to Previews too: every Preview build migrates the shared `dev` database, including Previews of branches whose migrations aren't merged.
- The `migrate` concurrency group only covers the workflow. It doesn't serialize Vercel builds, which migrate on their own.
- There's no rollback. Migrations must stay backward-compatible with the code in Production, because they can run a few minutes before the new deployment is live.
- No Preview builds `main`, so only the workflow keeps `dev` current after a merge.

## Decisions

- Vercel Hobby plus Neon, free tiers, with functions in `cle1`: see `docs/adr/0001-vercel-neon-deployment.md`.
- The app uses the pooled string, drizzle-kit the direct one: see ADR 0001.
- Migrations run in both the Vercel build and the workflow, on purpose: see ADR 0001.
- One shared `dev` branch for all Previews, migrated by unmerged branches too: accepted for now, see ADR 0001.
- The build script is `build:deploy`, not `vercel-build`, so Vercel doesn't run it automatically: see ADR 0001.

## Operating it

- **Approving a migration.** The `production` GitHub environment requires manual approval, so every `Migrate` run waits at `migrate-production` until someone approves it on GitHub.
- **"Cancelled" runs.** The concurrency group allows one running and one pending run. A newer push replaces the pending run, which then shows as "cancelled". That's harmless: each run applies every migration not yet applied.
- **Schema changes.** Run `npm run db:generate` and commit the migration in `drizzle/`. Nothing else changes a deployed database's schema.
- **Locally**, set only `DATABASE_URL` (see `.env.example`); `npm run db:migrate` falls back to it.

## Open questions

- Per-PR Neon branches would stop unmerged migrations reaching `dev`. Not done yet.
