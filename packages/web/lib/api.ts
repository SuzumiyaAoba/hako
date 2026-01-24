const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export type Note = {
  id: string;
  title: string;
  path: string;
  content: string;
  contentHash: string;
  updatedAt: string;
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${body}`);
  }
  return response.json() as Promise<T>;
};

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
