import { parse } from "valibot";

import { apiBaseUrl, fetchJson } from "../../../shared/api/client";
import { NoteSchema, NotesSchema, type Note, NoteIdSchema, type NoteId } from "../model/types";

/**
 * Fetch all notes.
 */
export const getNotes = async (): Promise<Note[]> => fetchJson("/notes", NotesSchema);

/**
 * Fetch a note by id. Returns null when not found.
 */
export const getNote = async (id: NoteId): Promise<Note | null> => {
  parse(NoteIdSchema, id);
  const response = await fetch(`${apiBaseUrl}/notes/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${body}`);
  }
  const data: unknown = await response.json();
  return parse(NoteSchema, data);
};
