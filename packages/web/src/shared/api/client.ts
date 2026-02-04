import { parse, type GenericSchema, type InferOutput } from "valibot";

const resolveApiBaseUrl = (): string => {
  const primary = process.env["HAKO_API_BASE_URL"]?.trim();
  if (primary) {
    return primary;
  }
  const secondary = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (secondary) {
    return secondary;
  }
  return "http://localhost:8787";
};

export const apiBaseUrl = resolveApiBaseUrl();

/**
 * Fetch JSON from the API and validate it with a Valibot schema.
 */
export const fetchJson = async <TSchema extends GenericSchema>(
  path: string,
  schema: TSchema,
): Promise<InferOutput<TSchema>> => {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${body}`);
  }
  const data: unknown = await response.json();
  return parse(schema, data);
};
