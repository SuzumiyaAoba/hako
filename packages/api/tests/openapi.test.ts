import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "../src/db/schema";
import { createNotesRoutes } from "../src/routes/notes";

const createDb = () => {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    create table notes (
      id text primary key,
      title text not null,
      path text not null unique,
      content text not null,
      content_hash text not null,
      updated_at text not null
    );
  `);
  return drizzle(sqlite, { schema });
};

describe("openapi", () => {
  it("includes notes routes", async () => {
    const db = createDb();
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
    const hasDetail = paths.some((path) => path === "/notes/{id}" || path === "/notes/:id");
    expect(hasDetail).toBe(true);
  });
});
