import { z } from "zod";

const UuidSchema = z.string().uuid();

const EnvironmentSchema = z
  .object({
    CLOUDFLARE_STREAM_ACCOUNT_ID: z.string().regex(/^[a-z0-9]{32}$/i).optional(),
    CLOUDFLARE_STREAM_API_TOKEN: z.string().min(1).optional(),
    CLOUDFLARE_STREAM_CUSTOMER_CODE: z.string().regex(/^[a-z0-9-]+$/i).optional(),
    HOST: z.string().min(1).default("0.0.0.0"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    SUPABASE_URL: z.string().url().optional(),
    VIDEO_TEST_MAX_DURATION_SECONDS: z.coerce.number().int().min(60).max(36_000).default(900),
    VIDEO_TEST_MAX_FILE_BYTES: z.coerce.number().int().min(1_000_000).max(200_000_000).default(190_000_000),
    VIDEO_TEST_UPLOAD_ENABLED: z.enum(["true", "false"]).default("false"),
    VIDEO_TEST_UPLOADER_IDS: z.string().optional(),
    WEB_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  })
  .superRefine((environment, context) => {
    const hasSupabaseUrl = Boolean(environment.SUPABASE_URL);
    const hasSupabaseSecret = Boolean(environment.SUPABASE_SECRET_KEY);

    if (hasSupabaseUrl !== hasSupabaseSecret) {
      context.addIssue({
        code: "custom",
        message: "SUPABASE_URL and SUPABASE_SECRET_KEY must be configured together",
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

    if (environment.VIDEO_TEST_UPLOAD_ENABLED === "true") {
      if (!hasCompleteCloudflareConfiguration) {
        context.addIssue({
          code: "custom",
          message: "Cloudflare Stream must be configured when VIDEO_TEST_UPLOAD_ENABLED is true",
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
            message: "VIDEO_TEST_UPLOADER_IDS must contain comma-separated Supabase user UUIDs",
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

export type TestVideoUploadConfiguration = {
  maxDurationSeconds: number;
  maxFileSizeBytes: number;
  uploaderIds: Set<string>;
};

export type ApiEnvironment = {
  cloudflareStream?: CloudflareStreamConfiguration;
  HOST: string;
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_URL?: string;
  WEB_ORIGINS: string;
  supabase?: { secretKey: string; url: string };
  testVideoUpload?: TestVideoUploadConfiguration;
  webOrigins: Set<string>;
};

export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const environment = EnvironmentSchema.parse(source);
  const webOrigins = new Set(
    environment.WEB_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin),
  );

  const supabase =
    environment.SUPABASE_URL && environment.SUPABASE_SECRET_KEY
      ? { secretKey: environment.SUPABASE_SECRET_KEY, url: environment.SUPABASE_URL }
      : undefined;

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

  const testVideoUpload =
    environment.VIDEO_TEST_UPLOAD_ENABLED === "true"
      ? {
          maxDurationSeconds: environment.VIDEO_TEST_MAX_DURATION_SECONDS,
          maxFileSizeBytes: environment.VIDEO_TEST_MAX_FILE_BYTES,
          uploaderIds: new Set(readUploaderIds(environment.VIDEO_TEST_UPLOADER_IDS).map((id) => id.toLowerCase())),
        }
      : undefined;

  return { ...environment, cloudflareStream, supabase, testVideoUpload, webOrigins };
}
