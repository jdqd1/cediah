import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { registerPublishedContentSearchRoute } from "./content-search.js";
import type { DatabaseClient } from "./db/database.js";
import { registerInteractiveTermAdminRoutes } from "./interactive-terms/admin-routes.js";
import { registerInteractiveTermSuggestionRoutes } from "./interactive-terms/admin-suggestions.js";
import { startInteractiveTermIndexer } from "./interactive-terms/indexer.js";
import { registerInteractiveTermRoutes } from "./interactive-terms/routes.js";
import { registerPublishedStudyCatalogRoutes } from "./study-catalog.js";

/**
 * Registers routes that depend on the small auxiliary database pool created by
 * the production server. Keeping this composition in one testable function
 * prevents server-only route collisions from bypassing the buildApp test suite.
 */
export function registerProductionAuxiliaryRoutes(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  registerPublishedContentSearchRoute(app, database);
  registerPublishedStudyCatalogRoutes(app, database);
  registerInteractiveTermRoutes(app, database);
  registerInteractiveTermAdminRoutes(app, database);
  registerInteractiveTermSuggestionRoutes(app, database);

  if (database) {
    let stopIndexer: (() => void) | undefined;
    app.addHook("onClose", async () => stopIndexer?.());

    void (async () => {
      try {
        const schema = await sql<{ queue_exists: boolean }>`
          select to_regclass('public.guide_term_reindex_queue') is not null as queue_exists
        `.execute(database);
        if (!schema.rows[0]?.queue_exists) {
          app.log.error("Interactive term indexer disabled: database migrations are not ready");
          return;
        }
        stopIndexer = startInteractiveTermIndexer(database);
      } catch (error) {
        app.log.error({ err: error }, "Interactive term indexer failed to initialize");
      }
    })();
  }
}
