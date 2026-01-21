import { Hono } from "hono";
import { serve } from "@hono/node-server";

import { db } from "./db";
import { listNotes } from "./db/queries";

const app = new Hono();

app.get("/", (c) => c.text("Hako API"));
app.get("/notes", (c) => c.json(listNotes(db)));

const port = Number(process.env["PORT"] ?? 8787);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Hako API listening on http://localhost:${info.port}`);
  },
);

export default app;
