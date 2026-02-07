import { IoSettingsOutline } from "react-icons/io5";
import { renderToStaticMarkup } from "react-dom/server";

import type { Note } from "@hako/core";
import { cn } from "../lib/utils";

/**
 * Notes list in the sidebar.
 */
const NotesListMenu = ({
  notes,
  pathname,
}: {
  notes: ReadonlyArray<Pick<Note, "id" | "title">>;
  pathname: string;
}): JSX.Element => (
  <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
    <h2 id="notes-menu-title" className="text-xs font-semibold uppercase text-slate-500">
      Notes
    </h2>
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
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
  </div>
);

const SidebarSettingsLink = ({ pathname }: { pathname: string }): JSX.Element => (
  <a
    className={cn(
      "sidebar-setting-link inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      pathname.startsWith("/settings") && "bg-slate-100 font-semibold text-slate-900",
    )}
    href="/settings/directories"
    aria-label="設定"
    aria-current={pathname.startsWith("/settings") ? "page" : undefined}
  >
    <IoSettingsOutline size={16} aria-hidden="true" />
    <span className="sidebar-label">設定</span>
  </a>
);

/**
 * Full HTML page wrapper.
 */
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
}): JSX.Element => {
  const isSettingsPage = pathname.startsWith("/settings");

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
        <style>{`
          .app-layout {
            min-height: 100dvh;
          }
          .app-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 20;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background-color: rgb(241 245 249);
            border-right: 1px solid rgb(226 232 240);
            width: 17rem;
            min-width: 17rem;
            max-width: 17rem;
            transition: width 180ms ease-out;
          }
          .app-main {
            margin-left: 17rem;
            transition: margin-left 180ms ease-out;
          }
          .app-sidebar-content {
            display: flex;
            flex: 1;
            min-height: 0;
            flex-direction: column;
            padding: 0;
            overflow-x: hidden;
            overflow-y: auto;
          }
          .app-layout #sidebar-toggle:not(:checked) ~ .app-sidebar {
            width: 3.5rem;
            min-width: 3.5rem;
            max-width: 3.5rem;
          }
          .app-layout #sidebar-toggle:not(:checked) ~ .app-sidebar .sidebar-notes {
            display: none;
          }
          .app-layout #sidebar-toggle:not(:checked) ~ .app-sidebar .sidebar-label {
            display: none;
          }
          .app-layout #sidebar-toggle:not(:checked) ~ .app-sidebar .sidebar-graph-link {
            justify-content: center;
            padding-left: 0;
            padding-right: 0;
          }
          .app-layout #sidebar-toggle:not(:checked) ~ .app-sidebar .sidebar-setting-link {
            justify-content: center;
            padding-left: 0;
            padding-right: 0;
          }
          .sidebar-notes {
            flex: 1;
            min-height: 0;
            overflow-x: hidden;
            overflow-y: auto;
            padding: 0 0.75rem;
          }
          .sidebar-notes > nav {
            height: auto;
          }
          .sidebar-footer {
            margin-top: auto;
            border-top: 1px solid rgb(226 232 240);
            padding: 0.75rem 0.75rem 0.75rem;
          }
          .app-layout #sidebar-toggle:not(:checked) ~ .app-main {
            margin-left: 3.5rem;
          }
        `}</style>
      </head>
      <body className="bg-slate-100 text-slate-900 antialiased">
        <div className="app-layout">
          <input id="sidebar-toggle" className="sr-only" type="checkbox" defaultChecked />
          <aside className="app-sidebar">
            <div className="flex h-12 items-center justify-end px-3 text-xs font-semibold uppercase text-slate-500">
              <label
                htmlFor="sidebar-toggle"
                className="cursor-pointer rounded px-2 py-1 hover:bg-slate-200/60"
                aria-label="Toggle sidebar"
              >
                ≡
              </label>
            </div>
            <div className="app-sidebar-content">
              {sidebarNotes ? (
                <div className="sidebar-notes">
                  <NotesListMenu notes={sidebarNotes} pathname={pathname} />
                </div>
              ) : null}
              <div className="sidebar-footer">
                <SidebarSettingsLink pathname={pathname} />
              </div>
            </div>
          </aside>
          <main className="app-main min-h-dvh bg-white px-4 py-5 sm:px-6 lg:px-10">
            {isSettingsPage ? (
              <div className="w-full">{children}</div>
            ) : (
              <div className="bg-white px-6 py-8 sm:px-8">{children}</div>
            )}
          </main>
        </div>
      </body>
    </html>
  );
};

/**
 * Renders full HTML document.
 */
export const renderPage = (
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

/**
 * Creates HTML response.
 */
export const htmlResponse = (html: string, status = 200): Response =>
  new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
