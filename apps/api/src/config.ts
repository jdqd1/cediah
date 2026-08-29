import { z } from "zod";
import { fileURLToPath } from "node:url";
import type { BetterAuthConfiguration } from "./auth.js";

const UuidSchema = z.string().uuid();

const EnvironmentSchema = z
  .object({
    AUTH_REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("false"),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.string().url().optional(),
    CLOUDFLARE_STREAM_ACCOUNT_ID: z.string().regex(/^[a-z0-9]{32}$/i).optional(),
    CLOUDFLARE_STREAM_API_TOKEN: z.string().min(1).optional(),
    CLOUDFLARE_STREAM_CUSTOMER_CODE: z.string().regex(/^[a-z0-9-]+$/i).optional(),
    CONTENT_STORAGE_BUCKET: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/).default("content-assets"),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_MIGRATIONS_ENABLED: z.enum(["true", "false"]).default("true"),
    DATABASE_MIGRATIONS_PATH: z.string().min(1).optional(),
    HOST: z.string().min(1).default("0.0.0.0"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    SMTP_FROM: z.string().email().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_USER: z.string().min(1).optional(),
    STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    STORAGE_S3_ENDPOINT: z.string().url().optional(),
    STORAGE_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
    STORAGE_S3_REGION: z.string().min(1).default("us-east-1"),
    STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    VIDEO_STORAGE_BUCKET: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/).default("video-test"),
    VIDEO_TEST_PROVIDER: z.enum(["cloudflare", "s3"]).default("s3"),
    VIDEO_TEST_MAX_DURATION_SECONDS: z.coerce.number().int().min(60).max(36_000).default(900),
    VIDEO_TEST_MAX_FILE_BYTES: z.coerce.number().int().min(1_000_000).max(200_000_000).default(50_000_000),
    VIDEO_TEST_UPLOAD_ENABLED: z.enum(["true", "false"]).default("false"),
    VIDEO_TEST_UPLOADER_IDS: z.string().optional(),
    WEB_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  })
  .superRefine((environment, context) => {
    const authValues = [environment.BETTER_AUTH_SECRET, environment.BETTER_AUTH_URL];
    if (authValues.some(Boolean) && (!environment.DATABASE_URL || !authValues.every(Boolean))) {
      context.addIssue({
        code: "custom",
        message:
          "DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL must be configured together for authentication",
      });
    }

    const smtpValues = [environment.SMTP_FROM, environment.SMTP_HOST];
    if (smtpValues.some(Boolean) && !smtpValues.every(Boolean)) {
      context.addIssue({ code: "custom", message: "SMTP_FROM and SMTP_HOST must be configured together" });
    }
    if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD)) {
      context.addIssue({ code: "custom", message: "SMTP_USER and SMTP_PASSWORD must be configured together" });
    }
    if (environment.AUTH_REQUIRE_EMAIL_VERIFICATION === "true" && !smtpValues.every(Boolean)) {
      context.addIssue({
        code: "custom",
        message: "SMTP must be configured when email verification is required",
      });
    }

    const cloudflareValues = [
      environment.CLOUDFLARE_STREAM_ACCOUNT_ID,
      environment.CLOUDFLARE_STREAM_API_TOKEN,
      environment.CLOUDFLARE_STREAM_CUSTOMER_CODE,
    ];
    const hasSomeCloudflareConfiguration = cloudflareValues.some(Boolean);
    const hasCompleteCloudflareConfiguration = cloudflareValues.every(Boolean);

    if (hasSomeCloudflareConfiguration && !hasCompleteCloudflareConfiguration) {
      context.addIssue({
        code: "custom",
        message:
          "CLOUDFLARE_STREAM_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN and CLOUDFLARE_STREAM_CUSTOMER_CODE must be configured together",
      });
    }

    const s3Values = [
      environment.STORAGE_S3_ACCESS_KEY_ID,
      environment.STORAGE_S3_ENDPOINT,
      environment.STORAGE_S3_SECRET_ACCESS_KEY,
    ];
    const hasSomeS3Configuration = s3Values.some(Boolean);
    const hasCompleteS3Configuration = s3Values.every(Boolean);
    if (hasSomeS3Configuration && !hasCompleteS3Configuration) {
      context.addIssue({
        code: "custom",
        message:
          "STORAGE_S3_ENDPOINT, STORAGE_S3_ACCESS_KEY_ID and STORAGE_S3_SECRET_ACCESS_KEY must be configured together",
      });
    }

    if (environment.VIDEO_TEST_UPLOAD_ENABLED === "true") {
      if (environment.VIDEO_TEST_PROVIDER === "cloudflare" && !hasCompleteCloudflareConfiguration) {
        context.addIssue({
          code: "custom",
          message: "Cloudflare Stream must be configured when VIDEO_TEST_PROVIDER is cloudflare",
        });
      }

      if (environment.VIDEO_TEST_PROVIDER === "s3" && !hasCompleteS3Configuration) {
        context.addIssue({
          code: "custom",
          message: "S3-compatible video storage must be configured when VIDEO_TEST_PROVIDER is s3",
        });
      }

      const uploaderIds = readUploaderIds(environment.VIDEO_TEST_UPLOADER_IDS);
      if (uploaderIds.length === 0) {
        context.addIssue({
          code: "custom",
          message: "VIDEO_TEST_UPLOADER_IDS must contain at least one test account when video testing is enabled",
        });
      }

      uploaderIds.forEach((id) => {
        if (!UuidSchema.safeParse(id).success) {
          context.addIssue({
            code: "custom",
            message: "VIDEO_TEST_UPLOADER_IDS must contain comma-separated user UUIDs",
          });
        }
      });
    }
  });

function readUploaderIds(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export type CloudflareStreamConfiguration = {
  accountId: string;
  apiToken: string;
  customerCode: string;
};

export type VideoTestProvider = "cloudflare" | "s3";

export type S3StorageConfiguration = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  region: string;
  secretAccessKey: string;
};

export type TestVideoUploadConfiguration = {
  maxDurationSeconds: number;
  maxFileSizeBytes: number;
  uploaderIds: Set<string>;
};

export type ApiEnvironment = {
  auth?: BetterAuthConfiguration;
  cloudflareStream?: CloudflareStreamConfiguration;
  contentStorage?: S3StorageConfiguration;
  databaseUrl?: string;
  migrationsEnabled?: boolean;
  migrationsPath?: string;
  HOST: string;
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  VIDEO_TEST_PROVIDER?: VideoTestProvider;
  WEB_ORIGINS: string;
  testVideoUpload?: TestVideoUploadConfiguration;
  videoStorage?: S3StorageConfiguration;
  webOrigins: Set<string>;
};

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  const environment = EnvironmentSchema.parse(source);
  const webOrigins = new Set(
    environment.WEB_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin),
  );

  const cloudflareStream =
    environment.CLOUDFLARE_STREAM_ACCOUNT_ID &&
    environment.CLOUDFLARE_STREAM_API_TOKEN &&
    environment.CLOUDFLARE_STREAM_CUSTOMER_CODE
      ? {
          accountId: environment.CLOUDFLARE_STREAM_ACCOUNT_ID,
          apiToken: environment.CLOUDFLARE_STREAM_API_TOKEN,
          customerCode: environment.CLOUDFLARE_STREAM_CUSTOMER_CODE,
        }
      : undefined;

  const sharedS3Configuration =
    environment.STORAGE_S3_ACCESS_KEY_ID &&
    environment.STORAGE_S3_ENDPOINT &&
    environment.STORAGE_S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: environment.STORAGE_S3_ACCESS_KEY_ID,
          endpoint: environment.STORAGE_S3_ENDPOINT,
          forcePathStyle: environment.STORAGE_S3_FORCE_PATH_STYLE === "true",
          region: environment.STORAGE_S3_REGION,
          secretAccessKey: environment.STORAGE_S3_SECRET_ACCESS_KEY,
        }
      : undefined;
  const contentStorage = sharedS3Configuration
    ? { ...sharedS3Configuration, bucket: environment.CONTENT_STORAGE_BUCKET }
    : undefined;
  const videoStorage = sharedS3Configuration
    ? { ...sharedS3Configuration, bucket: environment.VIDEO_STORAGE_BUCKET }
    : undefined;

  const smtp =
    environment.SMTP_FROM && environment.SMTP_HOST
      ? {
          from: environment.SMTP_FROM,
          host: environment.SMTP_HOST,
          password: environment.SMTP_PASSWORD,
          port: environment.SMTP_PORT,
          secure: environment.SMTP_SECURE === "true",
          user: environment.SMTP_USER,
        }
      : undefined;

  const auth =
    environment.DATABASE_URL && environment.BETTER_AUTH_SECRET && environment.BETTER_AUTH_URL
      ? {
          databaseUrl: environment.DATABASE_URL,
          publicUrl: new URL(environment.BETTER_AUTH_URL).origin,
          requireEmailVerification: environment.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
          secret: environment.BETTER_AUTH_SECRET,
          smtp,
          turnstileSecretKey: environment.TURNSTILE_SECRET_KEY,
          trustedOrigins: [...webOrigins],
        }
      : undefined;

  const testVideoUpload =
    environment.VIDEO_TEST_UPLOAD_ENABLED === "true"
      ? {
          maxDurationSeconds: environment.VIDEO_TEST_MAX_DURATION_SECONDS,
          maxFileSizeBytes: environment.VIDEO_TEST_MAX_FILE_BYTES,
          uploaderIds: new Set(readUploaderIds(environment.VIDEO_TEST_UPLOADER_IDS).map((id) => id.toLowerCase())),
        }
      : undefined;

  return {
    auth,
    cloudflareStream,
    contentStorage,
    databaseUrl: environment.DATABASE_URL,
    HOST: environment.HOST,
    NODE_ENV: environment.NODE_ENV,
    PORT: environment.PORT,
    migrationsEnabled: environment.DATABASE_MIGRATIONS_ENABLED === "true",
    migrationsPath:
      environment.DATABASE_MIGRATIONS_PATH ??
      fileURLToPath(new URL("../../../database/migrations/", import.meta.url)),
    testVideoUpload,
    VIDEO_TEST_PROVIDER: environment.VIDEO_TEST_PROVIDER,
    videoStorage,
    WEB_ORIGINS: environment.WEB_ORIGINS,
    webOrigins,
  };
}
