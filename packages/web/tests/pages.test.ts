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

const config = {
  sourcePath: null,
  writeTargetPath: "/tmp/hako/config.yaml",
  notesDir: "/tmp/hako",
  zettelkasten: {
    directories: {
      fleeting: "fleeting",
      literature: "literature",
      permanent: "permanent",
      structure: "structure",
      index: "index",
    },
  },
  noteDirectories: {
    fleeting: "/tmp/hako/fleeting",
    literature: "/tmp/hako/literature",
    permanent: "/tmp/hako/permanent",
    structure: "/tmp/hako/structure",
    index: "/tmp/hako/index",
  },
};

const createJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

let originalFetch: typeof fetch | undefined;

const mockFetch = () => {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    if (url.endsWith("/config") && init?.method === "PUT") {
      return createJsonResponse(config);
    }
    if (url.endsWith("/config")) {
      return createJsonResponse(config);
    }
    if (url.endsWith("/notes")) {
      return createJsonResponse(notes);
    }
    if (url.includes("/notes/note-1")) {
      return createJsonResponse(notes[0]);
    }
    return new Response("not found", { status: 404 });
  });

  originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
};

describe("pages smoke", () => {
  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders home page", async () => {
    const response = await app.handle(new Request("http://localhost/"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/notes");
  });

  it("renders notes page", async () => {
    const response = await app.handle(new Request("http://localhost/notes?q=Al"));
    const html = await response.text();
    expect(html).toContain("Alpha");
  });

  it("renders note detail page", async () => {
    const response = await app.handle(new Request("http://localhost/notes/note-1"));
    const html = await response.text();
    expect(html).toContain("Alpha");
  });

  it("renders settings page", async () => {
    const response = await app.handle(new Request("http://localhost/settings/directories"));
    const html = await response.text();
    expect(html).toContain("設定");
    expect(html).toContain("Notes Root");
  });

  it("updates settings from settings page", async () => {
    const payload = new URLSearchParams({
      notesDir: "/tmp/next",
      fleeting: "f",
      literature: "l",
      permanent: "p",
      structure: "s",
      index: "i",
    });
    const response = await app.handle(
      new Request("http://localhost/settings/directories", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
      }),
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("設定を保存しました。");
  });
});
