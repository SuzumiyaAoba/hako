import { Elysia } from "elysia";

import { createGraphPageRoutes } from "./pages/graph";
import { createNotesDetailPageRoutes } from "./pages/notes/detail";
import { createNotesListPageRoutes } from "./pages/notes/list";
import { createSettingsDirectoriesPageRoutes } from "./pages/settings/directories";

const app = new Elysia();

const stylesPath = new URL("./styles/tailwind.css", import.meta.url);
const isDev = process.env["NODE_ENV"] !== "production";
let cachedStyles: string | null = null;

app.get("/styles.css", async () => {
  if (isDev) {
    const styles = await Bun.file(stylesPath).text();
    return new Response(styles, {
      headers: {
        "content-type": "text/css",
      },
    });
  }
  if (!cachedStyles) {
    cachedStyles = await Bun.file(stylesPath).text();
  }
  return new Response(cachedStyles, {
    headers: {
      "content-type": "text/css",
    },
  });
});

app.get(
  "/",
  () =>
    new Response(null, {
      status: 302,
      headers: {
        location: "/notes",
      },
    }),
);

app.use(createNotesListPageRoutes());
app.use(createNotesDetailPageRoutes());
app.use(createGraphPageRoutes());
app.use(createSettingsDirectoriesPageRoutes());

export { app };
