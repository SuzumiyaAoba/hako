import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";

import * as schema from "../src/db/schema";
import { createNotesRoutes } from "../src/routes/notes";

const createDb = () => {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    create table notes (
      id text primary key,
      title text not null,
      path text not null unique,
      content text not null,
      content_hash text not null,
      updated_at text not null
    );
  `);
  return drizzle(sqlite, { schema });
};

describe("notes routes", () => {
  it("returns notes from /notes", async () => {
    const db = createDb();
    db.insert(schema.notes)
      .values({
        id: "note-1",
        title: "Alpha",
        path: "alpha.md",
        content: "# Alpha",
        contentHash: "hash-1",
        updatedAt: "2024-01-01T00:00:00Z",
      })
      .run();

    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([
      {
        id: "note-1",
        title: "Alpha",
        path: "alpha.md",
        content: "# Alpha",
        contentHash: "hash-1",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ]);
  });

  it("returns 404 when note is missing", async () => {
    const db = createDb();
    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/missing");

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ message: "Note not found" });
  });
});
