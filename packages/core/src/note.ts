import { array, minLength, object, pipe, string, type InferOutput } from "valibot";

/**
 * Note identifier.
 */
export const NoteIdSchema = pipe(string(), minLength(1));

export type NoteId = InferOutput<typeof NoteIdSchema>;

/**
 * Note entity schema.
 */
export const NoteSchema = object({
  id: NoteIdSchema,
  title: string(),
  path: string(),
  content: string(),
  contentHash: string(),
  updatedAt: string(),
});

export type Note = InferOutput<typeof NoteSchema>;

/**
 * Collection schema for notes.
 */
export const NotesSchema = array(NoteSchema);
