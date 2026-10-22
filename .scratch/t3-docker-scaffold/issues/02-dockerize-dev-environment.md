# 02 — Dockerize the dev environment (app + db + Drizzle Studio)

**What to build:** `docker compose up` brings up a fully working dev environment — the Next.js app, Postgres, and Drizzle Studio — with hot reload, persistent data, and no local Node/Postgres install required.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Single-stage, dev-only `Dockerfile` based on `node:24-bookworm-slim` (no multi-stage build, no prod target — per ADR 0001)
- [ ] Single `docker-compose.yml` (dev-only, no `docker-compose.prod.yml`) defining `app`, `db`, and `drizzle-studio` services
- [ ] `app` service: source bind-mounted from host for hot reload; `node_modules` isolated via an anonymous volume layered over the bind mount so host/container installs don't conflict
- [ ] `db` service: Postgres with a named volume so data persists across `docker compose down && up` and container rebuilds; port published to host and configurable via `.env` (e.g. `POSTGRES_PORT`)
- [ ] `drizzle-studio` service: always-on (no opt-in profile), reachable on a published port
- [ ] Single root `.env` (git-ignored) and `.env.example` (checked in); `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` are the source of truth, `DATABASE_URL` composed from them (not hardcoded) and shared by `app` and `db`
- [ ] Verified: editing a source file on the host reflects in the running `app` container without a rebuild
- [ ] Verified: data written to Postgres survives `docker compose down && docker compose up`
- [ ] Verified: Drizzle Studio is reachable on its published port and can see the Stock example's schema
