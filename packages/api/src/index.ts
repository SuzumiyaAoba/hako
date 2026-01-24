import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { describeRoute, openAPIRouteHandler, resolver, validator } from "hono-openapi";
import { object, pipe, string, minLength } from "valibot";

import { NoteIdSchema, NoteSchema, NotesSchema } from "@hako/core";

import { db } from "./db";
import { getNoteById, listNotes } from "./db/queries";

const routes = new Hono();

const noteIdParamSchema = object({
  id: NoteIdSchema,
});

const errorSchema = object({
  message: pipe(string(), minLength(1)),
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
            schema: resolver(NotesSchema),
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
            schema: resolver(NoteSchema),
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
  validator("param", noteIdParamSchema, (result, c): Response | void => {
    if (!result.success) {
      return c.json({ message: "Invalid note id" }, 400);
    }
    return undefined;
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
