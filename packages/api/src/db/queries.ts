import { asc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Database client type used by API route handlers.
 */
export type DbClient = LibSQLDatabase<typeof schema>;

/**
 * Lists notes ordered by title.
 */
export const listNotes = async (db: DbClient) =>
  await db.select().from(schema.notes).orderBy(asc(schema.notes.title)).all();

/**
 * Returns a note by identifier.
 */
export const getNoteById = async (db: DbClient, id: string) =>
  await db.select().from(schema.notes).where(eq(schema.notes.id, id)).get();
