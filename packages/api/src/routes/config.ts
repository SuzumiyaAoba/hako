import { Elysia, t } from "elysia";

import {
  getDefaultHakoConfigPath,
  loadHakoConfigCached,
  saveHakoConfig,
  type HakoConfig,
  type ZettelkastenDirectoryMapping,
} from "@hako/core/config";

/**
 * Error response schema.
 */
const ErrorResponseSchema = t.Object({
  message: t.String(),
});

/**
 * Zettelkasten directories schema.
 */
const ZettelkastenDirectoriesSchema = t.Object({
  fleeting: t.String({ minLength: 1 }),
  literature: t.String({ minLength: 1 }),
  permanent: t.String({ minLength: 1 }),
  structure: t.String({ minLength: 1 }),
  index: t.String({ minLength: 1 }),
});

/**
 * Config response schema.
 */
const ConfigResponseSchema = t.Object({
  sourcePath: t.Nullable(t.String()),
  writeTargetPath: t.String(),
  notesDir: t.String(),
  zettelkasten: t.Object({
    directories: ZettelkastenDirectoriesSchema,
  }),
  noteDirectories: ZettelkastenDirectoriesSchema,
});

/**
 * Config update request schema.
 */
const ConfigUpdateBodySchema = t.Object({
  notesDir: t.String({ minLength: 1 }),
  zettelkasten: t.Object({
    directories: ZettelkastenDirectoriesSchema,
  }),
});

/**
 * Builds config response payload.
 */
const buildConfigPayload = (config: HakoConfig): HakoConfig & { writeTargetPath: string } => ({
  ...config,
  writeTargetPath: config.sourcePath ?? getDefaultHakoConfigPath(),
});

/**
 * Trims mapping values before write.
 */
const trimDirectories = (
  directories: ZettelkastenDirectoryMapping,
): ZettelkastenDirectoryMapping => ({
  fleeting: directories.fleeting.trim(),
  literature: directories.literature.trim(),
  permanent: directories.permanent.trim(),
  structure: directories.structure.trim(),
  index: directories.index.trim(),
});

/**
 * Builds config API routes.
 */
export const createConfigRoutes = () =>
  new Elysia()
    .get(
      "/config",
      async () => {
        const config = await loadHakoConfigCached();
        return buildConfigPayload(config);
      },
      {
        response: {
          200: ConfigResponseSchema,
        },
      },
    )
    .put(
      "/config",
      async ({ body, set }) => {
        try {
          const config = await saveHakoConfig({
            notesDir: body.notesDir.trim(),
            zettelkasten: {
              directories: trimDirectories(body.zettelkasten.directories),
            },
          });
          return buildConfigPayload(config);
        } catch (error) {
          set.status = 400;
          const message = error instanceof Error ? error.message : String(error);
          return { message };
        }
      },
      {
        body: ConfigUpdateBodySchema,
        response: {
          200: ConfigResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    );
