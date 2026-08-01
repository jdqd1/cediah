import { buildApp } from "./app.js";
import { readEnvironment } from "./config.js";

const environment = readEnvironment();
const app = await buildApp(environment);

try {
  await app.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
  app.log.error({ err: error }, "API failed to start");
  process.exitCode = 1;
}
