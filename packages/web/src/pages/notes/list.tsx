import { Elysia } from "elysia";
import { IoDocumentTextOutline } from "react-icons/io5";

import { getNotes } from "../../entities/note/api/notes";
import { htmlResponse, renderPage } from "../layout";

/**
 * Normalizes search query.
 */
const resolveQuery = (raw: string | undefined): string => raw?.trim().toLowerCase() ?? "";

/**
 * Notes list page routes.
 */
export const createNotesListPageRoutes = () =>
  new Elysia().get("/notes", async ({ request }) => {
    const url = new URL(request.url);
    const notes = await getNotes();
    const queryParam = url.searchParams.get("q") ?? "";
    const query = resolveQuery(queryParam);
    const filtered = query
      ? notes.filter((note) => note.title.toLowerCase().includes(query))
      : notes;

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
                  <p className="text-sm font-semibold text-slate-900">
                    ノートが選択されていません。
                  </p>
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
