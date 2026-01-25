import { describe, expect, it } from "vitest";
import { parse } from "valibot";

import { NoteIdSchema } from "@hako/core";

describe("NoteIdSchema", () => {
  it("rejects empty string", () => {
    expect(() => parse(NoteIdSchema, "")).toThrow();
  });

  it("accepts non-empty string", () => {
    expect(() => parse(NoteIdSchema, "note-1")).not.toThrow();
  });
});
