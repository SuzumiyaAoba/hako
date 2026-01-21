import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("has a document body in jsdom", () => {
    expect(document.body).not.toBeNull();
  });
});
