import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { array, minLength, number, object, pipe, string, union } from "valibot";

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
 * Response schema for note import.
 */
const importResponseSchema = object({
  startedAt: string(),
  finishedAt: string(),
  durationMs: number(),
  total: number(),
  created: number(),
  updated: number(),
  skipped: number(),
  notes: array(
    object({
      id: string(),
      title: string(),
      path: string(),
      status: string(),
    }),
  ),
});

type ImportStatus = "created" | "updated" | "skipped";

type ImportNoteResult = {
  id: string;
  title: string;
  path: string;
  status: ImportStatus;
};

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
};

/**
 * Derives a note title from a file path.
 */
const deriveTitleFromPath = (path: string): string => {
  const filename = basename(path);
  const extension = extname(filename);
  return extension.length > 0 ? filename.slice(0, -extension.length) : filename;
};

/**
 * Computes a stable identifier for a note path.
 */
const computeNoteId = (path: string): string => createHash("sha256").update(path).digest("hex");

/**
 * Computes a lightweight fingerprint without reading file contents.
 */
const computeSourceFingerprint = async (path: string): Promise<string> => {
  try {
    const stats = await stat(path);
    const fingerprint = `${path}:${stats.mtimeMs}:${stats.size}`;
    return createHash("sha256").update(fingerprint).digest("hex");
  } catch {
    return createHash("sha256").update(path).digest("hex");
  }
};
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

  const importNoteSchema = object({
    path: pipe(string(), minLength(1)),
    title: string(),
  });

  const importBodySchema = union([
    object({
      paths: array(pipe(string(), minLength(1))),
    }),
    object({
      notes: array(importNoteSchema),
    }),
  ]);

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
    "/notes/import",
    describeRoute({
      responses: {
        200: {
          description: "Import note paths",
          content: {
            "application/json": {
              schema: resolver(importResponseSchema),
            },
          },
        },
      },
    }),
    validator("json", importBodySchema, (result, c): Response | void => {
      if (!result.success) {
        return c.json({ message: "Invalid request body" }, 400);
      }
      return undefined;
    }),
    async (c) => {
      const startedAt = new Date();
      const startedAtMs = startedAt.getTime();
      const body = c.req.valid("json");
      const notesInput =
        "notes" in body ? body.notes : body.paths.map((path) => ({ path, title: "" }));
      const paths = notesInput.map((note) => note.path);

      const results: ImportNoteResult[] = [];
      const imports = await Promise.all(
        notesInput.map(async (note) => ({
          path: note.path,
          title: note.title.trim() || deriveTitleFromPath(note.path),
          sourceHash: await computeSourceFingerprint(note.path),
        })),
      );

      const stats = db.transaction((tx): ImportStats => {
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const entry of imports) {
          const { path, title, sourceHash } = entry;
          const existing = tx.select().from(schema.notes).where(eq(schema.notes.path, path)).get();

          if (!existing) {
            const id = computeNoteId(path);
            tx.insert(schema.notes)
              .values({
                id,
                title,
                path,
                content: "",
                contentHash: sourceHash,
                updatedAt: new Date().toISOString(),
              })
              .run();
            results.push({ id, title, path, status: "created" });
            created += 1;
            continue;
          }

          const canUpdateContentHash = existing.content === "";
          const shouldUpdate =
            existing.title !== title ||
            (canUpdateContentHash && existing.contentHash !== sourceHash);

          if (!shouldUpdate) {
            results.push({
              id: existing.id,
              title: existing.title,
              path: existing.path,
              status: "skipped",
            });
            skipped += 1;
            continue;
          }

          tx.update(schema.notes)
            .set({
              title,
              updatedAt: new Date().toISOString(),
              ...(canUpdateContentHash ? { contentHash: sourceHash } : {}),
            })
            .where(eq(schema.notes.path, path))
            .run();

          results.push({ id: existing.id, title, path, status: "updated" });
          updated += 1;
        }

        return { created, updated, skipped };
      });

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAtMs;

      return c.json({
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        total: paths.length,
        created: stats.created,
        updated: stats.updated,
        skipped: stats.skipped,
        notes: results,
      });
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
