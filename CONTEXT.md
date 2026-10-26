# ale-tinker-lab

A personal experimentation sandbox. It is one Next.js app (T3 stack: tRPC, Drizzle, Postgres), created from the T3 Docker scaffold (see `scaffold-CONTEXT.md` for the scaffold's own vocabulary).

This file holds project context. Definitions of domain terms live in `GLOSSARY.md`, which the agent skills read and update; use its vocabulary here.

## Deployment pipeline

Branch → pull request → Vercel Preview (Neon branch `dev`, fake data only) → merge to `main` → Vercel Production (Neon branch `production`). Migrations run during the Vercel build and again from a GitHub Actions workflow after each merge. Rationale and connection details: `docs/adr/0001-vercel-neon-deployment.md`.

Tests run against a throwaway Postgres on the same major version as Neon: Docker Compose locally, a service container in CI, and a container started by the session hook in cloud sessions (`docs/adr/0002-session-test-database.md`).
