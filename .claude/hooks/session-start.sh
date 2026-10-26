#!/bin/bash
# Cloud sessions only: install dependencies and start a throwaway Postgres for
# tests, matching Neon's major version (see docs/adr/0002-session-test-database.md).
# Runs on every session start and resume, so every step is idempotent.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Hook stdout lands in Claude's context, so keep step output in a log and
# report one line.
LOG=/tmp/session-start.log
exec 3>&1 >"$LOG" 2>&1
trap 'echo "session-start hook failed; see $LOG" >&3' ERR

# Docker Hub rate-limits anonymous pulls from shared cloud IPs; this is
# Google's mirror of the same official image.
IMAGE="mirror.gcr.io/library/postgres:18"
CONTAINER="ale-tinker-lab-test-db"
DATABASE_URL="postgresql://postgres:password@localhost:5432/ale-tinker-lab"

# npm ci never rewrites package-lock.json; skip it when node_modules is current.
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
fi

if ! docker info >/dev/null 2>&1; then
  setsid dockerd >/tmp/dockerd.log 2>&1 < /dev/null &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi

if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  docker start "$CONTAINER" >/dev/null
else
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=ale-tinker-lab \
    -p 5432:5432 \
    "$IMAGE" >/dev/null
fi

for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres -d ale-tinker-lab >/dev/null 2>&1 && break
  sleep 1
done

DATABASE_URL="$DATABASE_URL" npm run db:migrate

echo "export DATABASE_URL=\"$DATABASE_URL\"" >> "$CLAUDE_ENV_FILE"
echo "Test database ready (Postgres 18, migrated); DATABASE_URL is set." >&3
