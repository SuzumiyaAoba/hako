import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { minLength, number, object, pipe, string } from "valibot";

import { extractWikiLinks, NoteIdSchema, NoteSchema, NotesSchema, type Note } from "@hako/core";

import type { DbClient } from "../db/queries";
import { getNoteById, listNotes } from "../db/queries";
import * as schema from "../db/schema";

/**
 * Response schema for link reindexing.
 */
const reindexResponseSchema = object({
  startedAt: string(),
  finishedAt: string(),
  durationMs: number(),
  notesTotal: number(),
  notesIndexed: number(),
  notesSkipped: number(),
  linksInserted: number(),
  linksDeleted: number(),
});

type ReindexStats = {
  notesIndexed: number;
  notesSkipped: number;
  linksInserted: number;
  linksDeleted: number;
};

type LinkInsert = typeof schema.links.$inferInsert;

type NoteLinkStateInsert = typeof schema.noteLinkStates.$inferInsert;

/**
 * Builds a lookup table keyed by note title.
 */
const buildTitleMap = (notes: ReadonlyArray<Note>): Map<string, Note> =>
  new Map(notes.map((note) => [note.title, note]));

/**
 * Builds link insert rows for a single note.
 */
const buildLinkInserts = (
  note: Note,
  titleMap: Map<string, Note>,
): { links: LinkInsert[]; total: number } => {
  const extracted = extractWikiLinks(note.content);
  if (extracted.length === 0) {
    return { links: [], total: 0 };
  }

  const links: LinkInsert[] = extracted.map((link, index) => {
    const target = titleMap.get(link.title);
    return {
      fromNoteId: note.id,
      toNoteId: target?.id ?? null,
      toTitle: link.title,
      toPath: target?.path ?? null,
      linkText: link.label,
      position: index,
    };
  });

  return { links, total: links.length };
};

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

  routes.post(
    "/notes/reindex",
    describeRoute({
      responses: {
        200: {
          description: "Reindex note links",
          content: {
            "application/json": {
              schema: resolver(reindexResponseSchema),
            },
          },
        },
      },
    }),
    (c) => {
      const startedAt = new Date();
      const startedAtMs = startedAt.getTime();
      const notes = listNotes(db);
      const titleMap = buildTitleMap(notes);
      const existingStates = db.select().from(schema.noteLinkStates).all();
      const stateMap = new Map(existingStates.map((state) => [state.noteId, state.contentHash]));
      const indexedAt = new Date().toISOString();

      const stats = db.transaction((tx): ReindexStats => {
        let notesIndexed = 0;
        let notesSkipped = 0;
        let linksInserted = 0;
        let linksDeleted = 0;

        for (const note of notes) {
          const previousHash = stateMap.get(note.id);
          if (previousHash === note.contentHash) {
            notesSkipped += 1;
            continue;
          }

          notesIndexed += 1;
          const deleteResult = tx
            .delete(schema.links)
            .where(eq(schema.links.fromNoteId, note.id))
            .run();
          linksDeleted += deleteResult.changes ?? 0;

          const { links, total } = buildLinkInserts(note, titleMap);
          if (total > 0) {
            tx.insert(schema.links).values(links).run();
            linksInserted += total;
          }

          const state: NoteLinkStateInsert = {
            noteId: note.id,
            contentHash: note.contentHash,
            indexedAt,
          };
          tx.insert(schema.noteLinkStates)
            .values(state)
            .onConflictDoUpdate({
              target: schema.noteLinkStates.noteId,
              set: {
                contentHash: note.contentHash,
                indexedAt,
              },
            })
            .run();
        }

        return {
          notesIndexed,
          notesSkipped,
          linksInserted,
          linksDeleted,
        };
      });

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAtMs;

      return c.json({
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        notesTotal: notes.length,
        notesIndexed: stats.notesIndexed,
        notesSkipped: stats.notesSkipped,
        linksInserted: stats.linksInserted,
        linksDeleted: stats.linksDeleted,
      });
    },
  );

  return routes;
};
