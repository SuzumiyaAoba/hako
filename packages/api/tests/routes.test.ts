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
    create table links (
      id integer primary key autoincrement,
      from_note_id text not null,
      to_note_id text,
      to_title text not null,
      to_path text,
      link_text text,
      position integer
    );
    create table note_link_states (
      note_id text primary key,
      content_hash text not null,
      indexed_at text not null
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

  it("imports note paths without storing content", async () => {
    const db = createDb();
    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/import", {
      method: "POST",
      body: JSON.stringify({ paths: ["/tmp/Alpha.md"] }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.created).toBe(1);
    expect(body.notes[0]).toMatchObject({
      title: "Alpha",
      path: "/tmp/Alpha.md",
      status: "created",
    });

    const notes = db.select().from(schema.notes).all();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe("");
    expect(notes[0]?.path).toBe("/tmp/Alpha.md");
  });

  it("reindexes note links and skips unchanged notes", async () => {
    const db = createDb();
    db.insert(schema.notes)
      .values([
        {
          id: "note-1",
          title: "Alpha",
          path: "alpha.md",
          content: "See [[Beta|B]]",
          contentHash: "hash-1",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "note-2",
          title: "Beta",
          path: "beta.md",
          content: "No links",
          contentHash: "hash-2",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ])
      .run();

    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const firstResponse = await app.request("http://localhost/notes/reindex", { method: "POST" });

    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    expect(firstBody.notesTotal).toBe(2);
    expect(firstBody.notesIndexed).toBe(2);
    expect(firstBody.notesSkipped).toBe(0);
    expect(firstBody.linksInserted).toBe(1);

    const links = db.select().from(schema.links).all();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      fromNoteId: "note-1",
      toNoteId: "note-2",
      toTitle: "Beta",
      toPath: "beta.md",
      linkText: "B",
      position: 0,
    });

    const secondResponse = await app.request("http://localhost/notes/reindex", { method: "POST" });

    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.notesTotal).toBe(2);
    expect(secondBody.notesIndexed).toBe(0);
    expect(secondBody.notesSkipped).toBe(2);
    expect(secondBody.linksInserted).toBe(0);
    expect(secondBody.linksDeleted).toBe(0);
  });
});
