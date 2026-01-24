import { z } from "zod";

/**
 * Branded note identifier.
 */
export const NoteIdSchema = z.string().min(1).brand<"NoteId">();

export type NoteId = z.infer<typeof NoteIdSchema>;

/**
 * Note entity shape.
 */
export const NoteSchema = z.object({
  id: NoteIdSchema,
  title: z.string(),
  path: z.string(),
  content: z.string(),
  contentHash: z.string(),
  updatedAt: z.string(),
});

export type Note = z.infer<typeof NoteSchema>;
