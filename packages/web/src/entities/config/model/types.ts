import { nullable, object, string, type InferOutput } from "valibot";

/**
 * Config directories schema.
 */
export const ConfigDirectoriesSchema = object({
  fleeting: string(),
  literature: string(),
  permanent: string(),
  structure: string(),
  index: string(),
});

/**
 * Config payload schema.
 */
export const ConfigSchema = object({
  sourcePath: nullable(string()),
  writeTargetPath: string(),
  notesDir: string(),
  zettelkasten: object({
    directories: ConfigDirectoriesSchema,
  }),
  noteDirectories: ConfigDirectoriesSchema,
});

/**
 * Config payload type.
 */
export type Config = InferOutput<typeof ConfigSchema>;

/**
 * Config update payload schema.
 */
export const ConfigUpdateSchema = object({
  notesDir: string(),
  zettelkasten: object({
    directories: ConfigDirectoriesSchema,
  }),
});

/**
 * Config update payload type.
 */
export type ConfigUpdate = InferOutput<typeof ConfigUpdateSchema>;
