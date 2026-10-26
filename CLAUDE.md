## Maintaining this file

- A line belongs here only if it applies to nearly every task.
- Procedures go in skills (`.claude/skills/`), decisions in `docs/adr/`, project vocabulary and context in `CONTEXT.md`.
- Link to those instead of copying their content. Keep this file under about 50 lines.

## Project

Read `CONTEXT.md` for project context and vocabulary, and `docs/adr/` for decisions.

- Next.js 15 (App Router), tRPC, Drizzle ORM, Postgres.
- Vercel deploys `main` to production and every other branch as a preview.
- Neon hosts Postgres: branch `production` for production, branch `dev` for all previews.
- The app uses pooled `DATABASE_URL`. drizzle-kit uses direct `DATABASE_URL_UNPOOLED`.
- Details: `docs/adr/0001-vercel-neon-deployment.md`.

## Rules

- Every schema change ships with a committed drizzle-kit migration (`npm run db:generate`).
- Table prefix is `ale_tinker_lab_`.
- Never commit secrets or connection strings. The repo is public.
- Don't rely on Docker in cloud sessions.
- Always work on a branch and open a PR. Never push to `main`.
- Every PR description says whether it changes the schema.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
