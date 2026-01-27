import Link from "next/link";

import { getNotes } from "@/entities/note/api/notes";

/**
 * Query parameters accepted by the notes page.
 */
type NotesSearchParams = {
  q?: string | string[];
};

/**
 * Props for the notes page.
 */
type NotesPageProps = {
  searchParams?: NotesSearchParams;
};

/**
 * Normalizes a query parameter into a single lowercase string.
 */
/**
 * Resolves a single query value from a potentially repeated parameter.
 */
const resolveQueryValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Normalizes a query parameter into a single lowercase string.
 */
const normalizeQuery = (value: string | string[] | undefined): string =>
  resolveQueryValue(value)?.trim().toLowerCase() ?? "";

/**
 * Notes list page with optional search filtering.
 */
export default async function NotesPage({ searchParams }: NotesPageProps): Promise<JSX.Element> {
  const notes = await getNotes();
  const queryValue = resolveQueryValue(searchParams?.q);
  const query = normalizeQuery(queryValue);
  const filtered = query ? notes.filter((note) => note.title.toLowerCase().includes(query)) : notes;

  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>ノート一覧</h1>
      <form style={{ marginBottom: "1rem" }}>
        <label htmlFor="notes-search" style={{ display: "block", marginBottom: "0.5rem" }}>
          検索
        </label>
        <input
          id="notes-search"
          type="search"
          name="q"
          defaultValue={queryValue ?? ""}
          placeholder="タイトルで検索"
          style={{
            padding: "0.5rem",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            width: "min(420px, 100%)",
          }}
        />
      </form>
      <p style={{ color: "#6b7280" }}>
        {filtered.length} 件 / {notes.length} 件
      </p>
      {filtered.length === 0 ? (
        <p>ノートがありません。</p>
      ) : (
        <ul>
          {filtered.map((note) => (
            <li key={note.id}>
              <Link href={`/notes/${note.id}`}>{note.title}</Link>
              <span style={{ marginLeft: "0.5rem", color: "#6b7280" }}>({note.path})</span>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: "1rem" }}>
        <Link href="/graph">グラフを見る</Link>
      </p>
    </main>
  );
}
