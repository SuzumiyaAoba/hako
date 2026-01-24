import Link from "next/link";

import { getNotes } from "../../lib/api";

export default async function NotesPage() {
  const notes = await getNotes();

  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>ノート一覧</h1>
      {notes.length === 0 ? (
        <p>ノートがありません。</p>
      ) : (
        <ul>
          {notes.map((note) => (
            <li key={note.id}>
              <Link href={`/notes/${note.id}`}>{note.title}</Link>
              <span style={{ marginLeft: "0.5rem", color: "#6b7280" }}>({note.path})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
