import { asc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type DbClient = LibSQLDatabase<typeof schema>;

export const listNotes = async (db: DbClient) =>
  await db.select().from(schema.notes).orderBy(asc(schema.notes.title)).all();

export const getNoteById = async (db: DbClient, id: string) =>
  await db.select().from(schema.notes).where(eq(schema.notes.id, id)).get();
