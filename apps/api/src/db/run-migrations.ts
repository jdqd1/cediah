import { Pool } from "pg";
import { readEnvironment } from "../config.js";
import { applySqlMigrations } from "./migrate.js";

async function run() {
  const environment = readEnvironment();
  if (!environment.databaseUrl || !environment.migrationsPath) {
    throw new Error("DATABASE_URL and a migrations path are required.");
  }

  const pool = new Pool({ connectionString: environment.databaseUrl });
  try {
    const migrations = await applySqlMigrations(pool, environment.migrationsPath);
    for (const migration of migrations) {
      process.stdout.write(`${migration.status}: ${migration.fileName}\n`);
    }
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  process.stderr.write(`Database migration failed: ${message}\n`);
  process.exitCode = 1;
});
