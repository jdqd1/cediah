import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ContentEditorIndexPageSchema,
  ContentItemSchema,
  ContentKindSchema,
  ContentStatusSchema,
  ContentWorkspaceResponseSchema,
  type ContentProvider,
  type IdentityProvider,
  type IdentityRequest,
} from "@cediah/contracts";
import { getContentCapabilities } from "./content-authorization.js";
import type { DatabaseClient } from "./db/database.js";
import {
  deleteContentTopic,
  listContentTopicDisplayOrder,
  listContentTopicItemOrders,
  listContentTopicItems,
  renameContentTopic,
  reorderContentTopicItems,
  reorderContentTopics,
} from "./content-topic-taxonomy.js";
import {
  decodeEditorContentCursor,
  EDITOR_CONTENT_INDEX_MAX_LIMIT,
  getEditorContentItem,
  listEditorContentIndex,
  listEditorSubjects,
  listEditorTopics,
} from "./editor-content-index.js";

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

const ContentTopicItemSummarySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["guide", "video"]),
  status: z.enum([
    "draft",
    "in_review",
    "changes_requested",
    "approved",
    "published",
    "archived",
  ]),
  subjectIds: z.array(z.string().uuid()),
  title: z.string().max(200),
  topics: z.array(z.string().trim().min(1).max(120)),
});

const ContentTopicItemsResponseSchema = z.object({
  items: z.array(ContentTopicItemSummarySchema),
  topics: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    subjectIds: z.array(z.string().uuid()),
  })),
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
  topicOrder: z.array(z.string().trim().min(1).max(120)),
  topics: z.array(z.object({
    contentIds: z.array(z.string().uuid()),
    topic: z.string().trim().min(1).max(120),
  })),
});

const ContentTopicListOrderRequestSchema = z.object({
  subjectId: z.string().uuid(),
  topics: z.array(z.string().trim().min(1).max(120)).max(500),
});

const ContentTopicListOrderMutationResponseSchema = z.object({
  order: z.object({
    subjectId: z.string().uuid(),
    topics: z.array(z.string().trim().min(1).max(120)),
  }),
});

const ContentTopicOrderMutationResponseSchema = z.object({
  order: z.object({
    contentIds: z.array(z.string().uuid()),
    subjectId: z.string().uuid(),
    topic: z.string().trim().min(1).max(120),
  }),
});

const ContentIdParamsSchema = z.object({ contentId: z.string().uuid() });

const EditorContentIndexQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  includeWorkspace: z.enum(["0", "1"]).default("1"),
  kind: ContentKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(EDITOR_CONTENT_INDEX_MAX_LIMIT).default(500),
  q: z.string().trim().max(200).optional(),
  scope: z.enum(["all", "publications"]).default("all"),
  status: ContentStatusSchema.optional(),
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

async function resolveContentEditor(
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
    const capabilities = getContentCapabilities(roles);
    if (!capabilities.canCreate && !capabilities.canEditAll) {
      return { kind: "error" as const, status: 403, error: "forbidden" };
    }
    return { kind: "success" as const, capabilities, roles, user };
  } catch {
    return { kind: "error" as const, status: 503, error: "content_unavailable" };
  }
}

async function resolveTaxonomyEditor(
  request: FastifyRequest,
  identityProvider: IdentityProvider | undefined,
  contentProvider: ContentProvider | undefined,
) {
  const editor = await resolveContentEditor(request, identityProvider, contentProvider);
  if (editor.kind === "error") return editor;
  if (!editor.capabilities.canManageTaxonomy) {
    return { kind: "error" as const, status: 403, error: "forbidden" };
  }
  return editor;
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
  app.get("/v1/editor/content-index", async (request, reply) => {
    const editor = await resolveContentEditor(
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

    const query = EditorContentIndexQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });
    }
    const decodedCursor = query.data.cursor ? decodeEditorContentCursor(query.data.cursor) : null;
    if (query.data.cursor && !decodedCursor) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_index_query" });
    }
    const cursor = decodedCursor ?? undefined;

    const indexInput = {
      actorUserId: editor.user.id,
      canEditAll: editor.capabilities.canEditAll,
      cursor,
      kind: query.data.kind,
      limit: query.data.limit,
      query: query.data.q,
      scope: query.data.scope,
      status: query.data.status,
    };

    try {
      if (query.data.includeWorkspace === "0") {
        const page = await listEditorContentIndex(dependencies.database, indexInput);
        return reply
          .header("Cache-Control", "no-store")
          .send(ContentEditorIndexPageSchema.parse(page));
      }

      const [page, subjects, topics] = await Promise.all([
        listEditorContentIndex(dependencies.database, indexInput),
        listEditorSubjects(dependencies.database),
        listEditorTopics(dependencies.database),
      ]);
      return reply.header("Cache-Control", "no-store").send(
        ContentWorkspaceResponseSchema.parse({
          capabilities: { ...editor.capabilities, canUpload: false },
          index: page.index,
          items: page.items,
          roles: editor.roles,
          subjects,
          topics,
        }),
      );
    } catch (error) {
      request.log.error({ err: error }, "Content editor index request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.get<{ Params: { contentId: string } }>("/v1/editor/content/:contentId", async (request, reply) => {
    const editor = await resolveContentEditor(
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
    const params = ContentIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    try {
      const item = await getEditorContentItem(dependencies.database, {
        actorUserId: editor.user.id,
        canEditAll: editor.capabilities.canEditAll,
        contentId: params.data.contentId,
      });
      if (!item) return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      return reply.header("Cache-Control", "no-store").send(ContentItemSchema.parse(item));
    } catch (error) {
      request.log.error({ err: error }, "Content editor detail request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.get("/v1/editor/topic-items", async (request, reply) => {
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

    try {
      const result = await listContentTopicItems(dependencies.database);
      return reply
        .header("Cache-Control", "private, max-age=5, stale-while-revalidate=20")
        .send(ContentTopicItemsResponseSchema.parse(result));
    } catch (error) {
      request.log.error({ err: error }, "Content topic item lookup failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.get<{ Querystring: unknown }>("/v1/content/topic-order", async (request, reply) => {
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
    const query = ContentTopicOrderQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_subject" });
    }

    try {
      const [topics, topicOrder] = await Promise.all([
        listContentTopicItemOrders(dependencies.database, query.data.subjectId),
        listContentTopicDisplayOrder(dependencies.database, query.data.subjectId),
      ]);
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(ContentTopicOrdersResponseSchema.parse({ topicOrder, topics }));
    } catch (error) {
      request.log.error({ err: error }, "Content topic order lookup failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.patch<{ Body: unknown }>("/v1/editor/topic-list-order", async (request, reply) => {
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

    const input = ContentTopicListOrderRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_topic_order" });
    }

    try {
      const result = await reorderContentTopics(dependencies.database, {
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
        .send(ContentTopicListOrderMutationResponseSchema.parse({ order: result.value }));
    } catch (error) {
      request.log.error({ err: error }, "Content topic list order update failed");
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
