import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { ContentProvider, IdentityProvider, IdentityRequest } from "@cediah/contracts";
import { getContentCapabilities } from "./content-authorization.js";
import type { DatabaseClient } from "./db/database.js";
import {
  deleteContentTopic,
  listContentTopicItemOrders,
  renameContentTopic,
  reorderContentTopicItems,
} from "./content-topic-taxonomy.js";

const ContentTopicRenameRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  previousName: z.string().trim().min(1).max(120),
});

const ContentTopicDeleteRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const ContentTopicResponseSchema = z.object({
  topic: z.object({
    name: z.string().trim().min(1).max(120),
    subjectIds: z.array(z.string().uuid()),
  }),
});

const ContentTopicOrderQuerySchema = z.object({
  subjectId: z.string().uuid(),
});

const ContentTopicOrderRequestSchema = z.object({
  contentIds: z.array(z.string().uuid()).max(500),
  subjectId: z.string().uuid(),
  topic: z.string().trim().min(1).max(120),
});

const ContentTopicOrdersResponseSchema = z.object({
  topics: z.array(z.object({
    contentIds: z.array(z.string().uuid()),
    topic: z.string().trim().min(1).max(120),
  })),
});

const ContentTopicOrderMutationResponseSchema = z.object({
  order: z.object({
    contentIds: z.array(z.string().uuid()),
    subjectId: z.string().uuid(),
    topic: z.string().trim().min(1).max(120),
  }),
});

function toIdentityRequest(headers: FastifyRequest["headers"]): IdentityRequest {
  const forwardedFor = headers["x-forwarded-for"];
  return {
    authorization: headers.authorization,
    cookie: headers.cookie,
    forwardedFor: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor,
    userAgent: headers["user-agent"],
  };
}

async function resolveTaxonomyEditor(
  request: FastifyRequest,
  identityProvider: IdentityProvider | undefined,
  contentProvider: ContentProvider | undefined,
) {
  const identity = toIdentityRequest(request.headers);
  if (!identity.authorization && !identity.cookie) {
    return { kind: "error" as const, status: 401, error: "unauthorized" };
  }
  if (!identityProvider) {
    return { kind: "error" as const, status: 503, error: "identity_unavailable" };
  }

  try {
    const user = await identityProvider.getUser(identity);
    if (!user) return { kind: "error" as const, status: 401, error: "unauthorized" };
    if (!contentProvider) {
      return { kind: "error" as const, status: 503, error: "content_unavailable" };
    }
    const roles = await contentProvider.getRoles(user.id);
    if (!getContentCapabilities(roles).canManageTaxonomy) {
      return { kind: "error" as const, status: 403, error: "forbidden" };
    }
    return { kind: "success" as const, user };
  } catch {
    return { kind: "error" as const, status: 503, error: "content_unavailable" };
  }
}

function topicMutationError(
  status: "conflict" | "in_use" | "not_found",
) {
  if (status === "not_found") return { statusCode: 404, error: "not_found" };
  if (status === "in_use") return { statusCode: 409, error: "topic_in_use" };
  return { statusCode: 409, error: "topic_conflict" };
}

export async function registerContentTopicEditorRoutes(
  app: FastifyInstance,
  dependencies: {
    contentProvider: ContentProvider | undefined;
    database: DatabaseClient | undefined;
    identityProvider: IdentityProvider | undefined;
  },
) {
  app.get<{ Querystring: unknown }>("/v1/content/topic-order", async (request, reply) => {
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
    const query = ContentTopicOrderQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_subject" });
    }

    try {
      const topics = await listContentTopicItemOrders(dependencies.database, query.data.subjectId);
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(ContentTopicOrdersResponseSchema.parse({ topics }));
    } catch (error) {
      request.log.error({ err: error }, "Content topic order lookup failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.patch<{ Body: unknown }>("/v1/editor/topic-order", async (request, reply) => {
    const editor = await resolveTaxonomyEditor(
      request,
      dependencies.identityProvider,
      dependencies.contentProvider,
    );
    if (editor.kind === "error") {
      return reply
        .status(editor.status)
        .header("Cache-Control", "no-store")
        .send({ error: editor.error });
    }
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }

    const input = ContentTopicOrderRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_topic_order" });
    }

    try {
      const result = await reorderContentTopicItems(dependencies.database, {
        actorUserId: editor.user.id,
        ...input.data,
      });
      if (result.status === "not_found") {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      if (result.status === "conflict") {
        return reply.status(409).header("Cache-Control", "no-store").send({ error: "topic_order_conflict" });
      }
      return reply
        .header("Cache-Control", "no-store")
        .send(ContentTopicOrderMutationResponseSchema.parse({ order: result.value }));
    } catch (error) {
      request.log.error({ err: error }, "Content topic order update failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.patch<{ Body: unknown }>("/v1/editor/topics", async (request, reply) => {
    const editor = await resolveTaxonomyEditor(
      request,
      dependencies.identityProvider,
      dependencies.contentProvider,
    );
    if (editor.kind === "error") {
      return reply
        .status(editor.status)
        .header("Cache-Control", "no-store")
        .send({ error: editor.error });
    }
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }

    const input = ContentTopicRenameRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_topic" });
    }

    try {
      const result = await renameContentTopic(dependencies.database, {
        actorUserId: editor.user.id,
        name: input.data.name,
        previousName: input.data.previousName,
      });
      if (result.status !== "success") {
        const mapped = topicMutationError(result.status);
        return reply
          .status(mapped.statusCode)
          .header("Cache-Control", "no-store")
          .send({ error: mapped.error });
      }
      return reply
        .header("Cache-Control", "no-store")
        .send(ContentTopicResponseSchema.parse({ topic: result.value }));
    } catch (error) {
      request.log.error({ err: error }, "Content topic update failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.delete<{ Body: unknown }>("/v1/editor/topics", async (request, reply) => {
    const editor = await resolveTaxonomyEditor(
      request,
      dependencies.identityProvider,
      dependencies.contentProvider,
    );
    if (editor.kind === "error") {
      return reply
        .status(editor.status)
        .header("Cache-Control", "no-store")
        .send({ error: editor.error });
    }
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }

    const input = ContentTopicDeleteRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_topic" });
    }

    try {
      const result = await deleteContentTopic(dependencies.database, {
        actorUserId: editor.user.id,
        name: input.data.name,
      });
      if (result.status !== "success") {
        const mapped = topicMutationError(result.status);
        return reply
          .status(mapped.statusCode)
          .header("Cache-Control", "no-store")
          .send({ error: mapped.error });
      }
      return reply
        .header("Cache-Control", "no-store")
        .send(ContentTopicResponseSchema.parse({ topic: result.value }));
    } catch (error) {
      request.log.error({ err: error }, "Content topic deletion failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });
}
