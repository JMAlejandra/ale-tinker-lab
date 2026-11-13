# Git hooks

Status: in use · Last updated: 2026-11-13

Plain shell hooks that check commit messages, branch names and the code before it leaves a machine, plus a CI workflow that applies the same rules to pull requests.

## What it does

- **`commit-msg`**: rejects a commit whose subject isn't a Conventional Commit, e.g. `feat: add search` or `fix(db)!: drop old column`.
- **`pre-commit`**: runs lint, typecheck and tests on every commit.
- **`pre-push`**: rejects pushing a branch not named `<type>/<short-name>` in lowercase kebab-case, e.g. `docs/feature-docs`.
- **`PR title` workflow** (`.github/workflows/pr-title.yml`): on every pull request, job `pr-title` checks the title and job `branch-name` checks the head branch.

Allowed types: `feat fix docs chore refactor test ci build perf style revert`.

## How it works

- **Enabling.** The npm `prepare` script runs `git config core.hooksPath .githooks`, so `npm install` or `npm ci` turns the hooks on. It's a no-op without a git repository.
- **`scripts/conventional-types.sh`** defines `TYPES`, sourced by both checkers, so commits, titles and branches share one list.
- **`scripts/check-commit-message.sh`** reads a subject on stdin. Subjects git writes itself (`Merge `, `Revert "`, `fixup! `, `squash! `, `amend! `) pass.
- **`scripts/check-branch-name.sh`** takes a branch name as `$1`. `main` and `prototype/*` are exempt.
- **`commit-msg`** strips comment and blank lines, then pipes the message to the commit checker, which reads its first line.
- **`pre-push`** checks each pushed `refs/heads/*` ref; deleting a remote branch is always allowed.
- **`pre-commit`**, in order: requires `node_modules`; reads `DATABASE_URL` from `.env` if it isn't set (jest doesn't load `.env`); refuses any URL not on `localhost` or `127.0.0.1`; checks the database answers `select 1`; then runs `npm run lint` (with `SKIP_ENV_VALIDATION=1`), `npm run typecheck` and `npm test`.
- **`pr-title.yml`** runs on `opened`, `edited`, `synchronize` and `reopened`, calling the same two scripts.

## What it can't do

- Hooks are a convenience, not a gate: `--no-verify` skips them. CI's `Lint`, `Typecheck`, `Test` and `PR title` workflows run the same checks on every PR.
- `pre-push` doesn't stop a push to `main`, which is exempt. Keeping work off `main` relies on the workflow in `CLAUDE.md`.
- Only the subject is checked; the commit body is free-form.
- `pre-commit` needs a running test database, and refuses to run tests against any `DATABASE_URL` that isn't on localhost, so tests can never write to Neon.

## Decisions

- Plain shell scripts in `.githooks/`, no hook manager: see `docs/adr/0003-git-hooks.md`.
- Conventional Commits, also checked on PR titles because squash merges use them: see ADR 0003.
- Full lint, typecheck and tests on every commit rather than on push: see ADR 0003.
- Branch names `<type>/<short-name>` with the same types: no ADR (added in `0e506f0`).

## Operating it

- **Existing clone.** Run `npm install` (or `npm run prepare`) once to enable the hooks.
- **Test database down.** Locally, `docker compose up -d db`. In a cloud session, a machine restart can leave Docker stopped without the session hook rerunning; `pre-commit` detects this and says to rerun `.claude/hooks/session-start.sh`, which is safe to run by hand.
- **Renaming a branch.** `git branch -m <new-name>`, as the checker suggests.
- **Adding a type.** Edit `TYPES` in `scripts/conventional-types.sh`; both hooks and CI pick it up.

## Open questions

- Moving tests from `pre-commit` to `pre-push` once the suite gets slow (ADR 0003).
