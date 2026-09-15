import { buildApp } from "./app.js";
import { registerPublishedContentSearchRoute } from "./content-search.js";
import { readEnvironment } from "./config.js";
import { createPostgresDatabase, createPostgresPool } from "./db/database.js";

const environment = readEnvironment();
const app = await buildApp(environment);
const searchPool = environment.databaseUrl
  ? createPostgresPool({ connectionString: environment.databaseUrl, max: 2 })
  : undefined;
const searchDatabase = searchPool ? createPostgresDatabase(searchPool) : undefined;

registerPublishedContentSearchRoute(app, searchDatabase);
if (searchDatabase) {
  app.addHook("onClose", async () => {
    await searchDatabase.destroy();
  });
}

try {
  await app.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
  app.log.error({ err: error }, "API failed to start");
  process.exitCode = 1;
}
