/**
 * Home page for the web app.
 */
export default function HomePage(): JSX.Element {
  return (
    <main style={{ padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>Hako Web</h1>
      <p>Next.js workspace stub.</p>
      <p>
        <a href="/notes">ノート一覧へ</a>
      </p>
      <p>
        <a href="/graph">グラフを見る</a>
      </p>
    </main>
  );
}
