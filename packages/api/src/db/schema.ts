import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    path: text("path").notNull().unique(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    titleIndex: index("idx_notes_title").on(table.title),
  }),
);

export const links = sqliteTable(
  "links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fromNoteId: text("from_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    toNoteId: text("to_note_id").references(() => notes.id, {
      onDelete: "set null",
    }),
    toTitle: text("to_title").notNull(),
    toPath: text("to_path"),
    linkText: text("link_text"),
    position: integer("position"),
  },
  (table) => ({
    fromIndex: index("idx_links_from").on(table.fromNoteId),
    toIndex: index("idx_links_to").on(table.toNoteId),
  }),
);

export const noteLinkStates = sqliteTable(
  "note_link_states",
  {
    noteId: text("note_id")
      .primaryKey()
      .references(() => notes.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    indexedAt: text("indexed_at").notNull(),
  },
  (table) => ({
    noteIndex: index("idx_note_link_states_note_id").on(table.noteId),
  }),
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
  },
  (table) => ({
    nameIndex: index("idx_tags_name").on(table.name),
  }),
);

export const noteTags = sqliteTable(
  "note_tags",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.noteId, table.tagId] }),
  }),
);

export const indexRuns = sqliteTable("index_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
});
