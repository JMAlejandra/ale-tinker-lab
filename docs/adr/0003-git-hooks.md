# 0003: Dependency-free git hooks, full checks on every commit

Status: accepted (2026-10-26)

## Context

Commit messages had no convention, and lint, typecheck and tests only ran in CI, after a push. Commits come from a Linux machine and from Claude Code cloud sessions, and both should follow the same rules.

## Decision

**Hooks are plain shell scripts in `.githooks/`**, with no hook-manager dependency. The npm `prepare` script runs `git config core.hooksPath .githooks`, so `npm install` or `npm ci` enables them. It's a no-op where there's no git repository, such as the Docker image build.

**`commit-msg` enforces Conventional Commits** through `scripts/check-commit-message.sh`. Messages git writes itself (merges, reverts, `fixup!`) pass. A `PR title` workflow runs the same script on pull request titles, because squash merges use the title as the commit message and the local hook never sees it.

**`pre-commit` runs lint, typecheck and tests on every commit.** This was chosen over the faster "lint on commit, tests on push" for the strongest guarantee per commit. The suite takes a few seconds today. Before running tests, the hook:

- requires `node_modules`;
- reads `DATABASE_URL` from `.env` when it isn't set, because jest doesn't load `.env`;
- refuses any database that isn't on `localhost`, so tests can never write to Neon;
- checks the database is reachable, and prints how to start it if it isn't.

## Consequences

- Committing needs a running test database: `docker compose up -d db` locally, or the session hook in cloud sessions (ADR 0002).
- Commits get slower as the test suite grows. Moving tests to `pre-push` is the planned fix when that hurts.
- Hooks are a convenience, not a gate: `git commit --no-verify` skips them. CI runs the same checks on every PR.
- After pulling this change, an existing clone needs one `npm install` (or `npm run prepare`) to enable the hooks.
