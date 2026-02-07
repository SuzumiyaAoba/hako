import { Elysia } from "elysia";
import React from "react";
import { IoDocumentTextOutline, IoFileTrayFullOutline, IoSettingsOutline } from "react-icons/io5";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "valibot";

import type { Note } from "@hako/core";
import { getConfig, updateConfig } from "./entities/config/api/config";
import type { Config } from "./entities/config/model/types";
import { getNote, getNotes } from "./entities/note/api/notes";
import { NoteIdSchema } from "./entities/note/model/types";
import { cn } from "./lib/utils";
import { buildBacklinks } from "./shared/lib/backlinks";
import { buildNoteGraph } from "./shared/lib/graph";
import { renderMarkdown } from "./shared/lib/markdown";

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

type SettingsFormValues = {
  notesDir: string;
  fleeting: string;
  literature: string;
  permanent: string;
  structure: string;
  index: string;
};

type SettingsFieldKey = keyof SettingsFormValues;
type SettingsFieldErrors = Partial<Record<SettingsFieldKey, string>>;
type SettingsSection = "storage" | "zettelkasten";

type SettingsMessage = {
  type: "success" | "error";
  text: string;
};

type FormValue = string | Blob;

type FormDataLike = {
  get(name: string): FormValue | null;
};

const SETTINGS_FIELDS: ReadonlyArray<{
  key: SettingsFieldKey;
  label: string;
  description: string;
}> = [
  { key: "notesDir", label: "Notes Root", description: "ノートのルートディレクトリ" },
  { key: "fleeting", label: "Fleeting", description: "一時メモ" },
  { key: "literature", label: "Literature", description: "文献ノート" },
  { key: "permanent", label: "Permanent", description: "恒久ノート" },
  { key: "structure", label: "Structure", description: "構造ノート" },
  { key: "index", label: "Index", description: "索引ノート" },
];

const SETTINGS_CATEGORIES: ReadonlyArray<{
  key: SettingsSection;
  id: string;
  title: string;
  fields: ReadonlyArray<SettingsFieldKey>;
}> = [
  {
    key: "storage",
    id: "settings-general",
    title: "保存場所",
    fields: ["notesDir"],
  },
  {
    key: "zettelkasten",
    id: "settings-zettelkasten",
    title: "Zettelkasten",
    fields: ["fleeting", "literature", "permanent", "structure", "index"],
  },
];

const getSettingsFieldMeta = (
  key: SettingsFieldKey,
): { key: SettingsFieldKey; label: string; description: string } =>
  SETTINGS_FIELDS.find((field) => field.key === key) ?? {
    key,
    label: key,
    description: "",
  };

const configToFormValues = (config: Config): SettingsFormValues => ({
  notesDir: config.notesDir,
  fleeting: config.zettelkasten.directories.fleeting,
  literature: config.zettelkasten.directories.literature,
  permanent: config.zettelkasten.directories.permanent,
  structure: config.zettelkasten.directories.structure,
  index: config.zettelkasten.directories.index,
});

const parseFormValue = (formData: FormDataLike, key: SettingsFieldKey): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const extractSettingsFormValues = (formData: FormDataLike): SettingsFormValues => ({
  notesDir: parseFormValue(formData, "notesDir"),
  fleeting: parseFormValue(formData, "fleeting"),
  literature: parseFormValue(formData, "literature"),
  permanent: parseFormValue(formData, "permanent"),
  structure: parseFormValue(formData, "structure"),
  index: parseFormValue(formData, "index"),
});

const validateSettingsFormValues = (values: SettingsFormValues): SettingsFieldErrors => {
  const errors: SettingsFieldErrors = {};
  for (const field of SETTINGS_FIELDS) {
    if (!values[field.key]) {
      errors[field.key] = "必須です。";
    }
  }

  const directoryFields: ReadonlyArray<SettingsFieldKey> = [
    "fleeting",
    "literature",
    "permanent",
    "structure",
    "index",
  ];
  const seen = new Set<string>();
  for (const field of directoryFields) {
    const value = values[field];
    if (!value) {
      continue;
    }
    if (seen.has(value)) {
      errors[field] = "重複しない値を指定してください。";
    }
    seen.add(value);
  }

  return errors;
};

const hasFieldErrors = (errors: SettingsFieldErrors): boolean => Object.keys(errors).length > 0;

const resolveSettingsSection = (value: string | null | undefined): SettingsSection =>
  value === "zettelkasten" ? "zettelkasten" : "storage";

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

const SettingsForm = ({
  config,
  values,
  activeSection,
  errors,
  message,
}: {
  config: Config;
  values: SettingsFormValues;
  activeSection: SettingsSection;
  errors?: SettingsFieldErrors;
  message?: SettingsMessage;
}): JSX.Element => {
  const fallbackCategory: {
    key: SettingsSection;
    id: string;
    title: string;
    fields: ReadonlyArray<SettingsFieldKey>;
  } = {
    key: "storage",
    id: "settings-general",
    title: "保存場所",
    fields: ["notesDir"],
  };
  const activeCategory =
    SETTINGS_CATEGORIES.find((category) => category.key === activeSection) ?? fallbackCategory;
  const visibleKeys = new Set(activeCategory.fields);
  const hiddenKeys = SETTINGS_FIELDS.map((field) => field.key).filter(
    (key) => !visibleKeys.has(key),
  );

  return (
    <section className="space-y-6 text-pretty">
      <div className="space-y-3">
        <h1 className="text-balance text-2xl font-semibold text-slate-900">設定</h1>
        <div className="grid gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            読み込み元:{" "}
            <code className="break-all rounded bg-white/90 px-1.5 py-0.5 text-xs text-slate-900">
              {config.sourcePath ?? "(未作成 / デフォルト値を使用中)"}
            </code>
          </p>
          <p>
            保存先:{" "}
            <code className="break-all rounded bg-white/90 px-1.5 py-0.5 text-xs text-slate-900">
              {config.writeTargetPath}
            </code>
          </p>
        </div>
      </div>
      <form
        method="post"
        action={`/settings?section=${activeSection}`}
        className="grid gap-8"
        style={{ gridTemplateColumns: "220px minmax(0, 1fr)" }}
      >
        <input type="hidden" name="section" value={activeSection} />
        {hiddenKeys.map((key) => (
          <input key={key} type="hidden" name={key} value={values[key]} />
        ))}
        <aside className="sticky top-4 self-start">
          <nav aria-label="settings categories" className="rounded-xl bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">カテゴリ</p>
            <ul className="space-y-1">
              {SETTINGS_CATEGORIES.map((category) => (
                <li key={category.id}>
                  <a
                    href={`/settings?section=${category.key}`}
                    className={cn(
                      "block rounded-md bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-900",
                      category.key === activeSection ? "bg-white text-slate-900" : "",
                    )}
                  >
                    {category.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <div className="space-y-6">
          <section id={activeCategory.id} className="space-y-4 rounded-xl bg-slate-50 p-4">
            <h2 className="text-balance text-lg font-semibold text-slate-900">
              {activeCategory.title}
            </h2>
            <div className="grid gap-4">
              {activeCategory.fields.map((key) => {
                const field = getSettingsFieldMeta(key);
                const value = values[field.key];
                const error = errors?.[field.key];

                return (
                  <label key={field.key} className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900">{field.label}</span>
                      <span className="text-xs text-slate-500">{field.description}</span>
                    </div>
                    <input
                      type="text"
                      name={field.key}
                      defaultValue={value}
                      aria-invalid={error ? "true" : undefined}
                      aria-describedby={error ? `${field.key}-error` : undefined}
                      className={cn(
                        "h-10 w-full rounded-lg bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300",
                        error ? "bg-rose-50 focus:ring-rose-200" : "",
                      )}
                    />
                    {error ? (
                      <p id={`${field.key}-error`} className="text-xs text-rose-600">
                        {error}
                      </p>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </section>
          <div className="mt-6 flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              設定を保存
            </button>
            {message ? (
              <p
                className={cn(
                  "text-sm",
                  message.type === "success" ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
};

const Header = ({
  pathname,
  searchQuery,
}: {
  pathname: string;
  searchQuery: string;
}): JSX.Element => (
  <header className="px-4 pb-2 pt-5 sm:px-6 lg:px-14">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <a className="flex items-center" href="/" aria-label="トップページ">
          <span
            className="flex size-9 items-center justify-center text-slate-500"
            aria-hidden="true"
          >
            <IoFileTrayFullOutline size={24} />
          </span>
        </a>
        <form className="flex items-center" action="/notes" method="get" role="search">
          <label className="sr-only" htmlFor="header-search">
            ノートを検索
          </label>
          <input
            id="header-search"
            type="search"
            name="q"
            defaultValue={searchQuery ?? ""}
            placeholder="ノートを検索"
            className="h-10 w-80 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-96"
          />
        </form>
      </div>
      <nav className="flex items-center gap-4 text-sm" aria-label="global">
        <a
          className={cn(
            "text-slate-600 hover:text-slate-900",
            pathname.startsWith("/notes") &&
              "font-semibold text-slate-900 underline decoration-slate-300 underline-offset-8",
          )}
          href="/notes"
          aria-current={pathname.startsWith("/notes") ? "page" : undefined}
        >
          Notes
        </a>
        <a
          className={cn(
            "text-slate-600 hover:text-slate-900",
            pathname.startsWith("/graph") &&
              "font-semibold text-slate-900 underline decoration-slate-300 underline-offset-8",
          )}
          href="/graph"
          aria-current={pathname.startsWith("/graph") ? "page" : undefined}
        >
          Graph
        </a>
        <a
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            pathname.startsWith("/settings") && "bg-slate-100 text-slate-900",
          )}
          href="/settings"
          aria-label="Settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        >
          <IoSettingsOutline size={16} aria-hidden="true" />
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
  <aside>
    <nav className="flex flex-col gap-3" aria-labelledby="notes-menu-title">
      <h2 id="notes-menu-title" className="text-xs font-semibold uppercase text-slate-500">
        Notes
      </h2>
      <div className="max-h-dvh overflow-x-auto overflow-y-auto pr-1">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">ノートがありません。</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => {
              const href = `/notes/${encodeURIComponent(note.id)}`;
              return (
                <li key={note.id}>
                  <a
                    className={cn(
                      "block truncate rounded-lg border border-transparent px-3 py-2 text-sm text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                      pathname === href && "bg-slate-200 font-semibold text-slate-900",
                    )}
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
  searchQuery,
  children,
}: {
  title: string;
  pathname: string;
  sidebarNotes?: ReadonlyArray<Pick<Note, "id" | "title">>;
  searchQuery?: string;
  children: React.ReactNode;
}): JSX.Element => {
  const resolvedSearchQuery = searchQuery ?? "";
  return (
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
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body className="bg-slate-100 text-slate-900 antialiased">
        <Header pathname={pathname} searchQuery={resolvedSearchQuery} />
        <div
          className={cn(
            "px-4 pb-12 sm:px-6 lg:px-14",
            sidebarNotes ? "lg:flex lg:items-start lg:gap-6" : "",
          )}
        >
          {sidebarNotes ? (
            <div className="mt-10 lg:mt-4 lg:w-72 lg:shrink-0 lg:self-start lg:sticky lg:top-4">
              <SideMenu notes={sidebarNotes} pathname={pathname} />
            </div>
          ) : null}
          <main className="mt-10 w-full min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
};

const renderPage = (
  title: string,
  pathname: string,
  content: React.ReactNode,
  sidebarNotes?: ReadonlyArray<Pick<Note, "id" | "title">>,
  searchQuery?: string,
): string =>
  `<!doctype html>${renderToStaticMarkup(
    <HtmlPage
      title={title}
      pathname={pathname}
      {...(sidebarNotes ? { sidebarNotes } : {})}
      searchQuery={searchQuery ?? ""}
    >
      {content}
    </HtmlPage>,
  )}`;

const app = new Elysia();

const stylesPath = new URL("./styles/tailwind.css", import.meta.url);
const isDev = process.env["NODE_ENV"] !== "production";
let cachedStyles: string | null = null;

const htmlResponse = (html: string, status = 200): Response =>
  new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });

app.get("/styles.css", async () => {
  if (isDev) {
    const styles = await Bun.file(stylesPath).text();
    return new Response(styles, {
      headers: {
        "content-type": "text/css",
      },
    });
  }
  if (!cachedStyles) {
    cachedStyles = await Bun.file(stylesPath).text();
  }
  return new Response(cachedStyles, {
    headers: {
      "content-type": "text/css",
    },
  });
});

app.get(
  "/",
  () =>
    new Response(null, {
      status: 302,
      headers: {
        location: "/notes",
      },
    }),
);

app.get("/notes", async ({ request }) => {
  const url = new URL(request.url);
  const notes = await getNotes();
  const queryParam = url.searchParams.get("q") ?? "";
  const query = resolveQuery(queryParam);
  const filtered = query ? notes.filter((note) => note.title.toLowerCase().includes(query)) : notes;

  return htmlResponse(
    renderPage(
      "ノート一覧",
      url.pathname,
      <section className="space-y-4 text-pretty">
        <p className="text-sm text-slate-500">
          {filtered.length} 件 / {notes.length} 件
        </p>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-600">一致するノートがありません。</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <span className="flex size-11 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                <IoDocumentTextOutline size={22} />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">ノートが選択されていません。</p>
                <p className="text-sm text-slate-500">左の Notes から選択してください。</p>
              </div>
              <a
                className="w-fit text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                href="#notes-menu-title"
              >
                ノート一覧へ
              </a>
            </div>
            <p>
              <a className="text-sm font-semibold text-slate-900 underline" href="/graph">
                グラフを見る
              </a>
            </p>
          </div>
        )}
      </section>,
      filtered,
      queryParam,
    ),
  );
});

app.get("/notes/:id", async ({ request, params }) => {
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

app.get("/graph", async ({ request }) => {
  const url = new URL(request.url);
  const notes = await getNotes();
  const graph = buildNoteGraph(notes);
  return htmlResponse(
    renderPage(
      "ノートグラフ",
      url.pathname,
      <section className="space-y-6 text-pretty">
        <h1 className="text-balance text-2xl font-semibold text-slate-900">ノートグラフ</h1>
        {graph.nodes.length === 0 ? (
          <p className="text-sm text-slate-600">ノートがありません。</p>
        ) : (
          <div className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="text-balance text-lg font-semibold text-slate-900">Nodes</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                {graph.nodes.map((node) => (
                  <li key={node.id}>{node.title}</li>
                ))}
              </ul>
            </section>
            <section className="space-y-3">
              <h2 className="text-balance text-lg font-semibold text-slate-900">Links</h2>
              <ul className="space-y-2 text-sm text-slate-700">
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

app.get("/settings", async ({ request }) => {
  const url = new URL(request.url);
  const section = resolveSettingsSection(url.searchParams.get("section"));
  const config = await getConfig();

  return htmlResponse(
    renderPage(
      "設定",
      url.pathname,
      <SettingsForm config={config} values={configToFormValues(config)} activeSection={section} />,
    ),
  );
});

app.post("/settings", async ({ request }) => {
  const url = new URL(request.url);
  const currentConfig = await getConfig();
  const formData = await request.formData();
  const rawSection = formData.get("section");
  const section = resolveSettingsSection(
    url.searchParams.get("section") ?? (typeof rawSection === "string" ? rawSection : null),
  );
  const values = extractSettingsFormValues(formData);
  const errors = validateSettingsFormValues(values);

  if (hasFieldErrors(errors)) {
    return htmlResponse(
      renderPage(
        "設定",
        url.pathname,
        <SettingsForm
          config={currentConfig}
          values={values}
          activeSection={section}
          errors={errors}
          message={{ type: "error", text: "入力内容を確認してください。" }}
        />,
      ),
      400,
    );
  }

  try {
    const updated = await updateConfig({
      notesDir: values.notesDir,
      zettelkasten: {
        directories: {
          fleeting: values.fleeting,
          literature: values.literature,
          permanent: values.permanent,
          structure: values.structure,
          index: values.index,
        },
      },
    });

    return htmlResponse(
      renderPage(
        "設定",
        url.pathname,
        <SettingsForm
          config={updated}
          values={configToFormValues(updated)}
          activeSection={section}
          message={{ type: "success", text: "設定を保存しました。" }}
        />,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "設定の保存に失敗しました。";
    return htmlResponse(
      renderPage(
        "設定",
        url.pathname,
        <SettingsForm
          config={currentConfig}
          values={values}
          activeSection={section}
          message={{ type: "error", text: message }}
        />,
      ),
      400,
    );
  }
});

export { app };
