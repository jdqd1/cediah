import type { FastifyInstance } from "fastify";
import { registerPublishedContentSearchRoute } from "./content-search.js";
import type { DatabaseClient } from "./db/database.js";
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
}
