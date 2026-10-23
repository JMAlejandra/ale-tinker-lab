import { type Config } from "drizzle-kit";

/**
 * Migrations use the direct (unpooled) connection, falling back to `DATABASE_URL` when it's unset
 * (e.g. local Docker Postgres, where there's no pooler).
 *
 * This reads `process.env` directly instead of importing `~/env`: that schema requires
 * `DATABASE_URL`, but the after-merge migration workflow only provides `DATABASE_URL_UNPOOLED`.
 * drizzle-kit loads `.env` itself, so local runs still pick up values from it.
 */
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL to run drizzle-kit");
}

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
  tablesFilter: ["ale_tinker_lab_*"],
} satisfies Config;
