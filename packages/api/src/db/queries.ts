import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export type DbClient = BetterSQLite3Database<typeof schema>;

export const listNotes = (db: DbClient) =>
  db.select().from(schema.notes).orderBy(asc(schema.notes.title)).all();

export const getNoteById = (db: DbClient, id: string) =>
  db.select().from(schema.notes).where(eq(schema.notes.id, id)).get();
