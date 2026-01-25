import Link from "next/link";

import { getNotes } from "@/entities/note/api/notes";

type NotesPageProps = {
  searchParams?: {
    q?: string;
  };
};

const normalizeQuery = (value: string | undefined): string => value?.trim().toLowerCase() ?? "";

export default async function NotesPage({ searchParams }: NotesPageProps): Promise<JSX.Element> {
  const notes = await getNotes();
  const query = normalizeQuery(searchParams?.q);
  const filtered = query ? notes.filter((note) => note.title.toLowerCase().includes(query)) : notes;

  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>ノート一覧</h1>
      <form style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>検索</label>
        <input
          type="search"
          name="q"
          defaultValue={searchParams?.q ?? ""}
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
