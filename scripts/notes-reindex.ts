const DEFAULT_API_BASE_URL = "http://localhost:8787";

/**
 * Sends a reindex request.
 */
const reindexNotes = async (baseUrl: string): Promise<void> => {
  const response = await fetch(`${baseUrl}/notes/reindex`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Reindex failed: ${response.status} ${response.statusText} ${body}`);
  }

  const payload: unknown = await response.json();
  console.log(JSON.stringify(payload, null, 2));
};

/**
 * Entry point.
 */
const main = async (): Promise<void> => {
  const baseUrl = process.env["HAKO_API_BASE_URL"] ?? DEFAULT_API_BASE_URL;
  await reindexNotes(baseUrl);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
