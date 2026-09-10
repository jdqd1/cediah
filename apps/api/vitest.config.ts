import { defineConfig } from "vitest/config";

// PGlite integration suites each own a PostgreSQL WASM instance. Bound the
// worker count so their initialization does not starve Fastify route tests.
export default defineConfig({ test: { maxWorkers: 2 } });
