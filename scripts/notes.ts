import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

import { loadHakoConfig } from "@hako/core/config";

const DEFAULT_API_BASE_URL = "http://localhost:8787";
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);

/**
 * Represents a note import payload entry.
 */
type NoteImport = {
  path: string;
  title: string;
};

/**
 * Extracts the title from YAML frontmatter if present.
 */
const extractFrontmatterTitle = (content: string): string | null => {
  if (!content.startsWith("---")) {
    return null;
  }

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) {
    return null;
  }

  const frontmatter = content.slice(3, endIndex).trim();
  const match = frontmatter.match(/^\s*title\s*:\s*(.+)\s*$/m);
  if (!match) {
    return null;
  }

  const raw = match[1]?.trim() ?? "";
  if (!raw) {
    return null;
  }

  const unquoted = raw.replace(/^['"]|['"]$/g, "");
  return unquoted.trim() || null;
};

/**
 * Derives a title from a file path.
 */
const deriveTitleFromPath = (path: string): string => {
  const filename = basename(path);
  const extension = extname(filename);
  return extension.length > 0 ? filename.slice(0, -extension.length) : filename;
};

/**
 * Collects markdown files under a directory.
 */
const collectMarkdownFiles = async (root: string): Promise<string[]> => {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await collectMarkdownFiles(join(root, entry.name));
      files.push(...nested);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (!MARKDOWN_EXTENSIONS.has(extension)) {
      continue;
    }

    files.push(join(root, entry.name));
  }

  return files;
};

/**
 * Builds note import entries with frontmatter titles.
 */
const buildImports = async (paths: string[]): Promise<NoteImport[]> => {
  const imports: NoteImport[] = [];

  for (const path of paths) {
    const content = await readFile(path, "utf-8");
    const frontmatterTitle = extractFrontmatterTitle(content);
    imports.push({
      path,
      title: frontmatterTitle ?? deriveTitleFromPath(path),
    });
  }

  return imports;
};

/**
 * Splits items into batches.
 */
const chunk = <T>(items: T[], size: number): T[][] => {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

/**
 * Sends import requests in batches.
 */
const importNotes = async (baseUrl: string, imports: NoteImport[]): Promise<void> => {
  const batches = chunk(imports, 200);

  for (const batch of batches) {
    const response = await fetch(`${baseUrl}/notes/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes: batch }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Import failed: ${response.status} ${response.statusText} ${body}`);
    }

    const payload: unknown = await response.json();
    console.log(JSON.stringify(payload, null, 2));
  }
};

/**
 * Sends a reindex request.
 */
const reindexNotes = async (baseUrl: string): Promise<void> => {
  const response = await fetch(`${baseUrl}/notes/reindex`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Reindex failed: ${response.status} ${response.statusText} ${body}`);
  }

  const payload: unknown = await response.json();
  console.log(JSON.stringify(payload, null, 2));
};

/**
 * Entry point.
 */
const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  const [command, targetDir] = normalizedArgs;
  const baseUrl = process.env["HAKO_API_BASE_URL"] ?? DEFAULT_API_BASE_URL;
  const config = await loadHakoConfig();

  if (command === "reindex") {
    await reindexNotes(baseUrl);
    return;
  }

  if (command === "import") {
    const roots =
      targetDir && targetDir.trim().length > 0
        ? [resolve(targetDir)]
        : Array.from(new Set(Object.values(config.noteDirectories))).map((path) => resolve(path));
    const files = (
      await Promise.all(roots.map(async (root) => await collectMarkdownFiles(root)))
    ).flat();

    if (files.length === 0) {
      console.log("No markdown files found.");
      return;
    }

    const imports = await buildImports(files);
    await importNotes(baseUrl, imports);
    return;
  }

  console.error("Usage: bun run notes -- <import|reindex> [dir]");
  process.exit(1);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
