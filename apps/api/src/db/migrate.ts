import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";

const migrationLockId = 1_942_880_431;

export type AppliedMigration = {
  fileName: string;
  status: "applied" | "already_applied";
};

function checksum(source: string) {
  return createHash("sha256").update(source).digest("hex");
}

export async function applySqlMigrations(
  pool: Pool,
  migrationsDirectory: string,
): Promise<AppliedMigration[]> {
  const directory = resolve(migrationsDirectory);
  const fileNames = (await readdir(directory))
    .filter((fileName) => /^\d+_[a-z0-9_]+\.sql$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));
  const client = await pool.connect();

  try {
    await client.query("select pg_advisory_lock($1)", [migrationLockId]);
    await client.query("create schema if not exists public");
    await client.query(`
      create table if not exists public.cediah_schema_migrations (
        file_name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const existing = await client.query<{ checksum: string; file_name: string }>(
      "select file_name, checksum from public.cediah_schema_migrations",
    );
    const applied = new Map(existing.rows.map((row) => [row.file_name, row.checksum]));
    const results: AppliedMigration[] = [];

    for (const fileName of fileNames) {
      const source = await readFile(resolve(directory, fileName), "utf8");
      const sourceChecksum = checksum(source);
      const storedChecksum = applied.get(fileName);

      if (storedChecksum) {
        if (storedChecksum !== sourceChecksum) {
          throw new Error(`Migration ${fileName} changed after it was applied.`);
        }
        results.push({ fileName, status: "already_applied" });
        continue;
      }

      await client.query("begin");
      try {
        await client.query(source);
        await client.query(
          "insert into public.cediah_schema_migrations (file_name, checksum) values ($1, $2)",
          [fileName, sourceChecksum],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }

      results.push({ fileName, status: "applied" });
    }

    return results;
  } finally {
    try {
      await client.query("select pg_advisory_unlock($1)", [migrationLockId]);
    } finally {
      client.release();
    }
  }
}
