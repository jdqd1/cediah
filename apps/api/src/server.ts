import { buildApp } from "./app.js";
import { registerPublishedContentSearchRoute } from "./content-search.js";
import { readEnvironment } from "./config.js";
import { createPostgresDatabase, createPostgresPool } from "./db/database.js";
import { registerEditorTopicDeleteRoute } from "./editor-topic-delete.js";

const environment = readEnvironment();
const app = await buildApp(environment);
const auxiliaryPool = environment.databaseUrl
  ? createPostgresPool({ connectionString: environment.databaseUrl, max: 2 })
  : undefined;
const auxiliaryDatabase = auxiliaryPool ? createPostgresDatabase(auxiliaryPool) : undefined;

registerPublishedContentSearchRoute(app, auxiliaryDatabase);
registerEditorTopicDeleteRoute(app, auxiliaryDatabase);
if (auxiliaryDatabase) {
  app.addHook("onClose", async () => {
    await auxiliaryDatabase.destroy();
  });
}

try {
  await app.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
  app.log.error({ err: error }, "API failed to start");
  process.exitCode = 1;
}
