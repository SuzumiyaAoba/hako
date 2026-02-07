import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, isAbsolute, join, resolve } from "node:path";

import xdgAppPaths from "xdg-app-paths";
import {
  ValiError,
  minLength,
  object,
  optional,
  parse,
  pipe,
  string,
  type InferOutput,
} from "valibot";
import { parse as parseYaml } from "yaml";

const NoteDirectorySchema = pipe(string(), minLength(1));

const ZettelkastenDirectoryMappingSchema = object({
  fleeting: NoteDirectorySchema,
  literature: NoteDirectorySchema,
  permanent: NoteDirectorySchema,
  structure: NoteDirectorySchema,
  index: NoteDirectorySchema,
});

const RawHakoConfigSchema = object({
  notesDir: optional(NoteDirectorySchema),
  zettelkasten: optional(
    object({
      directories: optional(ZettelkastenDirectoryMappingSchema),
    }),
  ),
});

type RawHakoConfig = InferOutput<typeof RawHakoConfigSchema>;

const DEFAULT_NOTES_DIR = "~/zettelkasten";

export const DEFAULT_ZETTELKASTEN_DIRECTORIES = {
  fleeting: "fleeting",
  literature: "literature",
  permanent: "permanent",
  structure: "structure",
  index: "index",
} as const;

export type ZettelkastenRole = keyof typeof DEFAULT_ZETTELKASTEN_DIRECTORIES;

export type ZettelkastenDirectoryMapping = Record<ZettelkastenRole, string>;

export type HakoConfig = {
  sourcePath: string | null;
  notesDir: string;
  zettelkasten: {
    directories: ZettelkastenDirectoryMapping;
  };
  noteDirectories: Record<ZettelkastenRole, string>;
};

export type LoadHakoConfigOptions = {
  configPath?: string;
};

const resolveUserPath = (value: string): string => {
  if (value.startsWith("~/")) {
    return join(homedir(), value.slice(2));
  }
  if (value === "~") {
    return homedir();
  }
  return value;
};

const resolveAbsolutePath = (value: string): string =>
  isAbsolute(value) ? value : resolve(process.cwd(), value);

const toResolvedAbsolutePath = (value: string): string =>
  resolveAbsolutePath(resolveUserPath(value.trim()));

const ensureUniqueDirectoryNames = (mapping: ZettelkastenDirectoryMapping): void => {
  const seen = new Set<string>();

  for (const [role, directory] of Object.entries(mapping) as Array<[ZettelkastenRole, string]>) {
    const normalized = directory.trim();
    if (seen.has(normalized)) {
      throw new Error(
        `zettelkasten.directories contains duplicated value "${normalized}" (role: ${role})`,
      );
    }
    seen.add(normalized);
  }
};

const resolveDefaultConfigPath = (): string => {
  const xdgPaths = xdgAppPaths({ name: "hako", isolated: true });
  return join(xdgPaths.config(), "config.yaml");
};

const resolveCandidatePaths = (configPath?: string): string[] => {
  if (configPath && configPath.trim().length > 0) {
    return [toResolvedAbsolutePath(configPath)];
  }

  const explicitPath = process.env["HAKO_CONFIG_PATH"]?.trim();
  if (explicitPath) {
    return [toResolvedAbsolutePath(explicitPath)];
  }

  const defaultYamlPath = resolveDefaultConfigPath();
  const defaultBasePath = defaultYamlPath.replace(/\.ya?ml$/i, "");

  return [defaultYamlPath, `${defaultBasePath}.yml`, `${defaultBasePath}.json`];
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const pickConfigPath = async (candidates: string[]): Promise<string | null> => {
  for (const path of candidates) {
    if (await pathExists(path)) {
      return path;
    }
  }
  return null;
};

const parseConfigText = (path: string, source: string): unknown => {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") {
    return JSON.parse(source);
  }

  return parseYaml(source);
};

const buildConfig = (raw: RawHakoConfig, sourcePath: string | null): HakoConfig => {
  const directories: ZettelkastenDirectoryMapping = {
    ...DEFAULT_ZETTELKASTEN_DIRECTORIES,
    ...(raw.zettelkasten?.directories ?? {}),
  };

  ensureUniqueDirectoryNames(directories);

  const notesDir = toResolvedAbsolutePath(raw.notesDir ?? DEFAULT_NOTES_DIR);

  return {
    sourcePath,
    notesDir,
    zettelkasten: {
      directories,
    },
    noteDirectories: {
      fleeting: join(notesDir, directories.fleeting),
      literature: join(notesDir, directories.literature),
      permanent: join(notesDir, directories.permanent),
      structure: join(notesDir, directories.structure),
      index: join(notesDir, directories.index),
    },
  };
};

export const loadHakoConfig = async (options: LoadHakoConfigOptions = {}): Promise<HakoConfig> => {
  const candidatePaths = resolveCandidatePaths(options.configPath);
  const resolvedPath = await pickConfigPath(candidatePaths);

  if (!resolvedPath) {
    return buildConfig(parse(RawHakoConfigSchema, {}), null);
  }

  try {
    const source = await readFile(resolvedPath, "utf-8");
    const parsed = parseConfigText(resolvedPath, source);
    const validated = parse(RawHakoConfigSchema, parsed);
    return buildConfig(validated, resolvedPath);
  } catch (error) {
    if (error instanceof ValiError) {
      throw new Error(`Invalid config at ${resolvedPath}: ${error.message}`);
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config at ${resolvedPath}: ${message}`);
  }
};
