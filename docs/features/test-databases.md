# Test databases

Status: in use · Last updated: 2026-11-13

Where tests get a real, local Postgres 18 to write to: Docker locally, a service container in CI, and a Docker container in cloud sessions. None of them ever connects to Neon.

## What it does

`npm test` (jest, `src/**/*.test.ts`) needs `DATABASE_URL` pointing at a migrated Postgres. Each place provides one:

| Place | Started by | `DATABASE_URL` |
| --- | --- | --- |
| Local (Linux) | `docker compose up -d db`, or `./start-database.sh` | from `.env` (see `.env.example`) |
| CI | the `postgres` service in `.github/workflows/test.yml` | set in the job's `env` |
| Cloud session | `.claude/hooks/session-start.sh` | exported by the hook |

All three use the same major version as Neon, currently 18.

## How it works

- **Local, Docker Compose.** The `db` service in `docker-compose.yml` runs `postgres:18`, publishes `${POSTGRES_PORT}`, and keeps data in the `db-data` volume mounted at `/var/lib/postgresql`. Apply migrations with `npm run db:migrate`.
- **Local, `start-database.sh`.** The scaffold's script: it parses `DATABASE_URL` from `.env` and runs a `docker.io/postgres:18` container named `<db-name>-postgres` (Docker or Podman). It offers to replace the default password `password` with a random one in `.env`.
- **CI.** `test.yml` runs on every pull request with a `postgres:18` service (health-checked with `pg_isready`), then `npm run db:migrate` and `npm test`.
- **Cloud sessions.** `.claude/settings.json` registers the hook under `SessionStart`, so it runs on every start and resume. It exits at once unless `CLAUDE_CODE_REMOTE=true`. Otherwise it runs `npm ci` if `node_modules` is stale, starts `dockerd`, starts or creates the container `ale-tinker-lab-test-db` from `mirror.gcr.io/library/postgres:18`, waits for `pg_isready`, migrates, and appends `DATABASE_URL` to `$CLAUDE_ENV_FILE`. Step output goes to `/tmp/session-start.log`; it prints one line.

## What it can't do

- Locally, the Compose `db` is also the development database. Tests write rows into it (the posts test inserts `ci-test-post`) and nothing cleans them up.
- Cloud session data doesn't survive a new session: a fresh machine starts with an empty database.
- A cloud machine can restart without the session hook running again, which leaves Docker and the test database stopped.
- The hook does nothing outside cloud sessions (`CLAUDE_CODE_REMOTE` unset).

## Decisions

- Every test database matches Neon's Postgres major version: see `docs/adr/0002-session-test-database.md`.
- Cloud sessions run Postgres in Docker rather than the image's Postgres 16 or a Neon test branch: see ADR 0002.
- Session databases are disposable: see ADR 0002.

## Operating it

- **Upgrading Postgres.** When Neon's version changes, change all four together: `docker-compose.yml`, `start-database.sh`, `test.yml` and `session-start.sh`.
- **Old local volumes.** Postgres 18's image stores data under `/var/lib/postgresql` and refuses to start if anything is mounted at the old `/var/lib/postgresql/data` path. Recreate a 17-era volume with `docker compose down -v` (this deletes local data).
- **Docker Hub limits.** The hook pulls from `mirror.gcr.io` because Docker Hub rate-limits (HTTP 429) anonymous pulls from shared cloud IPs.
- **Database down in a cloud session.** `pre-commit` detects it and says to rerun `.claude/hooks/session-start.sh`, which is safe to run by hand. Run by hand, it doesn't re-export `DATABASE_URL` (`CLAUDE_ENV_FILE` defaults to `/dev/null`), but the session already has it.
- **Never Neon.** `pre-commit` refuses to run tests against any `DATABASE_URL` that isn't on localhost (see `docs/features/git-hooks.md`).

## Open questions

None.
