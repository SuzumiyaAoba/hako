import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { createTestDb } from "./helpers/create-test-db";
import { createNotesRoutes } from "../src/routes/notes";

describe("openapi", () => {
  it("includes notes routes", async () => {
    const db = await createTestDb();
    const routes = new Hono();
    routes.route("/", createNotesRoutes(db));

    const app = new Hono();
    app.route("/", routes);
    app.get(
      "/openapi.json",
      openAPIRouteHandler(routes, {
        documentation: {
          info: {
            title: "Hako API",
            version: "0.0.0",
          },
        },
      }),
    );

    const response = await app.request("http://localhost/openapi.json");
    const body = await response.json();

    const paths = Object.keys(body.paths ?? {});
    expect(paths).toContain("/notes");
    expect(paths).toContain("/notes/import");
    expect(paths).toContain("/notes/reindex");
    const hasDetail = paths.some((path) => path === "/notes/{id}" || path === "/notes/:id");
    expect(hasDetail).toBe(true);
  });
});
