import { Hono } from "hono";
import React from "react";
import { IoFileTrayFullOutline } from "react-icons/io5";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "valibot";

import type { Note } from "@hako/core";
import { getNote, getNotes } from "./entities/note/api/notes";
import { NoteIdSchema } from "./entities/note/model/types";
import { buildBacklinks } from "./shared/lib/backlinks";
import { buildNoteGraph } from "./shared/lib/graph";
import { renderMarkdown } from "./shared/lib/markdown";

const STYLE_TEXT = `
:root{
  color-scheme:light;
  font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;
  --bg:#f4f7fb;
  --surface:#ffffff;
  --surface-soft:#f4f6f8;
  --ink:#16181c;
  --ink-soft:#5e6673;
  --line:#d5dbe3;
  --accent:#2f3640;
  --accent-soft:#eceff3;
  --line-strong:#bbc4cf;
  --chip-bg:#eef1f5;
  --chip-line:#d7dde5;
  --subtle-bg:#f6f8fa;
  --subtle-line:#dee4ec;
  --title:#0f1115;
  --space:24px;
  --radius:10px;
}
body{margin:0;color:var(--ink);background:var(--bg)}
*,*::before,*::after{box-sizing:border-box}
header{width:100%;padding:20px clamp(18px,3.6vw,56px) 10px}
main{width:100%;margin:0;padding:30px 32px 48px;background:var(--surface);line-height:1.9;overflow-x:hidden;border-radius:16px}
a{color:var(--accent)}
h1{margin-top:0}
pre{overflow-x:auto;border-radius:6px}
.muted{color:var(--ink-soft);overflow-wrap:anywhere}
.stack{display:grid;gap:14px}
.stack>li{margin:0}
.content-shell{width:100%;display:grid;padding:0 clamp(18px,3.6vw,56px)}
.content-shell.has-sidebar{grid-template-columns:280px minmax(0,1fr);gap:24px}
.side-menu{position:sticky;top:14px;max-height:calc(100vh - 28px);overflow:hidden;padding:10px 8px 10px 0;background:var(--bg)}
.side-menu-nav{display:grid;grid-template-rows:auto minmax(0,1fr);height:100%}
.side-menu-title{margin:0;padding:0 0 10px;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);background:var(--bg)}
.side-menu-scroll{min-height:0;overflow-y:auto;overflow-x:hidden;padding-top:2px}
.side-menu-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.side-menu-link{display:block;padding:7px 10px;border-radius:8px;color:var(--ink-soft);text-decoration:none;font-size:.85rem;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-menu-link:hover{background:var(--surface-soft);color:var(--ink)}
.side-menu-link[aria-current="page"]{background:var(--accent-soft);color:var(--accent);font-weight:700}
.page-grid,.notes-page{display:grid;gap:var(--space);min-width:0;width:100%}
.page-grid>*,.notes-page>*{margin:0;min-width:0;max-width:100%}
.site-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px;padding:0 0 14px;background:transparent}
.site-brand{display:grid;grid-template-columns:auto;align-items:center;color:var(--ink);text-decoration:none}
.site-logo{display:grid;place-items:center;width:34px;height:34px;color:var(--ink-soft)}
.site-nav{display:grid;grid-auto-flow:column;column-gap:14px;align-items:center}
.site-nav-link{display:inline-block;padding:6px 0;color:var(--ink-soft);text-decoration:none;font-size:.86rem;background:transparent}
.site-nav-link[aria-current="page"]{color:var(--accent);font-weight:700;text-decoration:underline;text-underline-offset:7px}
.site-nav-link:hover{color:var(--ink)}
.panel{border:1px solid var(--line);border-radius:12px;background:var(--surface-soft);padding:16px}
.notes-page h1{font-size:1.2rem;line-height:1.6}
.notes-search{display:grid;grid-template-columns:84px minmax(0,520px);align-items:center;gap:0 12px}
.notes-search input{box-sizing:border-box;width:100%;max-width:520px;height:42px;padding:0 12px;border:1px solid var(--line);background:#fff;font:inherit;border-radius:10px}
.notes-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.notes-list li{margin:0}
.notes-list a{display:block;line-height:1.7;text-decoration:none;border:1px solid var(--subtle-line);background:var(--surface);border-radius:10px;padding:11px 14px;transition:background-color .16s ease,border-color .16s ease}
.notes-list a:hover{background:var(--surface-soft);border-color:var(--line-strong)}
.frontmatter-card{border:1px solid var(--line);border-radius:0;background:#fff;padding:14px}
.frontmatter-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px}
.frontmatter-card[open] .frontmatter-head{margin-bottom:10px}
.frontmatter-title{margin:0;font-size:.88rem;font-weight:600;color:var(--ink)}
.frontmatter-count{font-size:.7rem;color:var(--ink-soft);background:var(--surface-soft);border:1px solid var(--line);padding:2px 8px;border-radius:0}
.frontmatter-grid{display:grid;gap:10px}
.frontmatter-row{display:grid;grid-template-columns:minmax(110px,160px) minmax(0,1fr);gap:10px;padding:4px 0}
.frontmatter-key{margin:0;color:var(--ink-soft);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.02em}
.frontmatter-value{min-width:0;margin:0;color:var(--ink);font-size:.86rem;line-height:1.7;overflow-wrap:anywhere}
.frontmatter-pill-list{display:flex;flex-wrap:wrap;gap:6px}
.frontmatter-pill{display:inline-block;color:#334155;background:var(--chip-bg);border:1px solid var(--chip-line);padding:2px 9px;font-size:.72rem;overflow-wrap:anywhere}
.frontmatter-raw{margin:0;padding:10px;border:1px solid var(--subtle-line);background:var(--subtle-bg);color:#475569;font-size:.78rem}
.frontmatter-toggle{cursor:pointer;list-style:none}
.frontmatter-toggle::-webkit-details-marker{display:none}
.frontmatter-toggle::marker{content:""}
.frontmatter-toggle::before{content:"▸";display:inline-block;width:1.2em;color:var(--ink-soft)}
details[open] .frontmatter-toggle::before{content:"▾"}
.markdown-content{color:var(--ink);min-width:0;max-width:100%;overflow-x:hidden}
.markdown-content>:first-child{margin-top:0}
.markdown-content>:last-child{margin-bottom:0}
.markdown-content h1,.markdown-content h2,.markdown-content h3,.markdown-content h4{margin:1.6em 0 .7em;line-height:1.45;font-weight:600;color:var(--title)}
.markdown-content p{margin:.85em 0;line-height:1.95}
.markdown-content ul,.markdown-content ol{margin:.85em 0;padding-left:1.4em;line-height:1.9}
.markdown-content li{margin:.35em 0}
.markdown-content blockquote{margin:1em 0;padding:.5em 1em;border-left:3px solid var(--line-strong);background:var(--subtle-bg);color:#475569}
.markdown-content hr{border:0;border-top:1px solid var(--subtle-line);margin:1.6em 0}
.markdown-content code{background:var(--accent-soft);padding:.12em .36em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
.markdown-content pre{max-width:100%;overflow-x:auto;padding:12px;background:#1b1f24;border:1px solid #2b323b}
.markdown-content pre code{background:transparent;padding:0}
.markdown-content .shiki{max-width:100%;overflow-x:auto}
.markdown-content table{width:100%;border-collapse:collapse;margin:1em 0}
.markdown-content th,.markdown-content td{border:1px solid var(--subtle-line);padding:.45em .6em;text-align:left}
.markdown-content a{text-decoration:underline;text-underline-offset:3px}
.markdown-content a.wiki-link{color:var(--accent)}
.markdown-content a.wiki-link.unresolved{color:#9ca3af}
.graph-panel{display:grid;grid-template-columns:1fr 1fr;gap:var(--space)}
.graph-section{display:grid;gap:12px}
.graph-section h2{margin:0}
@media (max-width:840px){
  .content-shell.has-sidebar{grid-template-columns:1fr}
  .side-menu{position:static;max-height:none;padding:0}
  .side-menu-nav{height:auto}
  .side-menu-scroll{overflow:visible}
  .site-header{grid-template-columns:1fr}
  .site-nav{grid-template-columns:1fr 1fr;grid-auto-flow:unset;column-gap:10px}
  .site-nav-link{padding:8px 0}
  .notes-search{grid-template-columns:1fr}
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
      <details className="frontmatter-card">
        <summary className="frontmatter-head frontmatter-toggle">
          <h2 className="frontmatter-title">Frontmatter</h2>
          <span className="frontmatter-count">raw</span>
        </summary>
        <pre className="frontmatter-raw">{frontmatter}</pre>
      </details>
    );
  }
  return (
    <details className="frontmatter-card">
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

const MetadataCard = ({ path }: { path: string }): JSX.Element => (
  <details className="frontmatter-card">
    <summary className="frontmatter-head frontmatter-toggle">
      <h2 className="frontmatter-title">Metadata</h2>
      <span className="frontmatter-count">1 field</span>
    </summary>
    <div className="frontmatter-grid">
      <div className="frontmatter-row">
        <p className="frontmatter-key">FILE_PATH</p>
        <div className="frontmatter-value">{path}</div>
      </div>
    </div>
  </details>
);

const Header = ({ pathname }: { pathname: string }): JSX.Element => (
  <header>
    <div className="site-header">
      <a className="site-brand" href="/" aria-label="トップページ">
        <span className="site-logo" aria-hidden="true">
          <IoFileTrayFullOutline size={24} />
        </span>
      </a>
      <nav className="site-nav" aria-label="global">
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

const SideMenu = ({
  notes,
  pathname,
}: {
  notes: ReadonlyArray<Pick<Note, "id" | "title">>;
  pathname: string;
}): JSX.Element => (
  <aside className="side-menu" aria-labelledby="notes-menu-title">
    <nav className="side-menu-nav" aria-labelledby="notes-menu-title">
      <h2 id="notes-menu-title" className="side-menu-title">
        Notes
      </h2>
      <div className="side-menu-scroll">
        {notes.length === 0 ? (
          <p className="muted">ノートがありません。</p>
        ) : (
          <ul className="side-menu-list">
            {notes.map((note) => {
              const href = `/notes/${encodeURIComponent(note.id)}`;
              return (
                <li key={note.id}>
                  <a
                    className="side-menu-link"
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                  >
                    {note.title}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  </aside>
);

const HtmlPage = ({
  title,
  pathname,
  sidebarNotes,
  children,
}: {
  title: string;
  pathname: string;
  sidebarNotes?: ReadonlyArray<Pick<Note, "id" | "title">>;
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
      <div className={`content-shell${sidebarNotes ? " has-sidebar" : ""}`}>
        {sidebarNotes ? <SideMenu notes={sidebarNotes} pathname={pathname} /> : null}
        <main>{children}</main>
      </div>
    </body>
  </html>
);

const renderPage = (
  title: string,
  pathname: string,
  content: React.ReactNode,
  sidebarNotes?: ReadonlyArray<Pick<Note, "id" | "title">>,
): string =>
  `<!doctype html>${renderToStaticMarkup(
    <HtmlPage title={title} pathname={pathname} {...(sidebarNotes ? { sidebarNotes } : {})}>
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
          <p>一致するノートがありません。</p>
        ) : (
          <p className="muted">左の Notes から選択してください。</p>
        )}
        <p>
          <a href="/graph">グラフを見る</a>
        </p>
      </section>,
      filtered,
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
        <h1>{note.title}</h1>
        <MetadataCard path={note.path} />
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
      notes,
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
      notes,
    ),
  );
});

export { app };
