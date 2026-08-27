import { randomUUID } from "node:crypto";
import type {
  DirectVideoUpload,
  VideoAsset,
  VideoPlaybackSession,
  VideoProvider,
} from "@cediah/contracts";
import type { S3ObjectStorage, StoredObject } from "./s3-object-storage.js";

const defaultUploadPrefix = "test-videos";
const defaultMaximumFileSizeBytes = 200_000_000;
const defaultMaximumPlaybackLifetimeSeconds = 60 * 60;
const minimumPlaybackLifetimeSeconds = 60;
const maximumPresignedUrlLifetimeSeconds = 7 * 24 * 60 * 60;
const allowedVideoMimeTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type S3VideoProviderConfiguration = {
  maxFileSizeBytes?: number;
  maxPlaybackLifetimeSeconds?: number;
  prefix?: string;
};

export type S3VideoProviderDependencies = {
  createId?: () => string;
  now?: () => number;
};

export interface S3VideoProvider extends VideoProvider {
  confirmUpload(videoId: string, creatorId: string): Promise<VideoAsset | null>;
  createPlaybackUrl(
    videoId: string,
    expiresInSeconds: number,
    creatorId: string,
  ): Promise<VideoPlaybackSession>;
  removeVideo(videoId: string, creatorId: string): Promise<void>;
}

function assertUuid(value: string, label: string): void {
  if (!UuidPattern.test(value)) throw new Error(`Invalid ${label}`);
}

function normalizePrefix(prefix: string): string {
  const normalized = prefix.replace(/^\/+|\/+$/g, "");
  const segments = normalized.split("/");
  if (
    !normalized ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid video storage prefix");
  }
  return normalized;
}

function videoPath(prefix: string, creatorId: string, videoId: string): string {
  assertUuid(creatorId, "video creator id");
  assertUuid(videoId, "video id");
  return `${prefix}/${creatorId.toLowerCase()}/${videoId.toLowerCase()}`;
}

function objectBelongsToVideo(object: StoredObject, creatorId: string, videoId: string): boolean {
  const metadataCreatorId = object.metadata["creator-id"];
  const metadataVideoId = object.metadata["video-id"];

  return (
    (!metadataCreatorId || metadataCreatorId.toLowerCase() === creatorId.toLowerCase()) &&
    (!metadataVideoId || metadataVideoId.toLowerCase() === videoId.toLowerCase())
  );
}

function isSupportedVideoObject(object: StoredObject, maximumFileSizeBytes: number): boolean {
  if (object.contentLength === undefined || object.contentType === undefined) return false;
  if (!Number.isSafeInteger(object.contentLength) || object.contentLength < 1) return false;
  if (object.contentLength > maximumFileSizeBytes) return false;

  const mimeType = object.contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (!mimeType || !allowedVideoMimeTypes.has(mimeType)) return false;

  return true;
}

function readUploadLifetime(expiresAt: string, now: number): number {
  const expiresAtMilliseconds = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMilliseconds)) throw new Error("Invalid video upload expiry");

  const lifetime = Math.ceil((expiresAtMilliseconds - now) / 1_000);
  if (lifetime < 1 || lifetime > maximumPresignedUrlLifetimeSeconds) {
    throw new Error("Video upload expiry is outside the supported range");
  }
  return lifetime;
}

export function createS3VideoProvider(
  storage: S3ObjectStorage,
  configuration: S3VideoProviderConfiguration = {},
  dependencies: S3VideoProviderDependencies = {},
): S3VideoProvider {
  const prefix = normalizePrefix(configuration.prefix ?? defaultUploadPrefix);
  const maximumFileSizeBytes = configuration.maxFileSizeBytes ?? defaultMaximumFileSizeBytes;
  const maximumPlaybackLifetimeSeconds =
    configuration.maxPlaybackLifetimeSeconds ?? defaultMaximumPlaybackLifetimeSeconds;
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? Date.now;

  if (!Number.isSafeInteger(maximumFileSizeBytes) || maximumFileSizeBytes < 1) {
    throw new Error("Invalid maximum video file size");
  }
  if (
    !Number.isInteger(maximumPlaybackLifetimeSeconds) ||
    maximumPlaybackLifetimeSeconds < minimumPlaybackLifetimeSeconds ||
    maximumPlaybackLifetimeSeconds > maximumPresignedUrlLifetimeSeconds
  ) {
    throw new Error("Invalid maximum video playback lifetime");
  }

  async function confirmUpload(videoId: string, creatorId: string): Promise<VideoAsset | null> {
    const path = videoPath(prefix, creatorId, videoId);
    const object = await storage.headObject(path);
    if (!object) return null;

    const isValid =
      objectBelongsToVideo(object, creatorId, videoId) &&
      isSupportedVideoObject(object, maximumFileSizeBytes);
    if (!isValid) await storage.removeObject(path);

    return {
      creatorId,
      status: isValid ? "ready" : "failed",
    };
  }

  async function createPlaybackUrl(
    videoId: string,
    expiresInSeconds: number,
    creatorId: string,
  ): Promise<VideoPlaybackSession> {
    if (!Number.isFinite(expiresInSeconds)) throw new Error("Invalid playback lifetime");
    const lifetime = Math.min(
      Math.max(Math.trunc(expiresInSeconds), minimumPlaybackLifetimeSeconds),
      maximumPlaybackLifetimeSeconds,
    );
    const playbackUrl = await storage.createDownloadUrl({
      expiresInSeconds: lifetime,
      key: videoPath(prefix, creatorId, videoId),
    });

    return {
      expiresAt: new Date(now() + lifetime * 1_000).toISOString(),
      playbackUrl,
    };
  }

  return {
    async confirmUpload(videoId, creatorId) {
      return confirmUpload(videoId, creatorId);
    },

    async createDirectUpload(input): Promise<DirectVideoUpload> {
      assertUuid(input.creatorId, "video creator id");
      if (
        !Number.isFinite(input.durationSeconds) ||
        input.durationSeconds <= 0 ||
        input.durationSeconds > input.maxDurationSeconds
      ) {
        throw new Error("Invalid video duration");
      }
      if (
        !Number.isSafeInteger(input.fileSizeBytes) ||
        input.fileSizeBytes < 1 ||
        input.fileSizeBytes > maximumFileSizeBytes
      ) {
        throw new Error("Invalid video file size");
      }
      if (!allowedVideoMimeTypes.has(input.mimeType)) {
        throw new Error("Invalid video MIME type");
      }
      const externalVideoId = createId();
      assertUuid(externalVideoId, "generated video id");
      const path = videoPath(prefix, input.creatorId, externalVideoId);
      const uploadUrl = await storage.createUploadUrl({
        contentType: input.mimeType,
        expiresInSeconds: readUploadLifetime(input.expiresAt, now()),
        key: path,
      });

      return {
        expiresAt: input.expiresAt,
        externalVideoId,
        uploadPath: path,
        uploadType: "signed_put",
        uploadUrl,
      };
    },

    async createPlaybackSession(videoId, expiresInSeconds, creatorId) {
      if (!creatorId) throw new Error("S3 playback requires the video owner");
      return createPlaybackUrl(videoId, expiresInSeconds, creatorId);
    },

    async createPlaybackUrl(videoId, expiresInSeconds, creatorId) {
      return createPlaybackUrl(videoId, expiresInSeconds, creatorId);
    },

    async getVideoAsset(videoId, creatorId) {
      if (!creatorId) return null;
      return confirmUpload(videoId, creatorId);
    },

    async removeVideo(videoId, creatorId) {
      await storage.removeObject(videoPath(prefix, creatorId, videoId));
    },
  };
}
