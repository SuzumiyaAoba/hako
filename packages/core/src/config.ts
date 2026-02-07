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

/**
 * Schema for a non-empty note directory segment.
 */
const NoteDirectorySchema = pipe(string(), minLength(1));

/**
 * Schema for zettelkasten role to directory mapping.
 */
const ZettelkastenDirectoryMappingSchema = object({
  fleeting: NoteDirectorySchema,
  literature: NoteDirectorySchema,
  permanent: NoteDirectorySchema,
  structure: NoteDirectorySchema,
  index: NoteDirectorySchema,
});

/**
 * Raw user config schema.
 */
const RawHakoConfigSchema = object({
  notesDir: optional(NoteDirectorySchema),
  zettelkasten: optional(
    object({
      directories: optional(ZettelkastenDirectoryMappingSchema),
    }),
  ),
});

/**
 * Parsed user config before normalization.
 */
type RawHakoConfig = InferOutput<typeof RawHakoConfigSchema>;

/**
 * Default note root directory.
 */
const DEFAULT_NOTES_DIR = "~/hako";

/**
 * Default role-directory mapping for zettelkasten buckets.
 */
export const DEFAULT_ZETTELKASTEN_DIRECTORIES = {
  fleeting: "fleeting",
  literature: "literature",
  permanent: "permanent",
  structure: "structure",
  index: "index",
} as const;

/**
 * Valid zettelkasten role names.
 */
export type ZettelkastenRole = keyof typeof DEFAULT_ZETTELKASTEN_DIRECTORIES;

/**
 * Directory mapping keyed by zettelkasten role.
 */
export type ZettelkastenDirectoryMapping = Record<ZettelkastenRole, string>;

/**
 * Fully resolved runtime configuration.
 */
export type HakoConfig = {
  sourcePath: string | null;
  notesDir: string;
  zettelkasten: {
    directories: ZettelkastenDirectoryMapping;
  };
  noteDirectories: Record<ZettelkastenRole, string>;
};

/**
 * Options for loading configuration.
 */
export type LoadHakoConfigOptions = {
  configPath?: string;
};

/**
 * Options for cached configuration loading.
 */
export type LoadHakoConfigCachedOptions = LoadHakoConfigOptions & {
  reload?: boolean;
};

/**
 * Selected config source kind for path resolution and cache keying.
 */
type ConfigSourceKind = "path" | "env" | "default";

/**
 * Resolved config source context.
 */
type ResolvedConfigSource = {
  kind: ConfigSourceKind;
  path: string | null;
};

/**
 * In-process cache keyed by resolved config source.
 */
const configCache = new Map<string, Promise<HakoConfig>>();

/**
 * Expands `~` to user home.
 */
const resolveUserPath = (value: string): string => {
  if (value.startsWith("~/")) {
    return join(homedir(), value.slice(2));
  }
  if (value === "~") {
    return homedir();
  }
  return value;
};

/**
 * Resolves relative paths against current working directory.
 */
const resolveAbsolutePath = (value: string): string =>
  isAbsolute(value) ? value : resolve(process.cwd(), value);

/**
 * Trims and resolves an absolute path with home expansion.
 */
const toResolvedAbsolutePath = (value: string): string =>
  resolveAbsolutePath(resolveUserPath(value.trim()));

/**
 * Ensures all mapped directory names are unique.
 */
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

/**
 * Returns default config path based on XDG base directory spec.
 */
const resolveDefaultConfigPath = (): string => {
  const xdgPaths = xdgAppPaths({ name: "hako", isolated: true });
  return join(xdgPaths.config(), "config.yaml");
};

/**
 * Resolves selected config source by priority.
 */
const resolveConfigSource = (options: LoadHakoConfigOptions = {}): ResolvedConfigSource => {
  const directPath = options.configPath?.trim();
  if (directPath) {
    return { kind: "path", path: toResolvedAbsolutePath(directPath) };
  }

  const envPath = process.env["HAKO_CONFIG_PATH"]?.trim();
  if (envPath) {
    return { kind: "env", path: toResolvedAbsolutePath(envPath) };
  }

  return { kind: "default", path: null };
};

/**
 * Builds ordered candidate config paths.
 */
const resolveCandidatePaths = (options: LoadHakoConfigOptions = {}): string[] => {
  const source = resolveConfigSource(options);
  if (source.path) {
    return [source.path];
  }

  const defaultYamlPath = resolveDefaultConfigPath();
  const defaultBasePath = defaultYamlPath.replace(/\.ya?ml$/i, "");

  return [defaultYamlPath, `${defaultBasePath}.yml`, `${defaultBasePath}.json`];
};

/**
 * Builds cache key for given loading options.
 */
const resolveCacheKey = (options: LoadHakoConfigOptions = {}): string => {
  const source = resolveConfigSource(options);
  if (source.kind === "path" && source.path) {
    return `path:${source.path}`;
  }

  if (source.kind === "env" && source.path) {
    return `env:${source.path}`;
  }

  return "default";
};

/**
 * Checks whether the path exists.
 */
const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Picks the first existing config path from candidates.
 */
const pickConfigPath = async (candidates: string[]): Promise<string | null> => {
  for (const path of candidates) {
    if (await pathExists(path)) {
      return path;
    }
  }
  return null;
};

/**
 * Parses config text from YAML or JSON based on extension.
 */
const parseConfigText = (path: string, source: string): unknown => {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") {
    return JSON.parse(source);
  }

  if (extension === ".yaml" || extension === ".yml" || extension === "") {
    return parseYaml(source);
  }

  throw new Error(`Unsupported config file extension "${extension}" at ${path}`);
};

/**
 * Parses and validates raw config object from text.
 */
const parseRawConfig = (path: string, source: string): RawHakoConfig => {
  const parsed = parseConfigText(path, source);
  return parse(RawHakoConfigSchema, parsed);
};

/**
 * Builds default runtime config without file source.
 */
const buildDefaultConfig = (): HakoConfig => {
  const empty = parse(RawHakoConfigSchema, {});
  return buildConfig(empty, null);
};

/**
 * Loads and validates config from a file path.
 */
const loadConfigFromPath = async (path: string): Promise<HakoConfig> => {
  const source = await readFile(path, "utf-8");
  const validated = parseRawConfig(path, source);
  return buildConfig(validated, path);
};

/**
 * Normalizes validated config into runtime format.
 */
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

/**
 * Loads config from disk and validates it.
 */
export const loadHakoConfig = async (options: LoadHakoConfigOptions = {}): Promise<HakoConfig> => {
  const candidatePaths = resolveCandidatePaths(options);
  const resolvedPath = await pickConfigPath(candidatePaths);

  if (!resolvedPath) {
    return buildDefaultConfig();
  }

  try {
    return await loadConfigFromPath(resolvedPath);
  } catch (error) {
    if (error instanceof ValiError) {
      throw new Error(`Invalid config at ${resolvedPath}: ${error.message}`);
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config at ${resolvedPath}: ${message}`);
  }
};

/**
 * Clears all cache entries or one specific entry.
 */
export const clearHakoConfigCache = (options?: LoadHakoConfigOptions): void => {
  if (!options) {
    configCache.clear();
    return;
  }

  const key = resolveCacheKey(options);
  configCache.delete(key);
};

/**
 * Loads config with in-process cache support.
 */
export const loadHakoConfigCached = async (
  options: LoadHakoConfigCachedOptions = {},
): Promise<HakoConfig> => {
  const { reload = false, ...loadOptions } = options;
  const key = resolveCacheKey(loadOptions);

  if (reload) {
    configCache.delete(key);
  }

  let pending = configCache.get(key);
  if (!pending) {
    pending = loadHakoConfig(loadOptions);
    configCache.set(key, pending);
    pending.catch(() => {
      if (configCache.get(key) === pending) {
        configCache.delete(key);
      }
    });
  }

  return await pending;
};

/**
 * Forces config reload by bypassing cache.
 */
export const reloadHakoConfig = async (options: LoadHakoConfigOptions = {}): Promise<HakoConfig> =>
  await loadHakoConfigCached({ ...options, reload: true });
