import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env["DATABASE_URL"] ?? "file:./data/hako.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl,
  },
});
