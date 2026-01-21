import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/", (c) => c.text("Hako API"));

const port = Number(process.env["PORT"] ?? 8787);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`Hako API listening on http://localhost:${info.port}`);
  }
);

export default app;
