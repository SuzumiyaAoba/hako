import Link from "next/link";
import { parse } from "valibot";

import { getNote } from "@/entities/note/api/notes";
import { NoteIdSchema } from "@/entities/note/model/types";

type NotesDetailPageProps = {
  params: { id: string };
};

export default async function NotesDetailPage({
  params,
}: NotesDetailPageProps): Promise<JSX.Element> {
  const noteId = parse(NoteIdSchema, params.id);
  const note = await getNote(noteId);

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
