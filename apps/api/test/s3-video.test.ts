import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import {
  createS3ObjectStorage,
  type S3CommandClient,
  type S3ObjectStorage,
} from "../src/providers/s3-object-storage.js";
import { createS3VideoProvider } from "../src/providers/s3-video.js";

const creatorId = "04761a7d-4c02-48d7-b3a2-94b8baadf021";
const videoId = "20402bbc-63e1-437f-ad0d-71d4c73a9d8f";
const now = Date.parse("2026-08-27T12:00:00.000Z");

const storageConfiguration = {
  accessKeyId: "server-only-access-key",
  bucket: "video-test",
  endpoint: "https://project-ref.storage.supabase.co/storage/v1/s3",
  region: "us-east-1",
  secretAccessKey: "server-only-secret-key",
};

describe("S3 object storage", () => {
  it("presigns provider-neutral PUT and GET commands with the configured bucket", async () => {
    const client: S3CommandClient = { send: vi.fn() };
    const presign = vi
      .fn()
      .mockResolvedValueOnce("https://objects.example.test/upload?X-Amz-Signature=upload-signature")
      .mockResolvedValueOnce("https://objects.example.test/playback?X-Amz-Signature=playback-signature");
    const storage = createS3ObjectStorage(storageConfiguration, { client, presign });

    const uploadUrl = await storage.createUploadUrl({
      contentType: "video/mp4",
      expiresInSeconds: 600,
      key: `test-videos/${creatorId}/${videoId}`,
      metadata: { "creator-id": creatorId },
    });
    const playbackUrl = await storage.createDownloadUrl({
      expiresInSeconds: 300,
      key: `test-videos/${creatorId}/${videoId}`,
    });

    expect(uploadUrl).toContain("upload-signature");
    expect(playbackUrl).toContain("playback-signature");
    const uploadCommand = presign.mock.calls[0]?.[1];
    const playbackCommand = presign.mock.calls[1]?.[1];
    expect(uploadCommand).toBeInstanceOf(PutObjectCommand);
    expect(uploadCommand?.input).toEqual({
      Bucket: "video-test",
      ContentType: "video/mp4",
      Key: `test-videos/${creatorId}/${videoId}`,
      Metadata: { "creator-id": creatorId },
    });
    expect(playbackCommand).toBeInstanceOf(GetObjectCommand);
    expect(playbackCommand?.input).toEqual({
      Bucket: "video-test",
      Key: `test-videos/${creatorId}/${videoId}`,
    });
    expect(presign.mock.calls.map((call) => call[2])).toEqual([600, 300]);
  });

  it("maps object metadata, treats 404 as absent, and deletes through S3", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        ContentLength: 42_000_000,
        ContentType: "video/mp4",
        ETag: '"etag"',
        Metadata: { "creator-id": creatorId },
      })
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 }, name: "NotFound" })
      .mockResolvedValueOnce({});
    const client: S3CommandClient = { send };
    const storage = createS3ObjectStorage(storageConfiguration, { client });
    const key = `test-videos/${creatorId}/${videoId}`;

    await expect(storage.headObject(key)).resolves.toEqual({
      contentLength: 42_000_000,
      contentType: "video/mp4",
      etag: '"etag"',
      key,
      metadata: { "creator-id": creatorId },
    });
    await expect(storage.headObject(key)).resolves.toBeNull();
    await expect(storage.removeObject(key)).resolves.toBeUndefined();

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("rejects traversal keys and unsupported presigned URL lifetimes before I/O", async () => {
    const client: S3CommandClient = { send: vi.fn() };
    const presign = vi.fn();
    const storage = createS3ObjectStorage(storageConfiguration, { client, presign });

    await expect(
      storage.createUploadUrl({ expiresInSeconds: 60, key: "test-videos/../foreign-video" }),
    ).rejects.toThrow("Invalid S3 object key");
    await expect(
      storage.createDownloadUrl({ expiresInSeconds: 604_801, key: "test-videos/valid" }),
    ).rejects.toThrow("Invalid presigned URL lifetime");
    expect(presign).not.toHaveBeenCalled();
  });
});

describe("S3 video provider", () => {
  function createStorage(overrides: Partial<S3ObjectStorage> = {}): S3ObjectStorage {
    return {
      bucket: "video-test",
      createDownloadUrl: vi.fn().mockResolvedValue("https://objects.example.test/playback"),
      createUploadUrl: vi
        .fn()
        .mockResolvedValue("https://objects.example.test/upload?X-Amz-Signature=signed-put"),
      headObject: vi.fn().mockResolvedValue({
        contentLength: 42_000_000,
        contentType: "video/mp4",
        key: `test-videos/${creatorId}/${videoId}`,
        metadata: {},
      }),
      removeObject: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("creates a short-lived PUT URL inside the creator namespace", async () => {
    const storage = createStorage();
    const provider = createS3VideoProvider(storage, {}, { createId: () => videoId, now: () => now });
    const expiresAt = new Date(now + 10 * 60 * 1_000).toISOString();

    const upload = await provider.createDirectUpload({
      creatorId,
      durationSeconds: 420,
      expiresAt,
      fileSizeBytes: 42_000_000,
      maxDurationSeconds: 900,
      mimeType: "video/mp4",
    });

    expect(storage.createUploadUrl).toHaveBeenCalledWith({
      contentType: "video/mp4",
      expiresInSeconds: 600,
      key: `test-videos/${creatorId}/${videoId}`,
    });
    expect(upload).toEqual({
      expiresAt,
      externalVideoId: videoId,
      uploadPath: `test-videos/${creatorId}/${videoId}`,
      uploadType: "signed_put",
      uploadUrl: "https://objects.example.test/upload?X-Amz-Signature=signed-put",
    });
  });

  it("confirms only supported, bounded videos and validates optional ownership metadata", async () => {
    const readyStorage = createStorage();
    const provider = createS3VideoProvider(readyStorage, { maxFileSizeBytes: 50_000_000 });

    await expect(provider.confirmUpload(videoId, creatorId)).resolves.toEqual({
      creatorId,
      status: "ready",
    });

    for (const object of [
      { contentLength: 50_000_001, contentType: "video/mp4", metadata: {} },
      { contentLength: 42_000_000, contentType: "application/pdf", metadata: {} },
      {
        contentLength: 42_000_000,
        contentType: "video/mp4",
        metadata: { "creator-id": "2b02b788-ae21-49b3-97d4-53776135737b" },
      },
    ]) {
      const storage = createStorage({
        headObject: vi.fn().mockResolvedValue({
          key: `test-videos/${creatorId}/${videoId}`,
          ...object,
        }),
      });
      const invalidProvider = createS3VideoProvider(storage, { maxFileSizeBytes: 50_000_000 });
      await expect(invalidProvider.confirmUpload(videoId, creatorId)).resolves.toEqual({
        creatorId,
        status: "failed",
      });
      expect(storage.removeObject).toHaveBeenCalledWith(
        `test-videos/${creatorId}/${videoId}`,
      );
    }
  });

  it("rejects an excessive declared duration before creating a PUT URL", async () => {
    const storage = createStorage();
    const provider = createS3VideoProvider(storage, {}, { createId: () => videoId, now: () => now });

    await expect(
      provider.createDirectUpload({
        creatorId,
        durationSeconds: 901,
        expiresAt: new Date(now + 10 * 60 * 1_000).toISOString(),
        fileSizeBytes: 42_000_000,
        maxDurationSeconds: 900,
        mimeType: "video/mp4",
      }),
    ).rejects.toThrow("Invalid video duration");
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it("returns null for absent objects and never probes outside a validated owner namespace", async () => {
    const storage = createStorage({ headObject: vi.fn().mockResolvedValue(null) });
    const provider = createS3VideoProvider(storage);

    await expect(provider.getVideoAsset(videoId, creatorId)).resolves.toBeNull();
    await expect(provider.getVideoAsset(videoId)).resolves.toBeNull();
    await expect(provider.getVideoAsset("../foreign-video", creatorId)).rejects.toThrow(
      "Invalid video id",
    );
    expect(storage.headObject).toHaveBeenCalledTimes(1);
  });

  it("presigns bounded playback and removes the exact owner-scoped key", async () => {
    const storage = createStorage();
    const provider = createS3VideoProvider(
      storage,
      { maxPlaybackLifetimeSeconds: 900 },
      { now: () => now },
    );

    await expect(provider.createPlaybackSession(videoId, 3_600, creatorId)).resolves.toEqual({
      expiresAt: "2026-08-27T12:15:00.000Z",
      playbackUrl: "https://objects.example.test/playback",
    });
    await provider.removeVideo(videoId, creatorId);

    expect(storage.createDownloadUrl).toHaveBeenCalledWith({
      expiresInSeconds: 900,
      key: `test-videos/${creatorId}/${videoId}`,
    });
    expect(storage.removeObject).toHaveBeenCalledWith(`test-videos/${creatorId}/${videoId}`);
  });
});
