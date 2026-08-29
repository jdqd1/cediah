import { describe, expect, it, vi } from "vitest";
import { readEnvironment } from "../src/config.js";
import { createContentAssetDownloadUrl } from "../src/providers/postgres-content.js";

const asset = {
  status: "ready" as const,
  storage_bucket: "content-assets",
  storage_path: "content/video-id/asset-id.mp4",
};

describe("PostgreSQL content-asset downloads", () => {
  it("uses the historical content bucket with the shared server-side S3 credentials", () => {
    const environment = readEnvironment({
      CONTENT_STORAGE_BUCKET: "content-assets",
      STORAGE_S3_ACCESS_KEY_ID: "server-access-key",
      STORAGE_S3_ENDPOINT: "https://project.storage.supabase.co/storage/v1/s3",
      STORAGE_S3_REGION: "us-east-1",
      STORAGE_S3_SECRET_ACCESS_KEY: "server-secret-key",
      VIDEO_STORAGE_BUCKET: "video-test",
    });

    expect(environment.contentStorage).toMatchObject({
      accessKeyId: "server-access-key",
      bucket: "content-assets",
      endpoint: "https://project.storage.supabase.co/storage/v1/s3",
    });
    expect(environment.videoStorage?.bucket).toBe("video-test");
  });

  it("signs a ready object only in the configured private bucket", async () => {
    const createDownloadUrl = vi.fn().mockResolvedValue(
      "https://project.storage.supabase.co/object?X-Amz-Signature=signed",
    );
    const storage = { bucket: "content-assets", createDownloadUrl };

    await expect(createContentAssetDownloadUrl(asset, storage, 900)).resolves.toContain(
      "X-Amz-Signature=signed",
    );
    expect(createDownloadUrl).toHaveBeenCalledWith({
      expiresInSeconds: 900,
      key: asset.storage_path,
    });
  });

  it("does not sign pending assets or records from another bucket", async () => {
    const createDownloadUrl = vi.fn();
    const storage = { bucket: "content-assets", createDownloadUrl };

    await expect(
      createContentAssetDownloadUrl({ ...asset, status: "pending" }, storage),
    ).resolves.toBeNull();
    await expect(
      createContentAssetDownloadUrl({ ...asset, storage_bucket: "foreign" }, storage),
    ).resolves.toBeNull();
    expect(createDownloadUrl).not.toHaveBeenCalled();
  });

  it("keeps publication metadata available when object storage is unavailable", async () => {
    const storage = {
      bucket: "content-assets",
      createDownloadUrl: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    };

    await expect(createContentAssetDownloadUrl(asset, storage)).resolves.toBeNull();
  });
});
