# 0002: Test databases match Neon's Postgres version

Status: accepted (2026-10-26)

## Context

The test suite needs a real Postgres it can write to. Linux machines get one from Docker Compose and CI gets a service container, but Claude Code cloud sessions had none. Production runs on Neon with Postgres 18, while CI and Docker Compose pinned 17, and the Postgres installed in the cloud image is 16.

A test database older than production fails loudly when code uses a newer feature. One newer than production lets tests pass on SQL that then breaks production migrations. So the version to match is production's.

## Decision

**Every test and local database runs the same Postgres major version as Neon, currently 18:** `docker-compose.yml`, `start-database.sh`, the CI service in `.github/workflows/test.yml`, and the cloud-session hook. When Neon's version changes, change all four together.

**Cloud sessions run Postgres in Docker.** `.claude/hooks/session-start.sh` runs on every session start and resume, only when `CLAUDE_CODE_REMOTE=true`. It:

- installs dependencies with `npm ci`, only when `node_modules` is missing or out of date (`npm install` would rewrite the lockfile with this sandbox's older npm);
- starts the Docker daemon and a `postgres:18` container;
- applies migrations;
- exports a local, throwaway `DATABASE_URL` for the session.

The image is pulled from `mirror.gcr.io`, Google's mirror of Docker Hub, because Docker Hub rate-limits anonymous pulls from shared cloud IPs.

Rejected:
- The Postgres installed in the cloud image: it is 16, and the image's package sources offer nothing newer.
- A Neon test branch: it would need secrets in the environment, and it isn't clear that the sandbox's proxy lets the Postgres protocol through.

**Data is disposable.** Running containers stop when a session's machine sleeps, and the hook restarts them on resume. A new session starts on a fresh machine with an empty database. Nothing in a session database is kept, and it never connects to Neon.

## Consequences

- This narrows ADR 0001's "the Docker setup stays for local development on Linux only": cloud sessions now also use Docker, but only for the test database.
- A session's first start pulls a ~650 MB image (about 20 seconds measured); resumes take seconds.
- If Docker stops being available in cloud sessions, the hook fails with a one-line message, and DB tests fall back to CI only.
- Moving Docker Compose from 17 to 18 changed the volume mount to `/var/lib/postgresql`. The 18 image refuses to start with data at the old `/var/lib/postgresql/data` path, so existing 17 volumes must be recreated, or dumped and restored.
