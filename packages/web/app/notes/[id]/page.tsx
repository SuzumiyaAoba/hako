import Link from "next/link";
import { parse } from "valibot";

import { getNote, getNotes } from "@/entities/note/api/notes";
import type { Note } from "@hako/core";
import { NoteIdSchema } from "@/entities/note/model/types";
import { buildBacklinks, renderMarkdown } from "@/shared/lib/markdown";

/**
 * Props for the note detail page.
 */
type NotesDetailPageProps = {
  params: { id: string };
};

/**
 * Minimal note data needed for link resolution.
 */
type NoteLinkTarget = Pick<Note, "id" | "title">;

/**
 * Builds a map from note title to its target metadata.
 */
const buildTitleMap = (notes: ReadonlyArray<NoteLinkTarget>): Map<string, NoteLinkTarget> => {
  const map = new Map<string, NoteLinkTarget>();
  for (const note of notes) {
    map.set(note.title, note);
  }
  return map;
};

/**
 * Note detail page with rendered markdown and backlinks.
 */
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

  const notes = await getNotes();
  const titleMap = buildTitleMap(notes);
  const backlinks = buildBacklinks(notes, note.title);
  const html = await renderMarkdown(note.content, (title, label) => {
    const target = titleMap.get(title);
    return {
      href: target ? `/notes/${target.id}` : null,
      label,
    };
  });

  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <style>{`
        .wiki-link { color: #2563eb; text-decoration: underline; }
        .wiki-link.unresolved { color: #9ca3af; text-decoration: dotted underline; }
      `}</style>
      <p>
        <Link href="/notes">← 一覧へ戻る</Link>
      </p>
      <h1>{note.title}</h1>
      <p style={{ color: "#6b7280" }}>{note.path}</p>
      <article dangerouslySetInnerHTML={{ __html: html }} />
      <section style={{ marginTop: "2rem" }}>
        <h2>バックリンク</h2>
        {backlinks.length === 0 ? (
          <p>バックリンクはありません。</p>
        ) : (
          <ul>
            {backlinks.map((link) => {
              const target = titleMap.get(link.title);
              return (
                <li key={link.title}>
                  {target ? (
                    <Link href={`/notes/${target.id}`}>{link.label}</Link>
                  ) : (
                    <span>{link.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
