import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const databasePath = process.env["DATABASE_URL"] ?? "data/hako.db";

const sqlite = new Database(databasePath);
sqlite.exec(`
  create table if not exists notes (
    id text primary key,
    title text not null,
    path text not null unique,
    content text not null,
    content_hash text not null,
    updated_at text not null
  );
  create index if not exists idx_notes_title on notes (title);

  create table if not exists links (
    id integer primary key autoincrement,
    from_note_id text not null,
    to_note_id text,
    to_title text not null,
    to_path text,
    link_text text,
    position integer,
    foreign key (from_note_id) references notes (id) on delete cascade,
    foreign key (to_note_id) references notes (id) on delete set null
  );
  create index if not exists idx_links_from on links (from_note_id);
  create index if not exists idx_links_to on links (to_note_id);

  create table if not exists note_link_states (
    note_id text primary key,
    content_hash text not null,
    indexed_at text not null,
    foreign key (note_id) references notes (id) on delete cascade
  );
  create index if not exists idx_note_link_states_note_id on note_link_states (note_id);

  create table if not exists tags (
    id integer primary key autoincrement,
    name text not null unique
  );
  create index if not exists idx_tags_name on tags (name);

  create table if not exists note_tags (
    note_id text not null,
    tag_id integer not null,
    primary key (note_id, tag_id),
    foreign key (note_id) references notes (id) on delete cascade,
    foreign key (tag_id) references tags (id) on delete cascade
  );

  create table if not exists index_runs (
    id integer primary key autoincrement,
    started_at text not null,
    finished_at text,
    status text not null
  );
`);
const db = drizzle(sqlite, { schema });

export { db, sqlite };
