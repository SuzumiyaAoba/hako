import { describe, expect, it, vi, beforeEach } from "vitest";
import { object, string } from "valibot";

import { fetchJson } from "../src/shared/api/client";

describe("fetchJson", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid JSON with schema", async () => {
    const schema = object({ message: string() });
    const response = new Response(JSON.stringify({ message: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock;

    const result = await fetchJson("/hello", schema);

    expect(fetchMock).toHaveBeenCalled();
    expect(result).toEqual({ message: "ok" });
  });

  it("throws on non-OK response", async () => {
    const schema = object({ message: string() });
    const response = new Response("not found", { status: 404 });

    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock;

    await expect(fetchJson("/missing", schema)).rejects.toThrow("404");
  });
});
