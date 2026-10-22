# 01 — Bootstrap scaffold via create-t3-app

**What to build:** The repo has a working T3-stack app structure, bootstrapped from the official `create-t3-app` CLI, with the Stock example intact and runnable on the host (no Docker involved yet).

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Repo initialized via `npm create t3-app@latest` with Next.js App Router, tRPC, Drizzle ORM, Tailwind CSS, npm selected, and NextAuth declined
- [ ] The CLI's generated Stock example (tRPC + Drizzle + UI wiring) is left intact — no custom example added, no removal tooling built
- [ ] `npm run dev` runs the app locally against a host-available Postgres (or documented local connection) and the Stock example works end-to-end
- [ ] `npm run build` succeeds
- [ ] `CONTEXT.md` and `docs/adr/` are respected — no changes needed unless bootstrap surfaces a conflict, in which case flag it rather than silently deviating
