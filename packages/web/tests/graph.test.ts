import { describe, expect, it } from "vitest";

import { buildNoteGraph } from "../src/shared/lib/graph";

const notes = [
  {
    id: "note-1",
    title: "Alpha",
    path: "alpha.md",
    content: "See [[Beta]]",
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
];

describe("buildNoteGraph", () => {
  it("creates nodes and links", () => {
    const graph = buildNoteGraph(notes);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.links).toEqual([{ source: "note-1", target: "note-2" }]);
  });
});
