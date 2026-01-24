import type { Note } from "../model/types";
import { apiBaseUrl, fetchJson } from "../../../shared/api/client";

export const getNotes = async (): Promise<Note[]> => fetchJson<Note[]>("/notes");

export const getNote = async (id: string): Promise<Note | null> => {
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
  return (await response.json()) as Note;
};
