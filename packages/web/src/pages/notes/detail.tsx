import { Elysia } from "elysia";
import { parse } from "valibot";

import type { Note } from "@hako/core";
import { getNote, getNotes } from "../../entities/note/api/notes";
import { NoteIdSchema } from "../../entities/note/model/types";
import { buildBacklinks } from "../../shared/lib/backlinks";
import { renderMarkdown } from "../../shared/lib/markdown";
import { htmlResponse, renderPage } from "../layout";

/**
 * Extracts frontmatter and markdown body.
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
  return { frontmatter: frontmatter || null, body: trimmed.slice(bodyStart) };
};

/**
 * Parses frontmatter key-value entries.
 */
const parseFrontmatterEntries = (
  frontmatter: string | null,
): Array<{ key: string; value: string | string[] }> => {
  if (!frontmatter) {
    return [];
  }

  const normalizeValue = (value: unknown): string | string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  try {
    const parsed = Bun.YAML.parse(frontmatter);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    const entries: Array<{ key: string; value: string | string[] }> = [];
    for (const [key, value] of Object.entries(parsed)) {
      entries.push({
        key,
        value: normalizeValue(value),
      });
    }
    return entries;
  } catch {
    return [];
  }
};

/**
 * Builds note title map.
 */
const buildTitleMap = (
  notes: ReadonlyArray<Pick<Note, "id" | "title">>,
): Map<string, Pick<Note, "id" | "title">> => new Map(notes.map((note) => [note.title, note]));

/**
 * Frontmatter summary card.
 */
const FrontmatterCard = ({ frontmatter }: { frontmatter: string | null }): JSX.Element | null => {
  if (!frontmatter) {
    return null;
  }
  const entries = parseFrontmatterEntries(frontmatter);
  if (entries.length === 0) {
    return (
      <details className="border border-slate-200 bg-white p-4" open>
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
          <span>Frontmatter</span>
          <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
            raw
          </span>
        </summary>
        <pre className="mt-3 whitespace-pre-wrap border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          {frontmatter}
        </pre>
      </details>
    );
  }
  return (
    <details className="border border-slate-200 bg-white p-4" open>
      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
        <span>Frontmatter</span>
        <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
          {entries.length} fields
        </span>
      </summary>
      <div className="mt-3 grid gap-3">
        {entries.map((entry) => (
          <div key={entry.key} className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
            <p className="text-xs font-semibold uppercase text-slate-500">{entry.key}</p>
            <div className="min-w-0 text-sm text-slate-900">
              {Array.isArray(entry.value) ? (
                entry.value.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.value.map((item, index) => (
                      <span
                        key={`${entry.key}-${index}-${item}`}
                        className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">-</span>
                )
              ) : entry.value ? (
                entry.value
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
};

/**
 * Metadata summary card.
 */
const MetadataCard = ({ path }: { path: string }): JSX.Element => (
  <details className="border border-slate-200 bg-white p-4" open>
    <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
      <span>Metadata</span>
      <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
        1 field
      </span>
    </summary>
    <div className="mt-3 grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
        <p className="text-xs font-semibold uppercase text-slate-500">FILE_PATH</p>
        <div className="min-w-0 break-all text-sm text-slate-900">{path}</div>
      </div>
    </div>
  </details>
);

/**
 * Notes detail page routes.
 */
export const createNotesDetailPageRoutes = () =>
  new Elysia().get("/notes/:id", async ({ request, params }) => {
    const url = new URL(request.url);
    const validated = parse(NoteIdSchema, params.id);
    const note = await getNote(validated);
    if (!note) {
      return htmlResponse(
        renderPage(
          "ノートが見つかりません",
          url.pathname,
          <section className="space-y-2">
            <h1 className="text-balance text-xl font-semibold text-slate-900">
              ノートが見つかりません
            </h1>
          </section>,
        ),
        404,
      );
    }

    const notes = await getNotes();
    const titleMap = buildTitleMap(notes);
    const backlinks = buildBacklinks(notes, note.title);
    const { frontmatter, body } = extractFrontmatter(note.content ?? "");
    const markdown = body.trim();
    const queryParam = url.searchParams.get("q") ?? "";
    const rawMode = url.searchParams.get("raw") === "1";
    const rendered = markdown
      ? await renderMarkdown(markdown, (title, label) => {
          const target = titleMap.get(title);
          return { href: target ? `/notes/${target.id}` : null, label };
        })
      : "";

    const rawHref = rawMode ? `/notes/${note.id}` : `/notes/${note.id}?raw=1`;

    return htmlResponse(
      renderPage(
        note.title,
        url.pathname,
        <section className="text-pretty">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
            <div className="min-w-0 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-balance text-2xl font-semibold text-slate-900">{note.title}</h1>
                <a
                  className="border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  href={rawHref}
                >
                  {rawMode ? "Preview" : "Raw"}
                </a>
              </div>
              {rendered ? (
                <article className="w-full max-w-full border border-slate-200 p-4">
                  {rawMode ? (
                    <pre className="whitespace-pre-wrap text-xs text-slate-900">
                      {note.content ?? ""}
                    </pre>
                  ) : (
                    <div className="prose-ui w-full max-w-full">
                      <div dangerouslySetInnerHTML={{ __html: rendered }} />
                    </div>
                  )}
                </article>
              ) : (
                <p className="text-sm text-slate-500">ノートの内容がまだ読み込まれていません。</p>
              )}
              <section className="space-y-3">
                <h2 className="text-balance text-lg font-semibold text-slate-900">バックリンク</h2>
                {backlinks.length === 0 ? (
                  <p className="text-sm text-slate-500">バックリンクはありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {backlinks.map((link) => {
                      const target = titleMap.get(link.title);
                      return target ? (
                        <li key={link.title}>
                          <a
                            className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                            href={`/notes/${encodeURIComponent(target.id)}`}
                          >
                            {link.label}
                          </a>
                        </li>
                      ) : (
                        <li key={link.title} className="text-sm text-slate-500">
                          {link.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <MetadataCard path={note.path} />
              <FrontmatterCard frontmatter={frontmatter} />
            </aside>
          </div>
        </section>,
        notes,
        queryParam,
      ),
    );
  });
