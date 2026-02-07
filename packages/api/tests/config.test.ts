import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearHakoConfigCache,
  loadHakoConfig,
  loadHakoConfigCached,
  reloadHakoConfig,
} from "@hako/core/config";

describe("hako config", () => {
  beforeEach(() => {
    clearHakoConfigCache();
  });

  it("loads defaults when config file does not exist", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "hako-config-default-"));
    const originalXdg = process.env["XDG_CONFIG_HOME"];

    try {
      process.env["XDG_CONFIG_HOME"] = configRoot;

      const config = await loadHakoConfig();

      expect(config.sourcePath).toBeNull();
      expect(config.notesDir.endsWith("zettelkasten")).toBe(true);
      expect(config.zettelkasten.directories).toEqual({
        fleeting: "fleeting",
        literature: "literature",
        permanent: "permanent",
        structure: "structure",
        index: "index",
      });
    } finally {
      if (originalXdg === undefined) {
        delete process.env["XDG_CONFIG_HOME"];
      } else {
        process.env["XDG_CONFIG_HOME"] = originalXdg;
      }
    }
  });

  it("loads and validates custom mapping", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "hako-config-custom-"));
    const configDir = join(configRoot, "hako");
    const configPath = join(configDir, "config.yaml");

    await mkdir(configDir, { recursive: true });
    await writeFile(
      configPath,
      [
        "notesDir: ~/vault",
        "zettelkasten:",
        "  directories:",
        "    fleeting: quick",
        "    literature: lit",
        "    permanent: evergreen",
        "    structure: maps",
        "    index: hub",
      ].join("\n"),
      "utf-8",
    );

    const config = await loadHakoConfig({ configPath });

    expect(config.sourcePath).toBe(configPath);
    expect(config.noteDirectories.fleeting.endsWith("vault/quick")).toBe(true);
    expect(config.noteDirectories.index.endsWith("vault/hub")).toBe(true);
  });

  it("throws when directory mapping has duplicated values", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "hako-config-invalid-"));
    const configPath = join(configRoot, "config.yaml");

    await writeFile(
      configPath,
      [
        "notesDir: ./notes",
        "zettelkasten:",
        "  directories:",
        "    fleeting: z",
        "    literature: z",
        "    permanent: p",
        "    structure: s",
        "    index: i",
      ].join("\n"),
      "utf-8",
    );

    await expect(loadHakoConfig({ configPath })).rejects.toThrow("duplicated value");
  });

  it("returns cached config and supports reload", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "hako-config-cache-"));
    const configPath = join(configRoot, "config.yaml");

    await writeFile(configPath, "notesDir: ./first\n", "utf-8");

    const first = await loadHakoConfigCached({ configPath });
    expect(first.notesDir.endsWith("/first")).toBe(true);

    await writeFile(configPath, "notesDir: ./second\n", "utf-8");

    const cached = await loadHakoConfigCached({ configPath });
    expect(cached.notesDir.endsWith("/first")).toBe(true);

    const reloaded = await reloadHakoConfig({ configPath });
    expect(reloaded.notesDir.endsWith("/second")).toBe(true);
  });
});
