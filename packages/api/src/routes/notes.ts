import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { minLength, object, pipe, string } from "valibot";

import { NoteIdSchema, NoteSchema, NotesSchema } from "@hako/core";

import type { DbClient } from "../db/queries";
import { getNoteById, listNotes } from "../db/queries";

/**
 * Notes-related routes.
 */
export const createNotesRoutes = (db: DbClient) => {
  const routes = new Hono();

  const noteIdParamSchema = object({
    id: NoteIdSchema,
  });

  const errorSchema = object({
    message: pipe(string(), minLength(1)),
  });

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

  return routes;
};
