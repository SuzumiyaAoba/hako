import * as schema from "../../src/db/schema";

const createSchemaSql = () => `
  create table notes (
    id text primary key,
    title text not null,
    path text not null unique,
    content text not null,
    content_hash text not null,
    updated_at text not null
  );
  create table links (
    id integer primary key autoincrement,
    from_note_id text not null,
    to_note_id text,
    to_title text not null,
    to_path text,
    link_text text,
    position integer
  );
  create table note_link_states (
    note_id text primary key,
    content_hash text not null,
    indexed_at text not null
  );
`;

export const createTestDb = async () => {
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

  if (isBun) {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const sqlite = new Database(":memory:");
    sqlite.exec(createSchemaSql());
    return drizzle(sqlite, { schema });
  }

  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const sqlite = new Database(":memory:");
  sqlite.exec(createSchemaSql());
  return drizzle(sqlite, { schema });
};
