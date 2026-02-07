import { randomUUID } from "node:crypto";

import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../../src/db/schema";

const SCHEMA_SQL_STATEMENTS = [
  `create table notes (
    id text primary key,
    title text not null,
    path text not null unique,
    content text not null,
    content_hash text not null,
    updated_at text not null
  )`,
  `create table links (
    id integer primary key autoincrement,
    from_note_id text not null,
    to_note_id text,
    to_title text not null,
    to_path text,
    link_text text,
    position integer
  )`,
  `create table note_link_states (
    note_id text primary key,
    content_hash text not null,
    indexed_at text not null
  )`,
] as const;

export const createTestDb = async () => {
  const dbPath = `/tmp/hako-test-${randomUUID()}.db`;
  const client = createClient({
    url: `file:${dbPath}`,
  });

  for (const sql of SCHEMA_SQL_STATEMENTS) {
    await client.execute(sql);
  }

  return drizzle(client, { schema });
};
