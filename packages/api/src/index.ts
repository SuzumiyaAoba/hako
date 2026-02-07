import { node } from "@elysiajs/node";
import { loadHakoConfigCached } from "@hako/core/config";
import { Elysia } from "elysia";

import { db, dbReady } from "./db";
import { createOpenApiDocument } from "./openapi";
import { createNotesRoutes } from "./routes/notes";

/**
 * Default API listening port.
 */
const DEFAULT_PORT = 8787;

/**
 * Loaded application configuration.
 * @todo Wire appConfig.notesDir/noteDirectories into note discovery and import flows.
 */
const appConfig = await loadHakoConfigCached();

/**
 * API application instance.
 */
const app = new Elysia({ adapter: node() })
  .get("/", () => "Hako API")
  .use(createNotesRoutes(db))
  .get("/openapi.json", () => createOpenApiDocument());

/**
 * Resolves validated API listening port.
 */
const resolveListenPort = (): number => {
  const rawPort = process.env["PORT"]?.trim();
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(rawPort, 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  console.warn(`Invalid PORT value "${rawPort}", falling back to ${DEFAULT_PORT}`);
  return DEFAULT_PORT;
};

/**
 * Listening port for API server.
 */
const port = resolveListenPort();

await dbReady;
app.listen(port);
console.log(`Hako API listening on http://localhost:${port}`);
if (appConfig.sourcePath) {
  console.log(`Hako config loaded from ${appConfig.sourcePath}`);
} else {
  console.log("Hako config loaded with defaults");
}

export { appConfig };
export default app;
