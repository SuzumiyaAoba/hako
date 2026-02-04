import { Hono } from "hono";
import { parse } from "valibot";

import type { Note } from "@hako/core";
import { getNote, getNotes } from "./entities/note/api/notes";
import { NoteIdSchema } from "./entities/note/model/types";
import { buildBacklinks } from "./shared/lib/backlinks";
import { buildNoteGraph } from "./shared/lib/graph";
import { renderMarkdown } from "./shared/lib/markdown";

const baseLayout = (title: string, body: string): string => `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      body {
        margin: 0;
        color: #0f172a;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 320px);
      }
      main {
        max-width: 860px;
        margin: 0 auto;
        padding: 24px 20px 48px;
      }
      a { color: #2563eb; }
      pre {
        overflow-x: auto;
        border-radius: 10px;
      }
      .muted { color: #64748b; }
      .stack { display: grid; gap: 10px; }
      .panel {
        border: 1px solid #e2e8f0;
        background: #fff;
        border-radius: 12px;
        padding: 14px;
      }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;

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

  return {
    frontmatter: frontmatter || null,
    body: trimmed.slice(bodyStart),
  };
};

const parseFrontmatterEntries = (
  frontmatter: string | null,
): Array<{ key: string; value: string | string[] }> => {
  if (!frontmatter) {
    return [];
  }

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

const buildTitleMap = (
  notes: ReadonlyArray<Pick<Note, "id" | "title">>,
): Map<string, Pick<Note, "id" | "title">> => new Map(notes.map((note) => [note.title, note]));

const renderFrontmatter = (frontmatter: string | null): string => {
  if (!frontmatter) {
    return "";
  }

  const entries = parseFrontmatterEntries(frontmatter);
  if (entries.length === 0) {
    return `<section class="panel"><h2>Frontmatter</h2><pre>${escapeHtml(frontmatter)}</pre></section>`;
  }

  const rows = entries
    .map((entry) => {
      const value = Array.isArray(entry.value)
        ? entry.value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : escapeHtml(entry.value);
      const normalized = Array.isArray(entry.value) ? `<ul>${value}</ul>` : value;
      return `<tr><th style="text-align:left;vertical-align:top;padding:6px 8px 6px 0">${escapeHtml(entry.key)}</th><td style="padding:6px 0">${normalized || '<span class="muted">-</span>'}</td></tr>`;
    })
    .join("");

  return `<section class="panel"><h2>Frontmatter</h2><table>${rows}</table></section>`;
};

const app = new Hono();

app.get("/", (c) =>
  c.html(
    baseLayout(
      "Hako Web",
      `<h1>Hako Web</h1><p class="muted">Hono + Bun 版</p><p><a href="/notes">ノート一覧へ</a></p><p><a href="/graph">グラフを見る</a></p>`,
    ),
  ),
);

app.get("/notes", async (c) => {
  const notes = await getNotes();
  const query = resolveQuery(c.req.query("q"));
  const filtered = query ? notes.filter((note) => note.title.toLowerCase().includes(query)) : notes;
  const items = filtered
    .map(
      (note) =>
        `<li><a href="/notes/${encodeURIComponent(note.id)}">${escapeHtml(note.title)}</a> <span class="muted">(${escapeHtml(note.path)})</span></li>`,
    )
    .join("");
  const body = `<h1>ノート一覧</h1>
<form style="margin-bottom:12px">
  <label for="notes-search">検索</label><br />
  <input id="notes-search" type="search" name="q" value="${escapeHtml(c.req.query("q") ?? "")}" placeholder="タイトルで検索" />
</form>
<p class="muted">${filtered.length} 件 / ${notes.length} 件</p>
${filtered.length === 0 ? "<p>ノートがありません。</p>" : `<ul class="stack">${items}</ul>`}
<p><a href="/graph">グラフを見る</a></p>`;

  return c.html(baseLayout("ノート一覧", body));
});

app.get("/notes/:id", async (c) => {
  const validated = parse(NoteIdSchema, c.req.param("id"));
  const note = await getNote(validated);

  if (!note) {
    return c.html(
      baseLayout(
        "ノートが見つかりません",
        `<h1>ノートが見つかりません</h1><p><a href="/notes">一覧へ戻る</a></p>`,
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
  const backlinksHtml =
    backlinks.length === 0
      ? '<p class="muted">バックリンクはありません。</p>'
      : `<ul class="stack">${backlinks
          .map((link) => {
            const target = titleMap.get(link.title);
            return target
              ? `<li><a href="/notes/${encodeURIComponent(target.id)}">${escapeHtml(link.label)}</a></li>`
              : `<li class="muted">${escapeHtml(link.label)}</li>`;
          })
          .join("")}</ul>`;

  const bodyHtml = `<p><a href="/notes">← 一覧へ戻る</a></p>
<h1>${escapeHtml(note.title)}</h1>
<p class="muted">${escapeHtml(note.path)}</p>
${renderFrontmatter(frontmatter)}
${rendered ? `<article class="panel">${rendered}</article>` : '<p class="muted">ノートの内容がまだ読み込まれていません。</p>'}
<section><h2>バックリンク</h2>${backlinksHtml}</section>`;

  return c.html(baseLayout(note.title, bodyHtml));
});

app.get("/graph", async (c) => {
  const notes = await getNotes();
  const graph = buildNoteGraph(notes);
  const nodeList = graph.nodes
    .map(
      (node) =>
        `<li>${escapeHtml(node.title)} <span class="muted">(${escapeHtml(node.id)})</span></li>`,
    )
    .join("");
  const linkList = graph.links
    .map((link) => `<li>${escapeHtml(link.source)} → ${escapeHtml(link.target)}</li>`)
    .join("");

  const body = `<p><a href="/notes">← 一覧へ戻る</a></p>
<h1>ノートグラフ</h1>
${graph.nodes.length === 0 ? "<p>ノートがありません。</p>" : `<div class="panel"><h2>Nodes</h2><ul class="stack">${nodeList}</ul><h2>Links</h2><ul class="stack">${linkList}</ul></div>`}`;
  return c.html(baseLayout("ノートグラフ", body));
});

export { app };
