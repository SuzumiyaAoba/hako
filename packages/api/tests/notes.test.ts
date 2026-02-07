import { describe, expect, it } from "vitest";

import { getNoteById, listNotes } from "../src/db/queries";
import * as schema from "../src/db/schema";
import { createTestDb } from "./helpers/create-test-db";

describe("listNotes", () => {
  it("returns stored notes ordered by title", async () => {
    const db = await createTestDb();
    await db
      .insert(schema.notes)
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

    const result = await listNotes(db);

    expect(result.map((note) => note.title)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("getNoteById", () => {
  it("returns a note when the id matches", async () => {
    const db = await createTestDb();
    await db
      .insert(schema.notes)
      .values({
        id: "note-1",
        title: "Alpha",
        path: "alpha.md",
        content: "# Alpha",
        contentHash: "hash-1",
        updatedAt: "2024-01-01T00:00:00Z",
      })
      .run();

    const result = await getNoteById(db, "note-1");

    expect(result?.title).toBe("Alpha");
  });

  it("returns undefined when the id is missing", async () => {
    const db = await createTestDb();

    const result = await getNoteById(db, "missing");

    expect(result).toBeUndefined();
  });
});
