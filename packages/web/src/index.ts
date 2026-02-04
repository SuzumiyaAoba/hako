import { serve } from "bun";
import { app } from "./app";

const port = Number(process.env["PORT"] ?? 3000);

serve({
  port,
  fetch: app.fetch,
});

console.log(`@hako/web listening on http://localhost:${port}`);
