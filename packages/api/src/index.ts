import { Elysia } from "elysia";

import { db } from "./db";
import { createOpenApiDocument } from "./openapi";
import { createNotesRoutes } from "./routes/notes";

const app = new Elysia()
  .get("/", () => "Hako API")
  .use(createNotesRoutes(db))
  .get("/openapi.json", () => createOpenApiDocument());

const port = Number(process.env["PORT"] ?? 8787);

app.listen(port);
console.log(`Hako API listening on http://localhost:${port}`);

export default app;
