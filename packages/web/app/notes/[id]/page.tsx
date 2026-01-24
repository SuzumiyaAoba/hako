import Link from "next/link";

import { getNote } from "../../../lib/api";

type NotesDetailPageProps = {
  params: { id: string };
};

export default async function NotesDetailPage({ params }: NotesDetailPageProps) {
  const note = await getNote(params.id);

  if (!note) {
    return (
      <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
        <h1>ノートが見つかりません</h1>
        <p>
          <Link href="/notes">一覧へ戻る</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <p>
        <Link href="/notes">← 一覧へ戻る</Link>
      </p>
      <h1>{note.title}</h1>
      <p style={{ color: "#6b7280" }}>{note.path}</p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{note.content}</pre>
    </main>
  );
}
