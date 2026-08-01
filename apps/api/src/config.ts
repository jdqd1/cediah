import { z } from "zod";

const EnvironmentSchema = z
  .object({
    HOST: z.string().min(1).default("0.0.0.0"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    SUPABASE_URL: z.string().url().optional(),
    WEB_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  })
  .superRefine((environment, context) => {
    const hasSupabaseUrl = Boolean(environment.SUPABASE_URL);
    const hasSupabaseSecret = Boolean(environment.SUPABASE_SECRET_KEY);

    if (hasSupabaseUrl === hasSupabaseSecret) return;

    context.addIssue({
      code: "custom",
      message: "SUPABASE_URL and SUPABASE_SECRET_KEY must be configured together",
    });
  });

export type ApiEnvironment = {
  HOST: string;
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_URL?: string;
  WEB_ORIGINS: string;
  supabase?: { secretKey: string; url: string };
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

  return { ...environment, supabase, webOrigins };
}
