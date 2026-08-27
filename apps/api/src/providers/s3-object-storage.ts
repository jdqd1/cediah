import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const maximumPresignedUrlLifetimeSeconds = 7 * 24 * 60 * 60;
const maximumObjectKeyBytes = 1_024;

type S3ObjectCommand =
  | DeleteObjectCommand
  | GetObjectCommand
  | HeadObjectCommand
  | PutObjectCommand;

export type S3CommandClient = {
  send(command: S3ObjectCommand): Promise<unknown>;
};

type PresignRequest = (
  client: S3CommandClient,
  command: GetObjectCommand | PutObjectCommand,
  expiresInSeconds: number,
) => Promise<string>;

export type S3ObjectStorageConfiguration = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle?: boolean;
  region: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type StoredObject = {
  contentLength?: number;
  contentType?: string;
  etag?: string;
  key: string;
  metadata: Readonly<Record<string, string>>;
};

export type S3ObjectStorage = {
  bucket: string;
  createDownloadUrl(input: { expiresInSeconds: number; key: string }): Promise<string>;
  createUploadUrl(input: {
    contentType?: string;
    expiresInSeconds: number;
    key: string;
    metadata?: Readonly<Record<string, string>>;
  }): Promise<string>;
  headObject(key: string): Promise<StoredObject | null>;
  removeObject(key: string): Promise<void>;
};

export type S3ObjectStorageDependencies = {
  client?: S3CommandClient;
  presign?: PresignRequest;
};

function assertObjectKey(key: string): void {
  const byteLength = Buffer.byteLength(key, "utf8");
  const segments = key.split("/");

  if (
    byteLength === 0 ||
    byteLength > maximumObjectKeyBytes ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.includes("\0") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid S3 object key");
  }
}

function assertLifetime(expiresInSeconds: number): void {
  if (
    !Number.isInteger(expiresInSeconds) ||
    expiresInSeconds < 1 ||
    expiresInSeconds > maximumPresignedUrlLifetimeSeconds
  ) {
    throw new Error("Invalid presigned URL lifetime");
  }
}

function assertContentType(contentType: string): void {
  if (!/^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/i.test(contentType)) {
    throw new Error("Invalid object content type");
  }
}

function assertMetadata(metadata: Readonly<Record<string, string>>): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(key) || value.length > 1_024 || /[\r\n\0]/.test(value)) {
      throw new Error("Invalid object metadata");
    }
  }
}

function isMissingObjectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    Code?: string;
    code?: string;
    name?: string;
  };
  const code = candidate.name ?? candidate.Code ?? candidate.code;

  return candidate.$metadata?.httpStatusCode === 404 || code === "NotFound" || code === "NoSuchKey";
}

function normalizeEndpoint(endpoint: string): string {
  const parsed = new URL(endpoint);
  if (parsed.username || parsed.password) throw new Error("S3 endpoint must not contain credentials");
  return parsed.toString().replace(/\/$/, "");
}

function createDefaultClient(configuration: S3ObjectStorageConfiguration): S3CommandClient {
  return new S3Client({
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
      ...(configuration.sessionToken ? { sessionToken: configuration.sessionToken } : {}),
    },
    endpoint: normalizeEndpoint(configuration.endpoint),
    forcePathStyle: configuration.forcePathStyle ?? true,
    region: configuration.region,
  }) as S3CommandClient;
}

const defaultPresign: PresignRequest = async (client, command, expiresInSeconds) =>
  getSignedUrl(client as S3Client, command, { expiresIn: expiresInSeconds });

export function createS3ObjectStorage(
  configuration: S3ObjectStorageConfiguration,
  dependencies: S3ObjectStorageDependencies = {},
): S3ObjectStorage {
  if (!configuration.bucket.trim()) throw new Error("S3 bucket is required");
  if (!configuration.accessKeyId || !configuration.secretAccessKey) {
    throw new Error("S3 server credentials are required");
  }

  const client = dependencies.client ?? createDefaultClient(configuration);
  const presign = dependencies.presign ?? defaultPresign;

  return {
    bucket: configuration.bucket,

    async createDownloadUrl(input) {
      assertObjectKey(input.key);
      assertLifetime(input.expiresInSeconds);

      return presign(
        client,
        new GetObjectCommand({ Bucket: configuration.bucket, Key: input.key }),
        input.expiresInSeconds,
      );
    },

    async createUploadUrl(input) {
      assertObjectKey(input.key);
      assertLifetime(input.expiresInSeconds);
      if (input.contentType) assertContentType(input.contentType);
      if (input.metadata) assertMetadata(input.metadata);

      return presign(
        client,
        new PutObjectCommand({
          Bucket: configuration.bucket,
          Key: input.key,
          ...(input.contentType ? { ContentType: input.contentType } : {}),
          ...(input.metadata ? { Metadata: input.metadata } : {}),
        }),
        input.expiresInSeconds,
      );
    },

    async headObject(key) {
      assertObjectKey(key);

      try {
        const result = (await client.send(
          new HeadObjectCommand({ Bucket: configuration.bucket, Key: key }),
        )) as HeadObjectCommandOutput;

        return {
          ...(result.ContentLength === undefined ? {} : { contentLength: result.ContentLength }),
          ...(result.ContentType === undefined ? {} : { contentType: result.ContentType }),
          ...(result.ETag === undefined ? {} : { etag: result.ETag }),
          key,
          metadata: result.Metadata ?? {},
        };
      } catch (error) {
        if (isMissingObjectError(error)) return null;
        throw error;
      }
    },

    async removeObject(key) {
      assertObjectKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: configuration.bucket, Key: key }));
    },
  };
}
