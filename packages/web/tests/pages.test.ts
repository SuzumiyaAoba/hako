import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";

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

const createJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const mockFetch = () => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
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

  it("renders home page", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();
    expect(html).toContain("Hako Web");
  });

  it("renders notes page", async () => {
    const response = await app.request("http://localhost/notes?q=Al");
    const html = await response.text();
    expect(html).toContain("Alpha");
  });

  it("renders note detail page", async () => {
    const response = await app.request("http://localhost/notes/note-1");
    const html = await response.text();
    expect(html).toContain("Alpha");
  });
});
