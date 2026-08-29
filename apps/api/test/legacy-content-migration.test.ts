import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const expectedChecksum = "71969713a7f75335a5d2d775c442c2d5";

type LegacyPayload = {
  content_assets: Array<{ status: string; storage_bucket: string }>;
  content_items: Array<{ status: string }>;
  content_subjects: Array<{ subject_slug: string }>;
};

async function readLegacyPayload() {
  const migration = await readFile(
    resolve(repositoryRoot, "database/migrations/0005_restore_legacy_content.sql"),
    "utf8",
  );
  const match = migration.match(/\$payload\$\s*([\s\S]+?)\s*\$payload\$/);
  if (!match?.[1]) throw new Error("Legacy migration payload is missing");

  const bytes = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  return {
    checksum: createHash("md5").update(bytes).digest("hex"),
    decoded: bytes.toString("utf8"),
    migration,
    payload: JSON.parse(bytes.toString("utf8")) as LegacyPayload,
  };
}

describe("legacy content restoration migration", () => {
  it("contains the reviewed public snapshot without authentication secrets or personal data", async () => {
    const { checksum, decoded, payload } = await readLegacyPayload();

    expect(checksum).toBe(expectedChecksum);
    expect(payload.content_items).toHaveLength(4);
    expect(payload.content_items.every((item) => item.status === "published")).toBe(true);
    expect(payload.content_assets).toHaveLength(4);
    expect(payload.content_assets.filter((asset) => asset.status === "ready")).toHaveLength(3);
    expect(payload.content_assets.every((asset) => asset.storage_bucket === "content-assets")).toBe(
      true,
    );
    expect(payload.content_subjects).toHaveLength(4);
    expect(payload.content_subjects.every((link) => link.subject_slug === "anatomia")).toBe(true);
    expect(decoded).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(decoded).not.toMatch(/\b(?:encrypted_password|password|secret|session|token)\b/i);
  });

  it("binds administrator recovery to the exact new account and old-email fingerprint", async () => {
    const { migration } = await readLegacyPayload();

    expect(migration).toContain("e1c2ab6d-4a14-4c39-87bd-9cac21269a2b");
    expect(migration).toContain("b2f1c60e285a2ab03245be825d88473d");
    expect(migration).toMatch(/insert into public\.user_roles/i);
    expect(migration).toMatch(/'administrator'/i);
  });
});
