import React from "react";
import { IoFileTrayFullOutline, IoSettingsOutline } from "react-icons/io5";
import { renderToStaticMarkup } from "react-dom/server";

import type { Note } from "@hako/core";
import { cn } from "../lib/utils";

/**
 * Header component.
 */
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
          href="/settings/directories"
          aria-label="Settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        >
          <IoSettingsOutline size={16} aria-hidden="true" />
        </a>
      </nav>
    </div>
  </header>
);

/**
 * Notes sidebar menu.
 */
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

/**
 * Full HTML page wrapper.
 */
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
          <main
            className={cn(
              "mt-10 w-full min-w-0 flex-1",
              isSettingsPage
                ? "px-0 py-0 sm:px-0"
                : "rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8",
            )}
          >
            {children}
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
