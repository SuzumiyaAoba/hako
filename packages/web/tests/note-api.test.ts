import { describe, expect, it, vi, beforeEach } from "vitest";

import { parse } from "valibot";

import { getNote, getNotes } from "../src/entities/note/api/notes";
import { NoteSchema } from "../src/entities/note/model/types";

const note = {
  id: "note-1",
  title: "Alpha",
  path: "alpha.md",
  content: "# Alpha",
  contentHash: "hash-1",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("note api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getNotes returns parsed notes", async () => {
    const response = new Response(JSON.stringify([note]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock;

    const result = await getNotes();

    expect(result).toEqual([note]);
  });

  it("getNote returns null on 404", async () => {
    const response = new Response("not found", { status: 404 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock;

    const result = await getNote(note.id);

    expect(result).toBeNull();
  });

  it("getNote validates response shape", async () => {
    const invalid = { ...note, title: 123 };
    const response = new Response(JSON.stringify(invalid), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock;

    await expect(getNote(note.id)).rejects.toThrow();
  });

  it("note schema accepts valid note", () => {
    expect(() => parse(NoteSchema, note)).not.toThrow();
  });
});
