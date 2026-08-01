import { z } from "zod";

const EnvironmentSchema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
});

export type ApiEnvironment = ReturnType<typeof readEnvironment>;

export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const environment = EnvironmentSchema.parse(source);
  const webOrigins = new Set(
    environment.WEB_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin),
  );

  return { ...environment, webOrigins };
}
