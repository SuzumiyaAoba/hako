import { describe, expect, it } from "vitest";
import { Elysia } from "elysia";

import { createTestDb } from "./helpers/create-test-db";
import { createOpenApiDocument } from "../src/openapi";
import { createNotesRoutes } from "../src/routes/notes";

describe("openapi", () => {
  it("includes notes routes", async () => {
    const db = await createTestDb();
    const app = new Elysia()
      .use(createNotesRoutes(db))
      .get("/openapi.json", () => createOpenApiDocument());

    const response = await app.handle(new Request("http://localhost/openapi.json"));
    const body = await response.json();

    const paths = Object.keys(body.paths ?? {});
    expect(paths).toContain("/notes");
    expect(paths).toContain("/notes/import");
    expect(paths).toContain("/notes/reindex");
    expect(paths).toContain("/config");
    const hasDetail = paths.some((path) => path === "/notes/{id}" || path === "/notes/:id");
    expect(hasDetail).toBe(true);
  });
});
