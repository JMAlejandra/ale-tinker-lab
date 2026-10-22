import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import { posts } from "~/server/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run the Drizzle integration tests");
}

const client = postgres(connectionString);
const db = drizzle(client, { schema: { posts } });

afterAll(async () => {
  await client.end();
});

test("inserts a post and reads it back", async () => {
  const [inserted] = await db
    .insert(posts)
    .values({ name: "ci-test-post" })
    .returning();

  expect(inserted).toBeDefined();

  const [found] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, inserted!.id));

  expect(found?.name).toBe("ci-test-post");
});
