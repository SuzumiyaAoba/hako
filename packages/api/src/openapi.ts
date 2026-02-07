/**
 * Builds a minimal OpenAPI document for current API routes.
 */
export const createOpenApiDocument = () => ({
  openapi: "3.0.0",
  info: {
    title: "Hako API",
    version: "0.0.0",
  },
  paths: {
    "/notes": {
      get: {
        summary: "List notes",
      },
    },
    "/notes/{id}": {
      get: {
        summary: "Get note by id",
      },
    },
    "/notes/import": {
      post: {
        summary: "Import note paths",
      },
    },
    "/notes/reindex": {
      post: {
        summary: "Reindex note links",
      },
    },
    "/config": {
      get: {
        summary: "Get current config",
      },
      put: {
        summary: "Update current config",
      },
    },
  },
});
