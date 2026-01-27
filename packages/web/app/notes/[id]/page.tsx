import Link from "next/link";
import { parse } from "valibot";

import { getNote, getNotes } from "@/entities/note/api/notes";
import type { Note } from "@hako/core";
import { NoteIdSchema } from "@/entities/note/model/types";
import { renderMarkdown } from "@/shared/lib/markdown";
import { buildBacklinks } from "@/shared/lib/backlinks";

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
  const content = note.content.trim();
  const html = content
    ? await renderMarkdown(content, (title, label) => {
        const target = titleMap.get(title);
        return {
          href: target ? `/notes/${target.id}` : null,
          label,
        };
      })
    : "";
  const noteStyles = `
    .wiki-link { color: #2563eb; text-decoration: underline; }
    .wiki-link.unresolved { color: #9ca3af; text-decoration: dotted underline; }
    .note-content {
      line-height: 1.8;
      color: #111827;
      max-width: 720px;
      margin-top: 1.5rem;
    }
    .note-content > :first-child { margin-top: 0; }
    .note-content h1, .note-content h2, .note-content h3 {
      margin: 1.6rem 0 0.8rem;
      line-height: 1.3;
    }
    .note-content p { margin: 1rem 0; }
    .note-content ul, .note-content ol {
      margin: 1rem 0 1rem 1.25rem;
      padding-left: 1rem;
    }
    .note-content li { margin: 0.4rem 0; }
    .note-content blockquote {
      margin: 1rem 0;
      padding: 0.5rem 1rem;
      border-left: 4px solid #e5e7eb;
      color: #374151;
      background: #f9fafb;
    }
    .note-content code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
      font-size: 0.9em;
      background: #f3f4f6;
      padding: 0.1rem 0.25rem;
      border-radius: 4px;
    }
    .note-content pre {
      margin: 1rem 0;
      padding: 0.75rem 1rem;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
    }
    .note-content pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    .note-content a { color: #2563eb; }
    .note-content hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 1.5rem 0;
    }
  `;

  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <style dangerouslySetInnerHTML={{ __html: noteStyles }} />
      <p>
        <Link href="/notes">← 一覧へ戻る</Link>
      </p>
      <h1>{note.title}</h1>
      <p style={{ color: "#6b7280" }}>{note.path}</p>
      {content ? (
        <article className="note-content" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p>ノートの内容がまだ読み込まれていません。</p>
      )}
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
