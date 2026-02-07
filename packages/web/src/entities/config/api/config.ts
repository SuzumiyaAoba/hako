import { parse } from "valibot";

import { apiBaseUrl, fetchJson } from "../../../shared/api/client";
import { ConfigSchema, ConfigUpdateSchema, type Config, type ConfigUpdate } from "../model/types";

/**
 * Fetch current config.
 */
export const getConfig = async (): Promise<Config> => await fetchJson("/config", ConfigSchema);

/**
 * Update current config.
 */
export const updateConfig = async (payload: ConfigUpdate): Promise<Config> => {
  const body = parse(ConfigUpdateSchema, payload);
  const response = await fetch(`${apiBaseUrl}/config`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${message}`);
  }

  const data: unknown = await response.json();
  return parse(ConfigSchema, data);
};
