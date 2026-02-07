import { createRequire } from "node:module";

import { loadHakoConfigCached } from "@hako/core/config";
import { Elysia } from "elysia";

import { db, dbReady } from "./db";
import { createOpenApiDocument } from "./openapi";
import { createNotesRoutes } from "./routes/notes";

const require = createRequire(import.meta.url);
const nodeAdapter = require("@elysiajs/node") as { node: () => unknown };
// TODO: Wire appConfig.notesDir/noteDirectories into note discovery and import flows.
const appConfig = await loadHakoConfigCached();

const app = new Elysia({ adapter: nodeAdapter.node() as any })
  .get("/", () => "Hako API")
  .use(createNotesRoutes(db))
  .get("/openapi.json", () => createOpenApiDocument());

const port = Number(process.env["PORT"] ?? 8787);

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
