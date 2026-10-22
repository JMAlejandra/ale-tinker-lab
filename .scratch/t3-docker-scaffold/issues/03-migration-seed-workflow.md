# 03 — Migration/seed workflow with pregenerated initial migration

**What to build:** A developer can apply the Stock example's schema to a fresh containerized Postgres via host-installed npm scripts (primary path) or entirely from inside the container (fallback, no host Node required).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Initial Drizzle migration for the Stock example's schema is generated ahead of time and checked into the repo (not generated on first run)
- [ ] Host-installed npm scripts (e.g. `npm run db:migrate`, `npm run db:seed`) work against the containerized `db` service and are documented as the primary workflow — see ADR 0003 for why this is primary despite the scaffold's original zero-install framing
- [ ] Every migration/seed npm script has a documented `docker compose exec app npm run ...` equivalent that works with no Node installed on the host
- [ ] Verified: on a fresh clone with `docker compose up` running, one migrate command (either path) produces a working schema matching the Stock example
- [ ] Verified: the seed script (if the Stock example ships one) works via both the host and container-exec paths
