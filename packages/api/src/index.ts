import { createRequire } from "node:module";

import { Elysia } from "elysia";

import { db, dbReady } from "./db";
import { createOpenApiDocument } from "./openapi";
import { createNotesRoutes } from "./routes/notes";

const require = createRequire(import.meta.url);
const nodeAdapter = require("@elysiajs/node") as { node: () => unknown };

const app = new Elysia({ adapter: nodeAdapter.node() as any })
  .get("/", () => "Hako API")
  .use(createNotesRoutes(db))
  .get("/openapi.json", () => createOpenApiDocument());

const port = Number(process.env["PORT"] ?? 8787);

await dbReady;
app.listen(port);
console.log(`Hako API listening on http://localhost:${port}`);

export default app;
