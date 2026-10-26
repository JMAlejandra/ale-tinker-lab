# ale-tinker-lab

A personal experimentation sandbox: one T3-stack app (Next.js, tRPC, Drizzle,
Postgres) where each experiment is a route. It was created from the T3 Docker
scaffold, which still provides the Dockerized local dev environment below. See
`CONTEXT.md` for terminology and `docs/adr/` for the architectural decisions
behind this setup.

## Local setup (Docker, Linux)

```sh
git clone <this-repo-url>
cd ale-tinker-lab
cp .env.example .env
docker compose up -d
```

Postgres runs version 18, matching production on Neon (see
`docs/adr/0002-session-test-database.md`). If you have a `db-data` volume from
before the move to 18, recreate it once with `docker compose down -v` (this
deletes local data).

Then apply the initial migration using either workflow (see
[Database: migrations and seeding](#database-migrations-and-seeding) below
for the full command table):

- Host-installed npm scripts (primary, requires Node on the host): `npm run db:migrate`
- Fully containerized (fallback, no host Node required): `docker compose exec app npm run db:migrate`

Then open:

- The app: http://localhost:3000 (published port from the `app` service)
- Drizzle Studio: the port configured by `DRIZZLE_STUDIO_PORT` in `.env`
  (default `4983`)

The app ships with the T3 "Stock" example (a `post` router backed by a
Drizzle-managed Postgres table) so there's something real to click through
and query once the stack is up. Verify it end-to-end by creating a post from
the homepage and confirming it shows up in Drizzle Studio's `post` table.

## Cloud sessions

Claude Code cloud sessions have no Compose stack. Instead,
`.claude/hooks/session-start.sh` starts a throwaway Postgres 18 container,
applies migrations and sets `DATABASE_URL`, so `npm test` works there too.

## Git hooks

`npm install` enables the hooks in `.githooks/` (via the `prepare` script):

- **commit-msg**: messages must follow [Conventional Commits](https://www.conventionalcommits.org/),
  e.g. `feat: add search` or `fix(db): handle empty names`. CI checks PR titles
  the same way.
- **pre-commit**: runs lint, typecheck and tests, so the test database must be
  running (`docker compose up -d db`).

`git commit --no-verify` skips them in an emergency; CI still runs the same
checks. Rationale: `docs/adr/0003-git-hooks.md`.

## Manual smoke-test checklist

CI (see `.github/workflows/`) covers lint, typecheck, build, and automated
tests, but a few properties only show up when the stack is actually running.
Check these by hand after cloning or after touching the Docker setup:

- [ ] **Hot reload on host file save** — with `docker compose up` running,
      edit a string in `src/app/page.tsx` on the host and confirm the
      browser at `http://localhost:3000` updates without a manual rebuild.
- [ ] **Postgres data survives a restart** — create a post via the app (or
      insert a row via Drizzle Studio), run `docker compose down` then
      `docker compose up -d`, and confirm the row is still there. Data lives
      in the `db-data` named volume, so it should outlive the containers.
- [ ] **Drizzle Studio reachable on its published port** — visit
      `http://localhost:${DRIZZLE_STUDIO_PORT}` (default `4983`) and confirm
      the `post` table and its rows are visible.
- [ ] **Container-only fallback works with no host Node install** — without
      running any `npm` command on the host, run
      `docker compose exec app npm run db:migrate` against a fresh `db`
      volume and confirm the app still serves working pages afterward. This
      proves the container path alone is sufficient to stand up the stack.

## Installing Skills

This repo lists a set of [agent skills](https://skills.sh) in
`skills-lock.json`. Install them into the repo with:

```sh
npm run skills:install
```

This runs `npx skills experimental_install`, which reads `skills-lock.json`,
fetches the **current** version of each skill from its source repo into
`.agents/skills/`, and rewrites each `computedHash`. The hashes record what
was last installed; they don't pin a version, so a diff in them after an
install means an upstream skill changed. Re-run the command after pulling
changes to `skills-lock.json` to sync new or updated skills.

`to-spec` is not in the lock: it's committed at `.claude/skills/to-spec/`
(MIT, see its `LICENSE`) so it works in cloud sessions without an install
step. Update it by copying the new `SKILL.md` from upstream.

The following skills are installed from the lock:

| Skill                                                                                                                                     | Source                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [ask-matt](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md)                                           | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [claude-handoff](https://github.com/mattpocock/skills/blob/main/skills/in-progress/claude-handoff/SKILL.md)                               | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [code-review](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md)                                     | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [codebase-design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md)                             | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [diagnosing-bugs](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md)                             | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [domain-modeling](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md)                             | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [frontend-design](https://github.com/vercel-labs/open-agents/blob/main/.agents/skills/frontend-design/SKILL.md)                           | [vercel-labs/open-agents](https://github.com/vercel-labs/open-agents) |
| [git-guardrails-claude-code](https://github.com/mattpocock/skills/blob/main/skills/misc/git-guardrails-claude-code/SKILL.md)              | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [grill-me](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md)                                          | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [grill-with-docs](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md)                             | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md)                                          | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [handoff](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md)                                            | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [implement](https://github.com/mattpocock/skills/blob/main/skills/engineering/implement/SKILL.md)                                         | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [improve-codebase-architecture](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md) | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [prototype](https://github.com/mattpocock/skills/blob/main/skills/engineering/prototype/SKILL.md)                                         | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [research](https://github.com/mattpocock/skills/blob/main/skills/engineering/research/SKILL.md)                                           | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [scaffold-exercises](https://github.com/mattpocock/skills/blob/main/skills/misc/scaffold-exercises/SKILL.md)                              | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [setup-matt-pocock-skills](https://github.com/mattpocock/skills/blob/main/skills/engineering/setup-matt-pocock-skills/SKILL.md)           | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [setup-pre-commit](https://github.com/mattpocock/skills/blob/main/skills/misc/setup-pre-commit/SKILL.md)                                  | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [setup-ts-deep-modules](https://github.com/mattpocock/skills/blob/main/skills/in-progress/setup-ts-deep-modules/SKILL.md)                 | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [shadcn](https://github.com/shadcn/ui/blob/main/skills/shadcn/SKILL.md)                                                                   | [shadcn/ui](https://github.com/shadcn/ui)                             |
| [tdd](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md)                                                     | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [teach](https://github.com/mattpocock/skills/blob/main/skills/productivity/teach/SKILL.md)                                                | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [to-questionnaire](https://github.com/mattpocock/skills/blob/main/skills/productivity/to-questionnaire/SKILL.md)                          | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [to-tickets](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md)                                       | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [triage](https://github.com/mattpocock/skills/blob/main/skills/engineering/triage/SKILL.md)                                               | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [wait-what](https://github.com/mattpocock/skills/blob/main/skills/productivity/wait-what/SKILL.md)                                        | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [wayfinder](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md)                                         | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [wizard](https://github.com/mattpocock/skills/blob/main/skills/engineering/wizard/SKILL.md)                                               | [mattpocock/skills](https://github.com/mattpocock/skills)             |
| [writing-for-agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md)                      | [mattpocock/skills](https://github.com/mattpocock/skills)             |

Most of these come from [mattpocock/skills](https://github.com/mattpocock/skills);
`frontend-design` comes from [vercel-labs/open-agents](https://github.com/vercel-labs/open-agents),
and `shadcn` comes from [shadcn/ui](https://github.com/shadcn/ui).

## Auth

NextAuth.js is intentionally **not** included in this scaffold. Auth strategy and provider choice vary too
much per downstream project to pick a sensible default here, and ripping out
an unused auth config is more work than adding one when it's actually
needed.

To add auth to a downstream project created from this template, follow the [NextAuth.js
setup guide](https://next-auth.js.org/getting-started/introduction) (or
Auth.js for newer versions) directly: install the package, add the
`[...nextauth]` route handler under `src/app/api/auth/`, configure providers,
and wire `src/env.js` to validate any new auth-related environment
variables the same way it already validates `DATABASE_URL`.

## Deployment

Vercel builds a preview for every branch and deploys `main` to production,
with functions in `cle1`. Neon hosts Postgres in `aws-us-east-2`: the
`production` branch backs production, and the `dev` branch (fake data only)
backs every preview. The app connects through Neon's pooled string
(`DATABASE_URL`). Migrations use the direct string (`DATABASE_URL_UNPOOLED`)
and run during the Vercel build (`npm run build:deploy`) and again from
`.github/workflows/migrate.yml` after every merge to `main`. See
`docs/adr/0001-vercel-neon-deployment.md` for the details and rationale.

The `Dockerfile` and `docker-compose.yml` are for local development only.
Production does not run in Docker.

## Database: migrations and seeding

Drizzle migrations run via host-installed npm scripts as the **primary**
workflow (requires Node on the host, but gives full IDE/editor integration). Every script also
has a `docker compose exec app` equivalent that works with no Node installed
on the host.

The initial migration for the Stock example's schema is already generated and
checked into `drizzle/` — a fresh clone only needs one migrate command, not a
`db:generate` first.

| Purpose                              | Host (primary)        | Container (fallback)                          |
| ------------------------------------ | --------------------- | --------------------------------------------- |
| Apply migrations                     | `npm run db:migrate`  | `docker compose exec app npm run db:migrate`  |
| Generate a new migration             | `npm run db:generate` | `docker compose exec app npm run db:generate` |
| Push schema without a migration file | `npm run db:push`     | `docker compose exec app npm run db:push`     |
| Open Drizzle Studio (CLI)            | `npm run db:studio`   | `docker compose exec app npm run db:studio`   |

The host path connects to Postgres via its published port (`POSTGRES_PORT` in
`.env`); the container path connects to the `db` service directly. Both apply
against the same database. The `db:*` scripts use `DATABASE_URL_UNPOOLED` when
it's set and fall back to `DATABASE_URL`, so local setups only need the latter.

The Stock example does not ship a seed script, so there is no `db:seed`
script here.
