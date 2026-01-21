import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { listNotes } from "../src/db/queries";
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
