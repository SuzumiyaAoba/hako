import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("runs in node runtime", () => {
    expect(typeof process.pid).toBe("number");
  });
});
