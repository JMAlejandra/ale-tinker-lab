# ale-tinker-lab

A personal experimentation sandbox. It is one Next.js app (T3 stack: tRPC, Drizzle, Postgres), created from the T3 Docker scaffold (see `scaffold-CONTEXT.md` for the scaffold's own vocabulary).

## Language

**Experiment**:
One self-contained idea being tried out, living as a route in this app.
_Avoid_: Project, app (there is only one app)

**Production**:
The Vercel deployment of `main`, backed by the Neon branch `production`.

**Preview**:
A Vercel deployment of any other branch. All previews share the Neon branch `dev`, which holds fake data only.

## Deployment pipeline

Branch → pull request → Vercel preview (Neon `dev`) → merge to `main` → Vercel production (Neon `production`). Migrations run during the Vercel build and again from a GitHub Actions workflow after each merge. Rationale and connection details: `docs/adr/0001-vercel-neon-deployment.md`.

Tests run against a throwaway Postgres on the same major version as Neon: Docker Compose locally, a service container in CI, and a container started by the session hook in cloud sessions (`docs/adr/0002-session-test-database.md`).
