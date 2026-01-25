import Link from "next/link";

import { getNotes } from "@/entities/note/api/notes";
import { GraphView } from "@/features/graph/ui/GraphView";
import { buildNoteGraph } from "@/shared/lib/graph";

export default async function GraphPage(): Promise<JSX.Element> {
  const notes = await getNotes();
  const graph = buildNoteGraph(notes);

  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <p>
        <Link href="/notes">← 一覧へ戻る</Link>
      </p>
      <h1>ノートグラフ</h1>
      {graph.nodes.length === 0 ? (
        <p>ノートがありません。</p>
      ) : (
        <GraphView nodes={graph.nodes} links={graph.links} />
      )}
    </main>
  );
}
