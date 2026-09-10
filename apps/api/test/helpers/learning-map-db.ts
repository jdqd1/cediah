import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type CompiledQuery,
  type QueryResult,
} from "kysely";
import type { CediahDatabase } from "../../src/db/database.js";

export async function createLearningMapTestDb() {
  const pg = new PGlite();
  let available = Promise.resolve();
  let release: (() => void) | undefined;
  let queryCount = 0;
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      queryCount++;
      const result = await pg.query<R>(query.sql, [...query.parameters]);
      return {
        rows: result.rows,
        numAffectedRows: BigInt(result.affectedRows ?? 0),
      };
    },
    async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
      yield { rows: [] };
    },
  };
  const database = new Kysely<CediahDatabase>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
      createDriver: () => ({
        acquireConnection: async () => {
          const previous = available;
          let unlock!: () => void;
          available = new Promise<void>((resolve) => {
            unlock = resolve;
          });
          await previous;
          release = unlock;
          return connection;
        },
        beginTransaction: async () => {
          await pg.exec("begin");
        },
        commitTransaction: async () => {
          await pg.exec("commit");
        },
        rollbackTransaction: async () => {
          await pg.exec("rollback");
        },
        releaseConnection: async () => {
          release?.();
        },
        init: async () => {},
        destroy: async () => {},
      }),
    },
  });
  await pg.exec(
    "create role cediah_runtime; create role anon; create role authenticated; alter default privileges in schema public grant all on tables to anon, authenticated;",
  );
  const migrate = async (file: string) => {
    await pg.exec(
      await readFile(
        new URL(`../../../../database/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  };
  for (const file of [
    "0001_auth.sql",
    "0002_platform.sql",
    "0003_content.sql",
    "0004_subjects.sql",
    "0006_simplify_platform_roles.sql",
    "0007_content_views.sql",
    "0008_content_reactions.sql",
    "0009_learning_content_identity.sql",
    "0010_guided_learning_catalog.sql",
    "0011_guided_learning_attempts.sql",
    "0012_guided_learning_evidence.sql",
    "0013_guided_learning_rewards.sql",
    "0014_guided_learning_observability.sql",
    "0015_guided_learning_foreign_key_indexes.sql",
  ])
    await migrate(file);
  await migrate("0016_learning_maps.sql");
  return {
    pg,
    database,
    get queryCount() {
      return queryCount;
    },
    close: async () => {
      await database.destroy();
      await pg.close();
    },
  };
}
