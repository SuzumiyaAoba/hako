import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { Elysia } from "elysia";

import { clearHakoConfigCache } from "@hako/core/config";
import { createConfigRoutes } from "../src/routes/config";

describe("config routes", () => {
  it("returns current config from /config", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "hako-config-route-get-"));
    const originalXdg = process.env["XDG_CONFIG_HOME"];

    try {
      process.env["XDG_CONFIG_HOME"] = configRoot;
      clearHakoConfigCache();

      const app = new Elysia();
      app.use(createConfigRoutes());

      const response = await app.handle(new Request("http://localhost/config"));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.sourcePath).toBeNull();
      expect(body.writeTargetPath.endsWith("/hako/config.yaml")).toBe(true);
      expect(body.zettelkasten.directories).toEqual({
        fleeting: "fleeting",
        literature: "literature",
        permanent: "permanent",
        structure: "structure",
        index: "index",
      });
    } finally {
      clearHakoConfigCache();
      if (originalXdg === undefined) {
        delete process.env["XDG_CONFIG_HOME"];
      } else {
        process.env["XDG_CONFIG_HOME"] = originalXdg;
      }
    }
  });

  it("updates config from /config", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "hako-config-route-put-"));
    const originalXdg = process.env["XDG_CONFIG_HOME"];

    try {
      process.env["XDG_CONFIG_HOME"] = configRoot;
      clearHakoConfigCache();

      const app = new Elysia();
      app.use(createConfigRoutes());

      const response = await app.handle(
        new Request("http://localhost/config", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            notesDir: "./vault",
            zettelkasten: {
              directories: {
                fleeting: "quick",
                literature: "lit",
                permanent: "permanent",
                structure: "maps",
                index: "hub",
              },
            },
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.sourcePath).toContain("config.yaml");
      expect(body.notesDir.endsWith("/vault")).toBe(true);
      expect(body.zettelkasten.directories).toEqual({
        fleeting: "quick",
        literature: "lit",
        permanent: "permanent",
        structure: "maps",
        index: "hub",
      });
    } finally {
      clearHakoConfigCache();
      if (originalXdg === undefined) {
        delete process.env["XDG_CONFIG_HOME"];
      } else {
        process.env["XDG_CONFIG_HOME"] = originalXdg;
      }
    }
  });
});
