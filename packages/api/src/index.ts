import { Hono } from "hono";
import { serve } from "@hono/node-server";

import { db } from "./db";
import { getNoteById, listNotes } from "./db/queries";

const app = new Hono();

app.get("/", (c) => c.text("Hako API"));
app.get("/notes", (c) => c.json(listNotes(db)));
app.get("/notes/:id", (c) => {
  const id = c.req.param("id");
  const note = getNoteById(db, id);

  if (!note) {
    return c.json({ message: "Note not found" }, 404);
  }

  return c.json(note);
});

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
