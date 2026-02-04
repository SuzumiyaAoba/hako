import { Hono } from "hono";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "valibot";

import type { Note } from "@hako/core";
import { getNote, getNotes } from "./entities/note/api/notes";
import { NoteIdSchema } from "./entities/note/model/types";
import { buildBacklinks } from "./shared/lib/backlinks";
import { buildNoteGraph } from "./shared/lib/graph";
import { renderMarkdown } from "./shared/lib/markdown";

const STYLE_TEXT = `
:root{color-scheme:light;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif}
body{margin:0;color:#0f172a;background:linear-gradient(180deg,#f8fafc 0%,#fff 320px)}
main{max-width:860px;margin:0 auto;padding:24px 20px 48px}
a{color:#2563eb}pre{overflow-x:auto;border-radius:0}
.muted{color:#64748b}.stack{display:grid;gap:10px}
.panel{border:1px solid #e2e8f0;background:#fff;border-radius:0;padding:14px}
.frontmatter-card{border:1px solid #dbe3ef;background:#fff;border-radius:0;padding:14px;margin:16px 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.frontmatter-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.frontmatter-title{margin:0;font-size:.95rem;font-weight:700;color:#0f172a}
.frontmatter-count{font-size:.75rem;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:0;padding:2px 8px}
.frontmatter-grid{display:grid;gap:8px}.frontmatter-row{display:grid;grid-template-columns:minmax(110px,160px) 1fr;gap:10px;padding:6px 0}
.frontmatter-key{margin:0;color:#334155;font-size:.78rem;font-weight:700;text-transform:uppercase}
.frontmatter-value{margin:0;color:#0f172a;font-size:.92rem;line-height:1.55}
.frontmatter-pill-list{display:flex;flex-wrap:wrap;gap:6px}.frontmatter-pill{display:inline-block;color:#334155;background:#eef2ff;border:1px solid #dbeafe;border-radius:0;padding:2px 9px;font-size:.78rem}
.frontmatter-raw{margin:0;padding:10px;border:1px solid #e2e8f0;border-radius:0;background:#f8fafc;color:#334155;font-size:.84rem}
.markdown-content{line-height:1.75;color:#0f172a}.markdown-content>:first-child{margin-top:0}.markdown-content>:last-child{margin-bottom:0}
.markdown-content h1,.markdown-content h2,.markdown-content h3,.markdown-content h4{line-height:1.3;margin:1.2em 0 .5em;color:#020617}
.markdown-content p{margin:.8em 0}.markdown-content ul,.markdown-content ol{margin:.8em 0;padding-left:1.4em}.markdown-content li{margin:.25em 0}
.markdown-content blockquote{margin:1em 0;padding:.6em .9em;border-left:4px solid #cbd5e1;background:#f8fafc;color:#475569}
.markdown-content hr{border:0;border-top:1px solid #e2e8f0;margin:1.5em 0}.markdown-content code{background:#f1f5f9;border-radius:0;padding:.12em .36em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
.markdown-content pre code{background:transparent;padding:0;border-radius:0}.markdown-content table{width:100%;border-collapse:collapse;margin:1em 0}
.markdown-content th,.markdown-content td{border:1px solid #e2e8f0;padding:.45em .6em;text-align:left}
.markdown-content a{text-decoration:none}.markdown-content a.wiki-link{color:#2563eb}.markdown-content a.wiki-link.unresolved{color:#94a3b8}
`;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const resolveQuery = (raw: string | undefined): string => raw?.trim().toLowerCase() ?? "";

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

const buildTitleMap = (
  notes: ReadonlyArray<Pick<Note, "id" | "title">>,
): Map<string, Pick<Note, "id" | "title">> => new Map(notes.map((note) => [note.title, note]));

const FrontmatterCard = ({ frontmatter }: { frontmatter: string | null }): JSX.Element | null => {
  if (!frontmatter) {
    return null;
  }
  const entries = parseFrontmatterEntries(frontmatter);
  if (entries.length === 0) {
    return (
      <section className="frontmatter-card">
        <div className="frontmatter-head">
          <h2 className="frontmatter-title">Frontmatter</h2>
          <span className="frontmatter-count">raw</span>
        </div>
        <pre className="frontmatter-raw">{frontmatter}</pre>
      </section>
    );
  }
  return (
    <section className="frontmatter-card">
      <div className="frontmatter-head">
        <h2 className="frontmatter-title">Frontmatter</h2>
        <span className="frontmatter-count">{entries.length} fields</span>
      </div>
      <div className="frontmatter-grid">
        {entries.map((entry) => (
          <div key={entry.key} className="frontmatter-row">
            <p className="frontmatter-key">{entry.key}</p>
            <div className="frontmatter-value">
              {Array.isArray(entry.value) ? (
                entry.value.length > 0 ? (
                  <div className="frontmatter-pill-list">
                    {entry.value.map((item) => (
                      <span key={`${entry.key}-${item}`} className="frontmatter-pill">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="muted">-</span>
                )
              ) : entry.value ? (
                entry.value
              ) : (
                <span className="muted">-</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const HtmlPage = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element => (
  <html lang="ja">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      <style>{STYLE_TEXT}</style>
    </head>
    <body>
      <main>{children}</main>
    </body>
  </html>
);

const renderPage = (title: string, content: React.ReactNode): string =>
  `<!doctype html>${renderToStaticMarkup(<HtmlPage title={title}>{content}</HtmlPage>)}`;

const app = new Hono();

app.get("/", (c) =>
  c.html(
    renderPage(
      "Hako Web",
      <>
        <h1>Hako Web</h1>
        <p className="muted">Hono + Bun + React SSR 版</p>
        <p>
          <a href="/notes">ノート一覧へ</a>
        </p>
        <p>
          <a href="/graph">グラフを見る</a>
        </p>
      </>,
    ),
  ),
);

app.get("/notes", async (c) => {
  const notes = await getNotes();
  const query = resolveQuery(c.req.query("q"));
  const filtered = query ? notes.filter((note) => note.title.toLowerCase().includes(query)) : notes;

  return c.html(
    renderPage(
      "ノート一覧",
      <>
        <h1>ノート一覧</h1>
        <form style={{ marginBottom: "12px" }}>
          <label htmlFor="notes-search">検索</label>
          <br />
          <input
            id="notes-search"
            type="search"
            name="q"
            defaultValue={c.req.query("q") ?? ""}
            placeholder="タイトルで検索"
          />
        </form>
        <p className="muted">
          {filtered.length} 件 / {notes.length} 件
        </p>
        {filtered.length === 0 ? (
          <p>ノートがありません。</p>
        ) : (
          <ul className="stack">
            {filtered.map((note) => (
              <li key={note.id}>
                <a href={`/notes/${encodeURIComponent(note.id)}`}>{note.title}</a>
              </li>
            ))}
          </ul>
        )}
        <p>
          <a href="/graph">グラフを見る</a>
        </p>
      </>,
    ),
  );
});

app.get("/notes/:id", async (c) => {
  const validated = parse(NoteIdSchema, c.req.param("id"));
  const note = await getNote(validated);
  if (!note) {
    return c.html(
      renderPage(
        "ノートが見つかりません",
        <>
          <h1>ノートが見つかりません</h1>
          <p>
            <a href="/notes">一覧へ戻る</a>
          </p>
        </>,
      ),
      404,
    );
  }

  const notes = await getNotes();
  const titleMap = buildTitleMap(notes);
  const backlinks = buildBacklinks(notes, note.title);
  const { frontmatter, body } = extractFrontmatter(note.content ?? "");
  const markdown = body.trim();
  const rendered = markdown
    ? await renderMarkdown(markdown, (title, label) => {
        const target = titleMap.get(title);
        return { href: target ? `/notes/${target.id}` : null, label };
      })
    : "";

  return c.html(
    renderPage(
      note.title,
      <>
        <p>
          <a href="/notes">← 一覧へ戻る</a>
        </p>
        <h1>{note.title}</h1>
        <p className="muted">{note.path}</p>
        <FrontmatterCard frontmatter={frontmatter} />
        {rendered ? (
          <article className="markdown-content" dangerouslySetInnerHTML={{ __html: rendered }} />
        ) : (
          <p className="muted">ノートの内容がまだ読み込まれていません。</p>
        )}
        <section>
          <h2>バックリンク</h2>
          {backlinks.length === 0 ? (
            <p className="muted">バックリンクはありません。</p>
          ) : (
            <ul className="stack">
              {backlinks.map((link) => {
                const target = titleMap.get(link.title);
                return target ? (
                  <li key={link.title}>
                    <a href={`/notes/${encodeURIComponent(target.id)}`}>{link.label}</a>
                  </li>
                ) : (
                  <li key={link.title} className="muted">
                    {link.label}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </>,
    ),
  );
});

app.get("/graph", async (c) => {
  const notes = await getNotes();
  const graph = buildNoteGraph(notes);
  return c.html(
    renderPage(
      "ノートグラフ",
      <>
        <p>
          <a href="/notes">← 一覧へ戻る</a>
        </p>
        <h1>ノートグラフ</h1>
        {graph.nodes.length === 0 ? (
          <p>ノートがありません。</p>
        ) : (
          <div className="panel">
            <h2>Nodes</h2>
            <ul className="stack">
              {graph.nodes.map((node) => (
                <li key={node.id}>
                  {node.title} <span className="muted">({node.id})</span>
                </li>
              ))}
            </ul>
            <h2>Links</h2>
            <ul className="stack">
              {graph.links.map((link, index) => (
                <li key={`${link.source}-${link.target}-${index}`}>
                  {escapeHtml(link.source)} → {escapeHtml(link.target)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>,
    ),
  );
});

export { app };
