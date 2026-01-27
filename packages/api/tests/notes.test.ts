import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { getNoteById, listNotes } from "../src/db/queries";
import * as schema from "../src/db/schema";

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

describe("listNotes", () => {
  it("returns stored notes ordered by title", () => {
    const db = createDb();
    db.insert(schema.notes)
      .values([
        {
          id: "note-2",
          title: "Zeta",
          path: "zeta.md",
          content: "# Zeta",
          contentHash: "hash-2",
          updatedAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "note-1",
          title: "Alpha",
          path: "alpha.md",
          content: "# Alpha",
          contentHash: "hash-1",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ])
      .run();

    const result = listNotes(db);

    expect(result.map((note) => note.title)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("getNoteById", () => {
  it("returns a note when the id matches", () => {
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

    const result = getNoteById(db, "note-1");

    expect(result?.title).toBe("Alpha");
  });

  it("returns undefined when the id is missing", () => {
    const db = createDb();

    const result = getNoteById(db, "missing");

    expect(result).toBeUndefined();
  });
});
