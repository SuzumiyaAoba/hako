import { writeFile, unlink } from "node:fs/promises";

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

  it("returns note content from filesystem", async () => {
    const db = createDb();
    const filePath = "/tmp/hako-note-detail.md";
    await writeFile(filePath, "# Hello\n");

    db.insert(schema.notes)
      .values({
        id: "note-1",
        title: "Hello",
        path: filePath,
        content: "",
        contentHash: "hash-1",
        updatedAt: "2024-01-01T00:00:00Z",
      })
      .run();

    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    try {
      const response = await app.request("http://localhost/notes/note-1");

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.content).toBe("# Hello\n");
    } finally {
      await unlink(filePath).catch(() => undefined);
    }
  });

  it("returns 404 when note file is missing", async () => {
    const db = createDb();
    db.insert(schema.notes)
      .values({
        id: "note-1",
        title: "Missing",
        path: "/tmp/hako-missing.md",
        content: "",
        contentHash: "hash-1",
        updatedAt: "2024-01-01T00:00:00Z",
      })
      .run();

    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/note-1");

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ message: "Note file not found" });
  });

  it("imports note paths without storing content", async () => {
    const db = createDb();
    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/import", {
      method: "POST",
      body: JSON.stringify({ notes: [{ path: "/tmp/Alpha.md", title: "From Frontmatter" }] }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.created).toBe(1);
    expect(body.notes[0]).toMatchObject({
      title: "From Frontmatter",
      path: "/tmp/Alpha.md",
      status: "created",
    });

    const notes = db.select().from(schema.notes).all();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe("");
    expect(notes[0]?.path).toBe("/tmp/Alpha.md");
  });

  it("imports note paths using fallback titles", async () => {
    const db = createDb();
    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/import", {
      method: "POST",
      body: JSON.stringify({ paths: ["/tmp/Delta.md"] }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.created).toBe(1);
    expect(body.notes[0]).toMatchObject({
      title: "Delta",
      path: "/tmp/Delta.md",
      status: "created",
    });
  });

  it("skips import when nothing changes", async () => {
    const db = createDb();
    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const payload = { notes: [{ path: "/tmp/Skip.md", title: "Skip" }] };

    const firstResponse = await app.request("http://localhost/notes/import", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    expect(firstResponse.status).toBe(200);

    const secondResponse = await app.request("http://localhost/notes/import", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    expect(secondResponse.status).toBe(200);

    const secondBody = await secondResponse.json();
    expect(secondBody.created).toBe(0);
    expect(secondBody.updated).toBe(0);
    expect(secondBody.skipped).toBe(1);
    expect(secondBody.notes[0]).toMatchObject({ status: "skipped" });
  });

  it("updates title on import without overwriting content hash when content exists", async () => {
    const db = createDb();
    db.insert(schema.notes)
      .values({
        id: "note-1",
        title: "Old",
        path: "/tmp/Keep.md",
        content: "content",
        contentHash: "hash-keep",
        updatedAt: "2024-01-01T00:00:00Z",
      })
      .run();

    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/import", {
      method: "POST",
      body: JSON.stringify({ notes: [{ path: "/tmp/Keep.md", title: "New" }] }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.updated).toBe(1);
    expect(body.notes[0]).toMatchObject({
      title: "New",
      path: "/tmp/Keep.md",
      status: "updated",
    });

    const notes = db.select().from(schema.notes).all();
    expect(notes[0]?.contentHash).toBe("hash-keep");
  });

  it("returns 400 for invalid import body", async () => {
    const db = createDb();
    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/import", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ message: "Invalid request body" });
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

  it("reindexes only changed notes and keeps unresolved links", async () => {
    const db = createDb();
    db.insert(schema.notes)
      .values([
        {
          id: "note-1",
          title: "Alpha",
          path: "alpha.md",
          content: "See [[Missing]]",
          contentHash: "hash-1",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "note-2",
          title: "Beta",
          path: "beta.md",
          content: "See [[Alpha]]",
          contentHash: "hash-2",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ])
      .run();

    db.insert(schema.noteLinkStates)
      .values({
        noteId: "note-1",
        contentHash: "hash-1",
        indexedAt: "2024-01-01T00:00:00Z",
      })
      .run();

    db.insert(schema.links)
      .values({
        fromNoteId: "note-2",
        toNoteId: null,
        toTitle: "Stale",
        toPath: null,
        linkText: "Stale",
        position: 0,
      })
      .run();

    const app = new Hono();
    app.route("/", createNotesRoutes(db));

    const response = await app.request("http://localhost/notes/reindex", { method: "POST" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.notesTotal).toBe(2);
    expect(body.notesIndexed).toBe(1);
    expect(body.notesSkipped).toBe(1);
    expect(body.linksDeleted).toBe(1);
    expect(body.linksInserted).toBe(1);

    const links = db.select().from(schema.links).all();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      fromNoteId: "note-2",
      toNoteId: "note-1",
      toTitle: "Alpha",
      toPath: "alpha.md",
    });

    const missingLinks = links.filter((link) => link.toNoteId === null);
    expect(missingLinks).toHaveLength(0);
  });
});
