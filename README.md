# ale-tinker-lab

A personal experimentation sandbox: one T3-stack app (Next.js, tRPC, Drizzle,
Postgres) where each experiment is a route. It was created from the T3 Docker
scaffold, which still provides the Dockerized local dev environment below. See
`CONTEXT.md` for project context, `GLOSSARY.md` for terminology and `docs/adr/`
for the architectural decisions behind this setup.

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

## Agent skills

The repo commits its [agent skills](https://skills.sh) in `.claude/skills/`,
where Claude Code loads them, locally and in cloud sessions, with no install
step. Each skill is an unchanged copy of an MIT-licensed upstream skill; its
`LICENSE` file names the exact source commit. `grilling` is kept because
`grill-me`, `grill-with-docs`, `triage`, `wayfinder` and
`improve-codebase-architecture` all run it.

"auto" skills can also be picked by Claude when a task matches their
description; "only" skills run when you type the command. The vendored
`code-review` replaces Claude Code's built-in `/code-review`.

| Skill | Source | Invocation |
| --- | --- | --- |
| [ask-matt](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/ask-matt/SKILL.md) | mattpocock/skills@5beb35b | `/ask-matt` only |
| [code-review](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/code-review/SKILL.md) | mattpocock/skills@5beb35b | auto + `/code-review` |
| [codebase-design](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/codebase-design/SKILL.md) | mattpocock/skills@5beb35b | auto + `/codebase-design` |
| [diagnosing-bugs](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/diagnosing-bugs/SKILL.md) | mattpocock/skills@5beb35b | auto + `/diagnosing-bugs` |
| [domain-modeling](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/domain-modeling/SKILL.md) | mattpocock/skills@5beb35b | auto + `/domain-modeling` |
| [frontend-design](https://github.com/vercel-labs/open-agents/tree/cf865e94de7729751c747171785b6ce57e7b178c/.agents/skills/frontend-design/SKILL.md) | vercel-labs/open-agents@cf865e9 | auto + `/frontend-design` |
| [grill-me](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/productivity/grill-me/SKILL.md) | mattpocock/skills@5beb35b | `/grill-me` only |
| [grill-with-docs](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/grill-with-docs/SKILL.md) | mattpocock/skills@5beb35b | `/grill-with-docs` only |
| [grilling](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/productivity/grilling/SKILL.md) | mattpocock/skills@5beb35b | auto + `/grilling` |
| [handoff](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/productivity/handoff/SKILL.md) | mattpocock/skills@5beb35b | `/handoff` only |
| [implement](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/implement/SKILL.md) | mattpocock/skills@5beb35b | `/implement` only |
| [improve-codebase-architecture](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/improve-codebase-architecture/SKILL.md) | mattpocock/skills@5beb35b | `/improve-codebase-architecture` only |
| [prototype](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/prototype/SKILL.md) | mattpocock/skills@5beb35b | auto + `/prototype` |
| [research](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/research/SKILL.md) | mattpocock/skills@5beb35b | auto + `/research` |
| [setup-matt-pocock-skills](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/setup-matt-pocock-skills/SKILL.md) | mattpocock/skills@5beb35b | `/setup-matt-pocock-skills` only |
| [shadcn](https://github.com/shadcn/ui/tree/481d523374745e77d0cf9c53a4115ab5dd7c8481/skills/shadcn/SKILL.md) | shadcn/ui@481d523 | auto + `/shadcn` |
| [tdd](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/tdd/SKILL.md) | mattpocock/skills@5beb35b | auto + `/tdd` |
| [teach](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/productivity/teach/SKILL.md) | mattpocock/skills@5beb35b | `/teach` only |
| [to-questionnaire](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/productivity/to-questionnaire/SKILL.md) | mattpocock/skills@5beb35b | `/to-questionnaire` only |
| [to-spec](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/to-spec/SKILL.md) | mattpocock/skills@5beb35b | `/to-spec` only |
| [to-tickets](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/to-tickets/SKILL.md) | mattpocock/skills@5beb35b | `/to-tickets` only |
| [triage](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/triage/SKILL.md) | mattpocock/skills@5beb35b | `/triage` only |
| [wait-what](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/productivity/wait-what/SKILL.md) | mattpocock/skills@5beb35b | `/wait-what` only |
| [wayfinder](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/wayfinder/SKILL.md) | mattpocock/skills@5beb35b | `/wayfinder` only |
| [writing-for-agents](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/productivity/writing-for-agents/SKILL.md) | mattpocock/skills@5beb35b | auto + `/writing-for-agents` |

To update or add a skill, copy its folder from the upstream repo at a known
commit into `.claude/skills/<name>/` (leave out `agents/` and `evals/`), and
update the source line in its `LICENSE`. Review the diff like any other code
before committing.
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
