import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { extractWikiLinks, type Note } from "@hako/core";

import type { DbClient } from "../db/queries";
import { getNoteById, listNotes } from "../db/queries";
import * as schema from "../db/schema";

/**
 * Error response schema.
 */
const ErrorResponseSchema = t.Object({
  message: t.String(),
});

/**
 * Route params schema for note detail endpoint.
 */
const NoteIdParamsSchema = t.Object({
  id: t.String({ minLength: 1 }),
});

/**
 * Route body schema for note import endpoint.
 */
const ImportBodySchema = t.Union([
  t.Object({
    paths: t.Array(t.String({ minLength: 1 })),
  }),
  t.Object({
    notes: t.Array(
      t.Object({
        path: t.String({ minLength: 1 }),
        title: t.String(),
      }),
    ),
  }),
]);

/**
 * Note schema used in API responses.
 */
const NoteResponseSchema = t.Object({
  id: t.String(),
  title: t.String(),
  path: t.String(),
  content: t.String(),
  contentHash: t.String(),
  updatedAt: t.String(),
});

/**
 * Response schema for note import endpoint.
 */
const ImportResponseSchema = t.Object({
  startedAt: t.String(),
  finishedAt: t.String(),
  durationMs: t.Number(),
  total: t.Number(),
  created: t.Number(),
  updated: t.Number(),
  skipped: t.Number(),
  notes: t.Array(
    t.Object({
      id: t.String(),
      title: t.String(),
      path: t.String(),
      status: t.Union([t.Literal("created"), t.Literal("updated"), t.Literal("skipped")]),
    }),
  ),
});

/**
 * Response schema for link reindex endpoint.
 */
const ReindexResponseSchema = t.Object({
  startedAt: t.String(),
  finishedAt: t.String(),
  durationMs: t.Number(),
  notesTotal: t.Number(),
  notesIndexed: t.Number(),
  notesSkipped: t.Number(),
  linksInserted: t.Number(),
  linksDeleted: t.Number(),
});

/**
 * Reindex aggregation stats.
 */
type ReindexStats = {
  notesIndexed: number;
  notesSkipped: number;
  linksInserted: number;
  linksDeleted: number;
};

/**
 * Link table insert shape.
 */
type LinkInsert = typeof schema.links.$inferInsert;

/**
 * note_link_states table insert shape.
 */
type NoteLinkStateInsert = typeof schema.noteLinkStates.$inferInsert;

/**
 * Per-note import status.
 */
type ImportStatus = "created" | "updated" | "skipped";

/**
 * Import result payload for a single note.
 */
type ImportNoteResult = {
  id: string;
  title: string;
  path: string;
  status: ImportStatus;
};

/**
 * Import aggregation stats.
 */
type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
};

/**
 * Derives note title from file path.
 */
const deriveTitleFromPath = (path: string): string => {
  const filename = basename(path);
  const extension = extname(filename);
  return extension.length > 0 ? filename.slice(0, -extension.length) : filename;
};

/**
 * Computes stable note id from path.
 */
const computeNoteId = (path: string): string => createHash("sha256").update(path).digest("hex");

/**
 * Computes lightweight source fingerprint for import change detection.
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
 * Builds title lookup map for link resolution.
 */
const buildTitleMap = (notes: ReadonlyArray<Note>): Map<string, Note> =>
  new Map(notes.map((note) => [note.title, note]));

/**
 * Builds link inserts extracted from note markdown.
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
 * Builds notes API routes.
 */
export const createNotesRoutes = (db: DbClient) => {
  return new Elysia()
    .get("/notes", async () => await listNotes(db), {
      response: {
        200: t.Array(NoteResponseSchema),
      },
    })
    .get(
      "/notes/:id",
      async ({ params, set }) => {
        const note = await getNoteById(db, params.id);
        if (!note) {
          set.status = 404;
          return { message: "Note not found" };
        }

        try {
          const content = await readFile(note.path, "utf-8");
          return { ...note, content };
        } catch {
          set.status = 404;
          return { message: "Note file not found" };
        }
      },
      {
        params: NoteIdParamsSchema,
        response: {
          200: NoteResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    )
    .post(
      "/notes/import",
      async ({ body }) => {
        const startedAt = new Date();
        const startedAtMs = startedAt.getTime();
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

        const stats = await db.transaction(async (tx): Promise<ImportStats> => {
          let created = 0;
          let updated = 0;
          let skipped = 0;

          for (const entry of imports) {
            const { path, title, sourceHash } = entry;
            const existing = await tx
              .select()
              .from(schema.notes)
              .where(eq(schema.notes.path, path))
              .get();

            if (!existing) {
              const id = computeNoteId(path);
              await tx
                .insert(schema.notes)
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

            await tx
              .update(schema.notes)
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

        return {
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs,
          total: paths.length,
          created: stats.created,
          updated: stats.updated,
          skipped: stats.skipped,
          notes: results,
        };
      },
      {
        body: ImportBodySchema,
        response: {
          200: ImportResponseSchema,
        },
      },
    )
    .post(
      "/notes/reindex",
      async () => {
        const startedAt = new Date();
        const startedAtMs = startedAt.getTime();
        const notes = await listNotes(db);
        const titleMap = buildTitleMap(notes);
        const existingStates = await db.select().from(schema.noteLinkStates).all();
        const stateMap = new Map(existingStates.map((state) => [state.noteId, state.contentHash]));
        const indexedAt = new Date().toISOString();

        const stats = await db.transaction(async (tx): Promise<ReindexStats> => {
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
            const deleteResult = await tx
              .delete(schema.links)
              .where(eq(schema.links.fromNoteId, note.id))
              .run();
            linksDeleted += deleteResult.rowsAffected ?? 0;

            const { links, total } = buildLinkInserts(note, titleMap);
            if (total > 0) {
              await tx.insert(schema.links).values(links).run();
              linksInserted += total;
            }

            const state: NoteLinkStateInsert = {
              noteId: note.id,
              contentHash: note.contentHash,
              indexedAt,
            };
            await tx
              .insert(schema.noteLinkStates)
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

        return {
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs,
          notesTotal: notes.length,
          notesIndexed: stats.notesIndexed,
          notesSkipped: stats.notesSkipped,
          linksInserted: stats.linksInserted,
          linksDeleted: stats.linksDeleted,
        };
      },
      {
        response: {
          200: ReindexResponseSchema,
        },
      },
    );
};
