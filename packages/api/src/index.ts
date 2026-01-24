import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

import { db } from "./db";
import { createNotesRoutes } from "./routes/notes";

const routes = new Hono();
routes.get("/", (c) => c.text("Hako API"));
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

const port = Number(process.env["PORT"] ?? 8787);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Hako API listening on http://localhost:${info.port}`);
  },
);

export default app;
