import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  LearningIdempotencyKeySchema,
  LearningMapSummaryResponseSchema,
  LearningMapLevelResponseSchema,
  LearningMapCatalogResponseSchema,
  LearningMapSuggestionsResponseSchema,
  LearningMapMutationResponseSchema,
  MapQuerySchema,
  MapCatalogQuerySchema,
  MapMutationSchemas,
  type IdentityProvider,
  type LearningMapProvider,
  type MapMutation,
} from "@cediah/contracts";
import {
  resolveGuidedUser,
  sendGuidedUserError,
} from "../guided-learning/http.js";

export async function registerLearningMapRoutes(
  app: FastifyInstance,
  dependencies: {
    identityProvider?: IdentityProvider;
    provider?: LearningMapProvider;
  },
) {
  await app.register(async (scoped) => {
    scoped.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "private, no-store");
    });
    for (const suffix of ["", "/level", "/catalog", "/suggestions"] as const)
      scoped.get(`/v1/guided-learning/map${suffix}`, async (request, reply) => {
        const user = await resolveGuidedUser(
          request,
          dependencies.identityProvider,
        );
        if (user.kind !== "authenticated")
          return sendGuidedUserError(user, reply);
        if (!dependencies.provider)
          return reply.status(503).send({ error: "map_unavailable" });
        try {
          if (!suffix) {
            if (!z.strictObject({}).safeParse(request.query).success)
              return reply.status(400).send({ error: "invalid_request" });
            return reply.send(
              LearningMapSummaryResponseSchema.parse(
                await dependencies.provider.summary(user.user.id),
              ),
            );
          }
          if (suffix === "/catalog") {
            const q = MapCatalogQuerySchema.safeParse(request.query);
            if (!q.success)
              return reply.status(400).send({ error: "invalid_request" });
            const result = await dependencies.provider.catalog(
              user.user.id,
              q.data,
            );
            return result
              ? reply.send(LearningMapCatalogResponseSchema.parse(result))
              : reply.status(404).send({ error: "not_found" });
          }
          const q = MapQuerySchema.safeParse(request.query);
          if (!q.success)
            return reply.status(400).send({ error: "invalid_request" });
          const route = {
            nodeId: q.data.node ?? null,
            entryId: q.data.item ?? null,
            unitStableKey: q.data.unit ?? null,
          };
          const result =
            suffix === "/level"
              ? await dependencies.provider.level(user.user.id, route)
              : await dependencies.provider.suggestions(user.user.id, route);
          return result
            ? reply.send(
                suffix === "/level"
                  ? LearningMapLevelResponseSchema.parse(result)
                  : LearningMapSuggestionsResponseSchema.parse(result),
              )
            : reply.status(404).send({ error: "not_found" });
        } catch {
          return reply.status(503).send({ error: "map_unavailable" });
        }
      });
    for (const operation of Object.keys(MapMutationSchemas) as Array<
      keyof typeof MapMutationSchemas
    >)
      scoped.route({
        method:
          operation === "layout" || operation === "updateNode"
            ? "PATCH"
            : "POST",
        url: `/v1/guided-learning/map/${operation === "updateNode" ? "nodes/:id" : operation}`,
        bodyLimit: 128 * 1024,
        async handler(request, reply) {
          const user = await resolveGuidedUser(
            request,
            dependencies.identityProvider,
          );
          if (user.kind !== "authenticated")
            return sendGuidedUserError(user, reply);
          if (!dependencies.provider)
            return reply.status(503).send({ error: "map_unavailable" });
          const body = MapMutationSchemas[operation].safeParse(request.body);
          const key = LearningIdempotencyKeySchema.safeParse(
            request.headers["idempotency-key"],
          );
          const params = z
            .strictObject({ id: z.string().uuid() })
            .safeParse(request.params);
          if (
            !body.success ||
            !key.success ||
            (operation === "updateNode" && !params.success)
          )
            return reply.status(400).send({ error: "invalid_request" });
          try {
            const result = await dependencies.provider.mutate({
              operation,
              request: body.data,
              userId: user.user.id,
              idempotencyKey: key.data,
              nodeId: params.success ? params.data.id : undefined,
            } as MapMutation & {
              userId: string;
              idempotencyKey: string;
              nodeId?: string;
            });
            if (result.status !== "success")
              return reply
                .status(
                  result.status === "not_found"
                    ? 404
                    : result.status === "not_ready"
                      ? 422
                      : result.status === "forbidden"
                        ? 403
                        : 409,
                )
                .send({ error: result.status });
            return reply.send(
              LearningMapMutationResponseSchema.parse(result.value),
            );
          } catch {
            return reply.status(503).send({ error: "map_unavailable" });
          }
        },
      });
  });
}
