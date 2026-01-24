import { z } from "zod";

export const apiBaseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "http://localhost:8787";

/**
 * Fetch JSON from the API and validate it with a Zod schema.
 */
export const fetchJson = async <TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
): Promise<z.output<TSchema>> => {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${body}`);
  }
  const data: unknown = await response.json();
  return schema.parse(data);
};
