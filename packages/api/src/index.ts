import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { describeRoute, openAPIRouteHandler, resolver, validator } from "hono-openapi";
import { extendZodWithOpenApi } from "zod-openapi";
import { z } from "zod";

import { db } from "./db";
import { getNoteById, listNotes } from "./db/queries";

const routes = new Hono();

extendZodWithOpenApi(z);

const noteIdParamSchema = z.object({
  id: z.string().min(1),
});

const noteSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    path: z.string(),
    content: z.string(),
    contentHash: z.string(),
    updatedAt: z.string(),
  })
  .openapi({ ref: "Note" });

const errorSchema = z.object({
  message: z.string(),
});

routes.get("/", (c) => c.text("Hako API"));
routes.get(
  "/notes",
  describeRoute({
    responses: {
      200: {
        description: "List notes",
        content: {
          "application/json": {
            schema: resolver(z.array(noteSchema)),
          },
        },
      },
    },
  }),
  (c) => c.json(listNotes(db)),
);
routes.get(
  "/notes/:id",
  describeRoute({
    responses: {
      200: {
        description: "Get note by id",
        content: {
          "application/json": {
            schema: resolver(noteSchema),
          },
        },
      },
      400: {
        description: "Invalid note id",
        content: {
          "application/json": {
            schema: resolver(errorSchema),
          },
        },
      },
      404: {
        description: "Note not found",
        content: {
          "application/json": {
            schema: resolver(errorSchema),
          },
        },
      },
    },
  }),
  validator("param", noteIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json({ message: "Invalid note id" }, 400);
    }
  }),
  (c) => {
    const { id } = c.req.valid("param");
    const note = getNoteById(db, id);

    if (!note) {
      return c.json({ message: "Note not found" }, 404);
    }

    return c.json(note);
  },
);

const app = new Hono();
app.route("/", routes);
app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
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
