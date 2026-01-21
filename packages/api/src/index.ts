import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hako API"));

export default app;
