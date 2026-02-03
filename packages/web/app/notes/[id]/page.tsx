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
 * Extracts YAML frontmatter from the beginning of a markdown string.
 */
const extractFrontmatter = (content: string): { frontmatter: string | null; body: string } => {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: null, body: content };
  }

  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter: null, body: content };
  }

  const frontmatter = trimmed.slice(3, endIndex).trim();
  let bodyStart = endIndex + 4;
  if (trimmed[bodyStart] === "\n") {
    bodyStart += 1;
  }

  return {
    frontmatter: frontmatter || null,
    body: trimmed.slice(bodyStart),
  };
};

/**
 * Parses frontmatter into key/value entries (simple YAML).
 */
const stripWrappingQuotes = (value: string): string => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
};

const parseInlineArray = (value: string): string[] | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return inner
    .split(",")
    .map((item) => stripWrappingQuotes(item.trim()))
    .filter((item) => item.length > 0);
};

const parseFrontmatterEntries = (
  frontmatter: string | null,
): Array<{ key: string; value: string | string[] }> => {
  if (!frontmatter) {
    return [];
  }

  const entries: Array<{ key: string; value: string | string[] }> = [];
  let current: { key: string; value: string | string[] } | null = null;

  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("-")) {
      const item = stripWrappingQuotes(line.replace(/^-+\s*/, "").trim());
      if (current && item.length > 0) {
        if (Array.isArray(current.value)) {
          current.value = [...current.value, item];
        } else if (current.value === "") {
          current.value = [item];
        } else {
          current.value = [current.value, item];
        }
        continue;
      }
    }

    const index = line.indexOf(":");
    if (index === -1) {
      const entry = { key: line, value: "" };
      entries.push(entry);
      current = entry;
      continue;
    }

    const key = line.slice(0, index).trim();
    if (key.length === 0) {
      continue;
    }
    const rawValue = line.slice(index + 1).trim();
    let value: string | string[] = "";
    if (rawValue.length > 0) {
      const arrayValue = parseInlineArray(rawValue);
      value = arrayValue ?? stripWrappingQuotes(rawValue);
    }
    const entry = { key, value };
    entries.push(entry);
    current = entry;
  }

  return entries;
};

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
      <main className="min-h-dvh bg-white px-6 py-8 font-sans text-pretty text-slate-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-balance">ノートが見つかりません</h1>
          <p className="mt-3 text-sm">
            <Link className="text-blue-600 underline underline-offset-4" href="/notes">
              一覧へ戻る
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const notes = await getNotes();
  const titleMap = buildTitleMap(notes);
  const backlinks = buildBacklinks(notes, note.title);
  const { frontmatter, body } = extractFrontmatter(note.content ?? "");
  const frontmatterEntries = parseFrontmatterEntries(frontmatter);
  const content = body.trim();
  const html = content
    ? await renderMarkdown(content, (title, label) => {
        const target = titleMap.get(title);
        return {
          href: target ? `/notes/${target.id}` : null,
          label,
        };
      })
    : "";
  return (
    <main className="min-h-dvh bg-white px-6 py-8 font-sans text-pretty text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm text-blue-600 underline underline-offset-4" href="/notes">
          ← 一覧へ戻る
        </Link>
        <div className="mt-6">
          <h1 className="text-3xl font-semibold text-balance">{note.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{note.path}</p>
        </div>
        {frontmatter ? (
          <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
            <div className="text-xs font-semibold text-slate-500">Frontmatter</div>
            {frontmatterEntries.length > 0 ? (
              <table className="mt-2 w-full text-sm text-slate-700 tabular-nums">
                <tbody>
                  {frontmatterEntries.map((entry) => (
                    <tr key={entry.key} className="border-t border-slate-200">
                      <th className="w-1/3 py-1.5 pr-3 text-left align-top font-semibold text-slate-900">
                        {entry.key}
                      </th>
                      <td className="py-1.5 text-left align-top text-slate-700">
                        {Array.isArray(entry.value) ? (
                          entry.value.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <ul className="list-disc space-y-1 pl-4 marker:text-slate-400">
                              {entry.value.map((item) => (
                                <li key={`${entry.key}-${item}`}>{item}</li>
                              ))}
                            </ul>
                          )
                        ) : (
                          <span className="whitespace-pre-wrap">{entry.value}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{frontmatter}</div>
            )}
          </section>
        ) : null}
        {content ? (
          <article
            className="prose prose-slate mt-6 max-w-none text-pretty prose-a:text-blue-600 prose-a:underline prose-a:decoration-blue-300 prose-a:underline-offset-4 prose-blockquote:border-l-4 prose-blockquote:border-slate-200 prose-blockquote:bg-slate-50 prose-blockquote:text-slate-600 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-slate-900 prose-code:before:content-none prose-code:after:content-none prose-headings:text-balance prose-hr:border-slate-200 prose-li:my-1 prose-p:text-pretty prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:px-4 prose-pre:py-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="mt-6 text-sm text-slate-500">ノートの内容がまだ読み込まれていません。</p>
        )}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-balance">バックリンク</h2>
          {backlinks.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">バックリンクはありません。</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {backlinks.map((link) => {
                const target = titleMap.get(link.title);
                return (
                  <li key={link.title}>
                    {target ? (
                      <Link
                        className="text-blue-600 underline underline-offset-4"
                        href={`/notes/${target.id}`}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-slate-500">{link.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
