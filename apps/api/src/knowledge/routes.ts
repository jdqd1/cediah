import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  GuideKnowledgeIndexSchema,
  KnowledgeTermAdminListSchema,
  KnowledgeTermAdminSchema,
  KnowledgeTermCreateRequestSchema,
  KnowledgeTermUpdateRequestSchema,
  type ContentProvider,
  type IdentityProvider,
  type IdentityRequest,
} from "@cediah/contracts";
import type { DatabaseClient } from "../db/database.js";
import {
  createKnowledgeTerm,
  deactivateKnowledgeTerm,
  drainKnowledgeReindexQueue,
  getGuideKnowledge,
  listGuideKnowledgeSections,
  listKnowledgeTerms,
  updateKnowledgeTerm,
} from "./postgres-knowledge.js";

const GuideSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const KnowledgeTermIdParamsSchema = z.object({ termId: z.string().uuid() });
const ContentIdParamsSchema = z.object({ contentId: z.string().uuid() });
const KnowledgeTermListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
});
const GuideKnowledgeSectionsResponseSchema = z.object({
  sections: z.array(z.object({
    anchor: z.string().min(1).max(160),
    heading: z.string().min(1).max(500),
    ordinal: z.number().int().nonnegative(),
  })).max(2_000),
});

type KnowledgeRouteDependencies = {
  contentProvider: ContentProvider | undefined;
  database: DatabaseClient | undefined;
  identityProvider: IdentityProvider | undefined;
};

function toIdentityRequest(headers: FastifyRequest["headers"]): IdentityRequest {
  const forwardedFor = headers["x-forwarded-for"];
  return {
    authorization: headers.authorization,
    cookie: headers.cookie,
    forwardedFor: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor,
    userAgent: headers["user-agent"],
  };
}

async function resolveKnowledgeAdministrator(
  request: FastifyRequest,
  dependencies: KnowledgeRouteDependencies,
) {
  const identity = toIdentityRequest(request.headers);
  if (!identity.authorization && !identity.cookie) {
    return { kind: "error" as const, status: 401, error: "unauthorized" };
  }
  if (!dependencies.identityProvider) {
    return { kind: "error" as const, status: 503, error: "identity_unavailable" };
  }
  if (!dependencies.contentProvider) {
    return { kind: "error" as const, status: 503, error: "content_unavailable" };
  }

  try {
    const user = await dependencies.identityProvider.getUser(identity);
    if (!user) return { kind: "error" as const, status: 401, error: "unauthorized" };
    const roles = await dependencies.contentProvider.getRoles(user.id);
    if (!roles.includes("administrator")) {
      return { kind: "error" as const, status: 403, error: "forbidden" };
    }
    return { kind: "success" as const, roles, user };
  } catch {
    return { kind: "error" as const, status: 503, error: "content_unavailable" };
  }
}

function postgresErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code : null;
}

async function writeKnowledgeAudit(
  database: DatabaseClient,
  input: { action: string; actorUserId: string; termId: string },
) {
  await database
    .insertInto("audit_log")
    .values({
      action: input.action,
      actor_user_id: input.actorUserId,
      metadata: {},
      target_id: input.termId,
      target_type: "knowledge_term",
    })
    .execute();
}

export async function registerKnowledgeRoutes(
  app: FastifyInstance,
  dependencies: KnowledgeRouteDependencies,
) {
  let workerRunning = false;
  const worker = dependencies.database
    ? setInterval(() => {
        if (workerRunning || !dependencies.database) return;
        workerRunning = true;
        void drainKnowledgeReindexQueue(dependencies.database, 16)
          .catch((error) => app.log.error({ err: error }, "Knowledge reindex batch failed"))
          .finally(() => { workerRunning = false; });
      }, 5_000)
    : null;
  worker?.unref();
  if (worker) app.addHook("onClose", async () => clearInterval(worker));

  app.get<{ Params: { slug: string } }>("/v1/knowledge/guides/:slug", async (request, reply) => {
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
    }
    const params = GuideSlugParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    try {
      const knowledge = await getGuideKnowledge(dependencies.database, params.data.slug);
      if (!knowledge) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(GuideKnowledgeIndexSchema.parse(knowledge));
    } catch (error) {
      request.log.error({ err: error }, "Guide knowledge request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
    }
  });

  app.get<{ Querystring: unknown }>("/v1/editor/knowledge/terms", async (request, reply) => {
    const administrator = await resolveKnowledgeAdministrator(request, dependencies);
    if (administrator.kind === "error") {
      return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
    }
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
    }
    const query = KnowledgeTermListQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_term_query" });
    }

    try {
      const terms = await listKnowledgeTerms(dependencies.database, query.data.q);
      return reply.header("Cache-Control", "no-store").send(KnowledgeTermAdminListSchema.parse({ terms }));
    } catch (error) {
      request.log.error({ err: error }, "Knowledge term list failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/editor/knowledge/terms", async (request, reply) => {
    const administrator = await resolveKnowledgeAdministrator(request, dependencies);
    if (administrator.kind === "error") {
      return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
    }
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
    }
    const input = KnowledgeTermCreateRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_knowledge_term" });
    }

    try {
      const term = await createKnowledgeTerm(dependencies.database, input.data);
      await writeKnowledgeAudit(dependencies.database, {
        action: "knowledge_term_created",
        actorUserId: administrator.user.id,
        termId: term.id,
      });
      return reply
        .status(201)
        .header("Cache-Control", "no-store")
        .send(KnowledgeTermAdminSchema.parse(term));
    } catch (error) {
      if (postgresErrorCode(error) === "23505") {
        return reply.status(409).header("Cache-Control", "no-store").send({ error: "knowledge_term_conflict" });
      }
      if (error instanceof Error && error.message === "knowledge_target_section_not_found") {
        return reply.status(409).header("Cache-Control", "no-store").send({ error: "knowledge_target_section_not_found" });
      }
      request.log.error({ err: error }, "Knowledge term creation failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
    }
  });

  app.patch<{ Body: unknown; Params: { termId: string } }>(
    "/v1/editor/knowledge/terms/:termId",
    async (request, reply) => {
      const administrator = await resolveKnowledgeAdministrator(request, dependencies);
      if (administrator.kind === "error") {
        return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
      }
      if (!dependencies.database) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
      }
      const params = KnowledgeTermIdParamsSchema.safeParse(request.params);
      const input = KnowledgeTermUpdateRequestSchema.safeParse(request.body);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      if (!input.success) {
        return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_knowledge_term" });
      }

      try {
        const term = await updateKnowledgeTerm(dependencies.database, params.data.termId, input.data);
        if (!term) {
          return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
        }
        await writeKnowledgeAudit(dependencies.database, {
          action: "knowledge_term_updated",
          actorUserId: administrator.user.id,
          termId: term.id,
        });
        return reply.header("Cache-Control", "no-store").send(KnowledgeTermAdminSchema.parse(term));
      } catch (error) {
        if (postgresErrorCode(error) === "23505") {
          return reply.status(409).header("Cache-Control", "no-store").send({ error: "knowledge_term_conflict" });
        }
        if (error instanceof Error && error.message === "knowledge_target_section_not_found") {
          return reply.status(409).header("Cache-Control", "no-store").send({ error: "knowledge_target_section_not_found" });
        }
        request.log.error({ err: error }, "Knowledge term update failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
      }
    },
  );

  app.delete<{ Params: { termId: string } }>(
    "/v1/editor/knowledge/terms/:termId",
    async (request, reply) => {
      const administrator = await resolveKnowledgeAdministrator(request, dependencies);
      if (administrator.kind === "error") {
        return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
      }
      if (!dependencies.database) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
      }
      const params = KnowledgeTermIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      try {
        const deactivated = await deactivateKnowledgeTerm(dependencies.database, params.data.termId);
        if (!deactivated) {
          return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
        }
        await writeKnowledgeAudit(dependencies.database, {
          action: "knowledge_term_deactivated",
          actorUserId: administrator.user.id,
          termId: params.data.termId,
        });
        return reply.header("Cache-Control", "no-store").send({ id: params.data.termId, active: false });
      } catch (error) {
        request.log.error({ err: error }, "Knowledge term deactivation failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
      }
    },
  );

  app.get<{ Params: { contentId: string } }>(
    "/v1/editor/knowledge/guides/:contentId/sections",
    async (request, reply) => {
      const administrator = await resolveKnowledgeAdministrator(request, dependencies);
      if (administrator.kind === "error") {
        return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
      }
      if (!dependencies.database) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
      }
      const params = ContentIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      try {
        const sections = await listGuideKnowledgeSections(dependencies.database, params.data.contentId);
        return reply.header("Cache-Control", "no-store").send(
          GuideKnowledgeSectionsResponseSchema.parse({
            sections: sections.map((section) => ({
              anchor: section.anchor,
              heading: section.heading,
              ordinal: section.ordinal,
            })),
          }),
        );
      } catch (error) {
        request.log.error({ err: error }, "Guide knowledge section lookup failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "knowledge_unavailable" });
      }
    },
  );
}
