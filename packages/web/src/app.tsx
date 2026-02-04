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
body{margin:0;color:#0f172a;background:#f3f2ea}
header{max-width:860px;margin:0 auto;padding:18px 20px 0}
:root{--note-line-step:32px;--note-rule-offset:24px;--note-padding-top:16px}
main{position:relative;max-width:860px;margin:0 auto;padding:var(--note-padding-top) 20px 48px;border:1px solid #d9d7cc;background-color:#fffef8;background-image:linear-gradient(to bottom,transparent calc(var(--note-rule-offset) - 1px),#d6e3ff calc(var(--note-rule-offset) - 1px) var(--note-rule-offset),transparent var(--note-rule-offset));background-size:100% var(--note-line-step);background-position:0 var(--note-padding-top);background-repeat:repeat-y;line-height:var(--note-line-step)}
main::before{content:"";position:absolute;top:0;bottom:0;left:72px;width:1px;background:#f3a5a5}
a{color:#2563eb}pre{overflow-x:auto;border-radius:0}
.muted{color:#64748b}
.stack{display:grid;gap:var(--note-line-step)}
.stack>li{margin:0}
.page-grid{display:grid;gap:var(--note-line-step)}
.page-grid>*{margin:0}
.site-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;padding:10px 0 14px;border-bottom:1px solid #dbe3ef}
.site-brand{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:10px;color:#0f172a;text-decoration:none}
.site-logo{display:inline-grid;place-items:center;width:28px;height:28px;border:1px solid #334155;background:#fff;font-weight:700;font-size:.8rem}
.site-title{margin:0;font-size:1rem;font-weight:700;color:#0f172a}
.site-nav{display:grid;grid-auto-flow:column;column-gap:8px;align-items:center}
.site-nav-link{display:inline-block;padding:4px 8px;border:1px solid #dbe3ef;color:#334155;text-decoration:none;font-size:.84rem}
.site-nav-link[aria-current="page"]{background:#0f172a;color:#fff;border-color:#0f172a}
.panel{border:1px solid #e2e8f0;background:#fff;border-radius:0;padding:14px}
.notes-page{display:grid;gap:var(--note-line-step)}
.notes-page>*{margin:0}
.notes-page h1{font-size:1rem;line-height:var(--note-line-step)}
.notes-search{display:grid;grid-template-columns:80px minmax(0,480px);align-items:center;gap:0 12px}
.notes-search input{box-sizing:border-box;width:100%;max-width:480px;height:var(--note-line-step);padding:0 10px;border:1px solid #cbd5e1;background:#fff;font:inherit;line-height:1}
.notes-list{list-style:none;margin:10px 0 0;padding:0}
.notes-list li{margin:0}
.notes-list a{display:block;line-height:var(--note-line-step);text-decoration:none}
.frontmatter-card{border:1px solid #dbe3ef;background:#fff;border-radius:0;padding:14px;margin:16px 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.frontmatter-card:not([open]){padding-bottom:14px}
.frontmatter-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin-bottom:10px}
.frontmatter-card:not([open]) .frontmatter-head{margin-bottom:0}
.frontmatter-title{margin:0;font-size:.95rem;font-weight:700;color:#0f172a}
.frontmatter-count{font-size:.75rem;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:0;padding:2px 8px}
.frontmatter-grid{display:grid;gap:8px}.frontmatter-row{display:grid;grid-template-columns:minmax(110px,160px) 1fr;gap:10px;padding:6px 0}
.frontmatter-key{margin:0;color:#334155;font-size:.78rem;font-weight:700;text-transform:uppercase}
.frontmatter-value{margin:0;color:#0f172a;font-size:.92rem;line-height:1.55}
.frontmatter-pill-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,max-content));gap:6px}.frontmatter-pill{display:inline-block;color:#334155;background:#eef2ff;border:1px solid #dbeafe;border-radius:0;padding:2px 9px;font-size:.78rem}
.frontmatter-raw{margin:0;padding:10px;border:1px solid #e2e8f0;border-radius:0;background:#f8fafc;color:#334155;font-size:.84rem}
.frontmatter-toggle{cursor:pointer;list-style:none}
.frontmatter-toggle::-webkit-details-marker{display:none}
.frontmatter-toggle::marker{content:""}
.frontmatter-toggle::before{content:"+";display:inline-block;width:1.2em;color:#334155}
details[open] .frontmatter-toggle::before{content:"-"}
.markdown-content{line-height:var(--note-line-step);color:#0f172a}.markdown-content>:first-child{margin-top:0}.markdown-content>:last-child{margin-bottom:0}
.markdown-content h1,.markdown-content h2,.markdown-content h3,.markdown-content h4{line-height:var(--note-line-step);margin:0;color:#020617}
.markdown-content p{margin:0}.markdown-content ul,.markdown-content ol{margin:0;padding-left:1.4em}.markdown-content li{margin:0}
.markdown-content blockquote{margin:1em 0;padding:.6em .9em;border-left:4px solid #cbd5e1;background:#f8fafc;color:#475569}
.markdown-content hr{border:0;border-top:1px solid #e2e8f0;margin:1.5em 0}.markdown-content code{background:#f1f5f9;border-radius:0;padding:.12em .36em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
.markdown-content pre{padding:12px}.markdown-content pre code{background:transparent;padding:0;border-radius:0}.markdown-content table{width:100%;border-collapse:collapse;margin:1em 0}
.markdown-content th,.markdown-content td{border:1px solid #e2e8f0;padding:.45em .6em;text-align:left}
.markdown-content a{text-decoration:none}.markdown-content a.wiki-link{color:#2563eb}.markdown-content a.wiki-link.unresolved{color:#94a3b8}
.graph-panel{display:grid;grid-template-columns:1fr 1fr;gap:var(--note-line-step)}
.graph-section{display:grid;gap:var(--note-line-step)}
.graph-section h2{margin:0}
@media (max-width:840px){
  .site-header{grid-template-columns:1fr}
  .site-nav{grid-auto-flow:row;grid-template-columns:1fr 1fr 1fr}
  .notes-search{grid-template-columns:1fr}
  .notes-search label{margin-bottom:0}
  .graph-panel{grid-template-columns:1fr}
}
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
      <details className="frontmatter-card" open>
        <summary className="frontmatter-head frontmatter-toggle">
          <h2 className="frontmatter-title">Frontmatter</h2>
          <span className="frontmatter-count">raw</span>
        </summary>
        <pre className="frontmatter-raw">{frontmatter}</pre>
      </details>
    );
  }
  return (
    <details className="frontmatter-card" open>
      <summary className="frontmatter-head frontmatter-toggle">
        <h2 className="frontmatter-title">Frontmatter</h2>
        <span className="frontmatter-count">{entries.length} fields</span>
      </summary>
      <div className="frontmatter-grid">
        {entries.map((entry) => (
          <div key={entry.key} className="frontmatter-row">
            <p className="frontmatter-key">{entry.key}</p>
            <div className="frontmatter-value">
              {Array.isArray(entry.value) ? (
                entry.value.length > 0 ? (
                  <div className="frontmatter-pill-list">
                    {entry.value.map((item, index) => (
                      <span key={`${entry.key}-${index}-${item}`} className="frontmatter-pill">
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
    </details>
  );
};

const Header = ({ pathname }: { pathname: string }): JSX.Element => (
  <header>
    <div className="site-header">
      <a className="site-brand" href="/">
        <span className="site-logo" aria-hidden="true">
          箱
        </span>
        <p className="site-title">Hako</p>
      </a>
      <nav className="site-nav" aria-label="global">
        <a className="site-nav-link" href="/" aria-current={pathname === "/" ? "page" : undefined}>
          Home
        </a>
        <a
          className="site-nav-link"
          href="/notes"
          aria-current={pathname.startsWith("/notes") ? "page" : undefined}
        >
          Notes
        </a>
        <a
          className="site-nav-link"
          href="/graph"
          aria-current={pathname.startsWith("/graph") ? "page" : undefined}
        >
          Graph
        </a>
      </nav>
    </div>
  </header>
);

const HtmlPage = ({
  title,
  pathname,
  children,
}: {
  title: string;
  pathname: string;
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
      <Header pathname={pathname} />
      <main>{children}</main>
    </body>
  </html>
);

const renderPage = (title: string, pathname: string, content: React.ReactNode): string =>
  `<!doctype html>${renderToStaticMarkup(
    <HtmlPage title={title} pathname={pathname}>
      {content}
    </HtmlPage>,
  )}`;

const app = new Hono();

app.get("/", (c) =>
  c.html(
    renderPage(
      "Hako Web",
      c.req.path,
      <section className="page-grid">
        <h1>Hako Web</h1>
        <p className="muted">Hono + Bun + React SSR 版</p>
        <p>
          <a href="/notes">ノート一覧へ</a>
        </p>
        <p>
          <a href="/graph">グラフを見る</a>
        </p>
      </section>,
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
      c.req.path,
      <section className="notes-page">
        <h1>ノート一覧</h1>
        <form className="notes-search">
          <label htmlFor="notes-search">検索</label>
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
          <ul className="notes-list">
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
      </section>,
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
        c.req.path,
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
      c.req.path,
      <section className="page-grid">
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
      </section>,
    ),
  );
});

app.get("/graph", async (c) => {
  const notes = await getNotes();
  const graph = buildNoteGraph(notes);
  return c.html(
    renderPage(
      "ノートグラフ",
      c.req.path,
      <section className="page-grid">
        <p>
          <a href="/notes">← 一覧へ戻る</a>
        </p>
        <h1>ノートグラフ</h1>
        {graph.nodes.length === 0 ? (
          <p>ノートがありません。</p>
        ) : (
          <div className="panel graph-panel">
            <section className="graph-section">
              <h2>Nodes</h2>
              <ul className="stack">
                {graph.nodes.map((node) => (
                  <li key={node.id}>{node.title}</li>
                ))}
              </ul>
            </section>
            <section className="graph-section">
              <h2>Links</h2>
              <ul className="stack">
                {graph.links.map((link, index) => (
                  <li key={`${link.source}-${link.target}-${index}`}>
                    {escapeHtml(link.source)} → {escapeHtml(link.target)}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </section>,
    ),
  );
});

export { app };
