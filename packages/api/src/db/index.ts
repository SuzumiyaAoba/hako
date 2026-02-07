import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Resolves database URL from environment with fallback.
 */
const resolveDatabaseUrl = (): string =>
  process.env["DATABASE_URL"]?.trim() || "file:./data/hako.db";

/**
 * Resolves local filesystem path from `file:` database URL.
 */
const toLocalFilePath = (databaseUrl: string): string | null => {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const withoutScheme = databaseUrl.slice("file:".length).split(/[?#]/, 1)[0] ?? "";
  if (!withoutScheme || withoutScheme === ":memory:") {
    return null;
  }

  if (!withoutScheme.startsWith("//")) {
    return withoutScheme;
  }

  const authorityForm = withoutScheme.slice(2);
  const slashIndex = authorityForm.indexOf("/");
  const host = slashIndex === -1 ? authorityForm : authorityForm.slice(0, slashIndex);
  const pathPart = slashIndex === -1 ? "" : authorityForm.slice(slashIndex);

  if (!host || host === "localhost") {
    if (!pathPart || pathPart === "/") {
      return "/";
    }
    return pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  }

  return null;
};

/**
 * Creates database directory for local file-based URLs.
 */
const ensureDatabaseDir = (databaseUrl: string): void => {
  const filePath = toLocalFilePath(databaseUrl);
  if (!filePath) {
    return;
  }

  mkdirSync(dirname(filePath), { recursive: true });
};

/**
 * Bootstrap DDL statements used for local startup.
 */
const SCHEMA_SQL_STATEMENTS = [
  `create table if not exists notes (
    id text primary key,
    title text not null,
    path text not null unique,
    content text not null,
    content_hash text not null,
    updated_at text not null
  )`,
  "create index if not exists idx_notes_title on notes (title)",
  `create table if not exists links (
    id integer primary key autoincrement,
    from_note_id text not null,
    to_note_id text,
    to_title text not null,
    to_path text,
    link_text text,
    position integer,
    foreign key (from_note_id) references notes (id) on delete cascade,
    foreign key (to_note_id) references notes (id) on delete set null
  )`,
  "create index if not exists idx_links_from on links (from_note_id)",
  "create index if not exists idx_links_to on links (to_note_id)",
  `create table if not exists note_link_states (
    note_id text primary key,
    content_hash text not null,
    indexed_at text not null,
    foreign key (note_id) references notes (id) on delete cascade
  )`,
  "create index if not exists idx_note_link_states_note_id on note_link_states (note_id)",
  `create table if not exists tags (
    id integer primary key autoincrement,
    name text not null unique
  )`,
  "create index if not exists idx_tags_name on tags (name)",
  `create table if not exists note_tags (
    note_id text not null,
    tag_id integer not null,
    primary key (note_id, tag_id),
    foreign key (note_id) references notes (id) on delete cascade,
    foreign key (tag_id) references tags (id) on delete cascade
  )`,
  `create table if not exists index_runs (
    id integer primary key autoincrement,
    started_at text not null,
    finished_at text,
    status text not null
  )`,
] as const;

/**
 * Executes bootstrap schema SQL statements.
 */
const initializeSchema = async (client: Client): Promise<void> => {
  for (const sql of SCHEMA_SQL_STATEMENTS) {
    await client.execute(sql);
  }
};

/**
 * Active database URL.
 */
const databaseUrl = resolveDatabaseUrl();
ensureDatabaseDir(databaseUrl);

/**
 * Optional auth token for remote libSQL endpoints.
 */
const authToken = process.env["DATABASE_AUTH_TOKEN"]?.trim();
/**
 * libSQL client instance.
 */
const client = createClient({
  url: databaseUrl,
  ...(authToken ? { authToken } : {}),
});

/**
 * Drizzle database instance.
 */
const db = drizzle(client, { schema });
/**
 * Startup promise that ensures schema initialization is complete.
 */
const dbReady = initializeSchema(client);
dbReady.catch(() => undefined);

export { client, db, dbReady };
