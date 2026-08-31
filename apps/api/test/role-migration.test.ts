import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("platform role consolidation migration", () => {
  it("replaces the role enum with only the four product roles", async () => {
    const migration = await readFile(
      resolve(repositoryRoot, "database/migrations/0006_simplify_platform_roles.sql"),
      "utf8",
    );
    const enumDefinition = migration.match(
      /create type public\.platform_role as enum\s*\(([\s\S]*?)\);/i,
    );
    const roles = [...(enumDefinition?.[1] ?? "").matchAll(/'([^']+)'/g)]
      .map((match) => match[1]);

    expect(roles).toEqual([
      "student",
      "content_creator",
      "coordinator",
      "administrator",
    ]);
    expect(migration).toMatch(/when 'community_contributor' then 'content_creator'/i);
    expect(migration).toMatch(/when 'presenter' then 'content_creator'/i);
    expect(migration).toMatch(/when 'academic_editor' then 'coordinator'/i);
    expect(migration).toMatch(/when 'coordination' then 'coordinator'/i);
    expect(migration).toMatch(/when 'finance_readonly' then 'student'/i);
    expect(migration).toMatch(/distinct on \(user_id, mapped_role\)/i);
    expect(migration).toMatch(/create trigger user_roles_prevent_last_administrator_removal/i);
  });
});
