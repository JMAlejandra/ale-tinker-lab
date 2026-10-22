# 05 — README (setup, smoke-test checklist, auth notes) and template repo flag

**What to build:** A developer landing on the repo for the first time can read the README, follow it to a working local environment, manually verify the properties CI can't check, and knows how to add auth later. The repo is also flagged as a GitHub template, ready for "Use this template."

**Blocked by:** 02, 03, 04

**Status:** ready-for-agent

- [ ] README documents clone → `docker compose up` → verifying the Stock example works, including both migration workflows (host primary, container fallback) from ticket 03
- [ ] README includes a manual smoke-test checklist covering: hot reload on host file save, Postgres data surviving `docker compose down && up`, Drizzle Studio reachable on its published port, and the container-only fallback working with no host Node installed
- [ ] README documents that NextAuth is intentionally omitted (per ADR 0002) and how to add it to a Downstream project
- [ ] README documents that production deployment, prod Docker build target, and prod database provisioning are explicitly out of scope for the scaffold (per ADR 0001) and left to each Downstream project
- [ ] Repository is marked as a GitHub template repository (template flag enabled), so "Use this template" produces a clean Downstream project with no scaffold git history
