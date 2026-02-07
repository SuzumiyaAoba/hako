import { Elysia } from "elysia";

import { getNotes } from "../../entities/note/api/notes";
import { buildNoteGraph } from "../../shared/lib/graph";
import { htmlResponse, renderPage } from "../layout";

/**
 * Escapes text for safe HTML interpolation.
 */
const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Graph page routes.
 */
export const createGraphPageRoutes = () =>
  new Elysia().get("/graph", async ({ request }) => {
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
