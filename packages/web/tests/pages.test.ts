import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import HomePage from "../app/page";
import NotesPage from "../app/notes/page";
import NotesDetailPage from "../app/notes/[id]/page";

const notes = [
  {
    id: "note-1",
    title: "Alpha",
    path: "alpha.md",
    content: "# Alpha",
    contentHash: "hash-1",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

globalThis.React = React;

const createJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const mockFetch = () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith("/notes")) {
      return createJsonResponse(notes);
    }
    if (url.includes("/notes/note-1")) {
      return createJsonResponse(notes[0]);
    }
    return new Response("not found", { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
};

describe("pages smoke", () => {
  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders home page", () => {
    const element = HomePage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Hako Web");
  });

  it("renders notes page", async () => {
    const element = await NotesPage({ searchParams: { q: "Al" } });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Alpha");
  });

  it("renders note detail page", async () => {
    const element = await NotesDetailPage({ params: { id: "note-1" } });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Alpha");
  });
});
