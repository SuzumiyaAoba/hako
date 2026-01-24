export const apiBaseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "http://localhost:8787";

export const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${body}`);
  }
  return response.json() as Promise<T>;
};
