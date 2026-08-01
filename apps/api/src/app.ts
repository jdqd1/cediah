import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import {
  CurrentUserResponseSchema,
  type IdentityProvider,
  HealthResponseSchema,
} from "@cediah/contracts";
import { type ApiEnvironment, readEnvironment } from "./config.js";
import { createSupabaseIdentityProvider } from "./providers/supabase-identity.js";

type AppDependencies = {
  identityProvider?: IdentityProvider;
};

function readBearerToken(authorization: string | undefined) {
  if (!authorization) return null;

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) return null;

  return token;
}

export async function buildApp(
  environment: ApiEnvironment = readEnvironment(),
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const identityProvider =
    dependencies.identityProvider ??
    (environment.supabase ? createSupabaseIdentityProvider(environment.supabase) : undefined);
  const app = Fastify({
    bodyLimit: 1_048_576,
    logger:
      environment.NODE_ENV === "test"
        ? false
        : {
            level: environment.NODE_ENV === "production" ? "info" : "debug",
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
            ],
          },
    requestIdHeader: false,
    trustProxy: false,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    credentials: false,
    methods: ["GET", "HEAD", "OPTIONS"],
    origin(origin, callback) {
      if (!origin || environment.webOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
  });

  app.get("/health", async (_request, reply) => {
    const response = HealthResponseSchema.parse({
      checkedAt: new Date().toISOString(),
      environment: environment.NODE_ENV,
      service: "cediah-api",
      status: "ok",
      version: "0.1.0",
    });
    return reply.header("Cache-Control", "no-store").send(response);
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const accessToken = readBearerToken(request.headers.authorization);
    if (!accessToken) {
      return reply
        .status(401)
        .header("Cache-Control", "no-store")
        .send({ error: "unauthorized" });
    }

    if (!identityProvider) {
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "identity_unavailable" });
    }

    try {
      const user = await identityProvider.getUser(accessToken);
      if (!user) {
        return reply
          .status(401)
          .header("Cache-Control", "no-store")
          .send({ error: "unauthorized" });
      }

      const response = CurrentUserResponseSchema.parse({ user });
      return reply.header("Cache-Control", "no-store").send(response);
    } catch (error) {
      request.log.warn({ err: error }, "Identity provider validation failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "identity_unavailable" });
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: "not_found" });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    return reply.status(error.statusCode ?? 500).send({
      error: error.statusCode && error.statusCode < 500 ? error.name : "internal_error",
    });
  });

  return app;
}
