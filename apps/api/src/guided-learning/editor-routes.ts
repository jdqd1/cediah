import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  LearningEditorPathListResponseSchema,
  LearningEditorResourceCatalogResponseSchema,
  LearningEditorResourceQuerySchema,
  LearningPathCreateRequestSchema,
  LearningPathCreateVersionRequestSchema,
  LearningPathDetailSchema,
  LearningPathTransitionRequestSchema,
  LearningPathUpdateRequestSchema,
  type ContentProvider,
  type GuidedLearningFailure,
  type GuidedLearningProvider,
  type IdentityProvider,
} from "@cediah/contracts";
import { getContentCapabilities } from "../content-authorization.js";
import { resolveGuidedUser, sendGuidedUserError } from "./http.js";

const PathParamsSchema = z.strictObject({ pathId: z.string().uuid() });

function sendFailure(
  result: { issues?: unknown; status: GuidedLearningFailure | "not_ready" },
  reply: FastifyReply,
) {
  if (result.status === "not_found") return reply.status(404).send({ error: "not_found" });
  if (result.status === "forbidden") return reply.status(403).send({ error: "forbidden" });
  if (result.status === "not_ready") {
    return reply.status(422).send({ error: "route_not_ready", issues: result.issues ?? [] });
  }
  return reply.status(409).send({
    error: result.status === "version_conflict" ? "version_conflict"
      : result.status === "resource_changed" ? "resource_changed" : "conflict",
  });
}

async function editorContext(
  request: Parameters<typeof resolveGuidedUser>[0],
  dependencies: {
    contentProvider?: ContentProvider;
    identityProvider?: IdentityProvider;
  },
) {
  const user = await resolveGuidedUser(request, dependencies.identityProvider);
  if (user.kind !== "authenticated") return user;
  if (!dependencies.contentProvider) return { kind: "content_unavailable" as const };
  try {
    const roles = await dependencies.contentProvider.getRoles(user.user.id);
    return {
      capabilities: getContentCapabilities(roles),
      kind: "authenticated" as const,
      user: user.user,
    };
  } catch {
    return { kind: "content_unavailable" as const };
  }
}

export async function registerGuidedLearningEditorRoutes(
  app: FastifyInstance,
  dependencies: {
    contentProvider?: ContentProvider;
    identityProvider?: IdentityProvider;
    provider?: GuidedLearningProvider;
  },
) {
  app.get("/v1/editor/learning-paths", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") {
      return editor.kind === "content_unavailable"
        ? reply.status(503).send({ error: "learning_unavailable" })
        : sendGuidedUserError(editor, reply);
    }
    if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) {
      return reply.status(403).send({ error: "forbidden" });
    }
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    try {
      const items = await dependencies.provider.listEditorPaths({
        actorUserId: editor.user.id,
        canEditAll: editor.capabilities.canEditAll,
      });
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningEditorPathListResponseSchema.parse({ items }));
    } catch {
      request.log.error("Learning-path workspace failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.get<{ Querystring: unknown }>("/v1/editor/learning-resources", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") {
      return editor.kind === "content_unavailable"
        ? reply.status(503).send({ error: "learning_unavailable" })
        : sendGuidedUserError(editor, reply);
    }
    if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) {
      return reply.status(403).send({ error: "forbidden" });
    }
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const query = LearningEditorResourceQuerySchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.listEditorResources(query.data);
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningEditorResourceCatalogResponseSchema.parse(result));
    } catch {
      request.log.error("Learning-resource catalog failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/editor/learning-paths", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") {
      return editor.kind === "content_unavailable" ? reply.status(503).send({ error: "learning_unavailable" }) : sendGuidedUserError(editor, reply);
    }
    if (!editor.capabilities.canCreate) return reply.status(403).send({ error: "forbidden" });
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const body = LearningPathCreateRequestSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.createPath({ actorUserId: editor.user.id, draft: body.data });
      if (result.status !== "success") return sendFailure(result, reply);
      return reply.status(201).header("Cache-Control", "private, no-store")
        .send(LearningPathDetailSchema.parse(result.value));
    } catch {
      request.log.error("Learning-path creation failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.route<{ Body: unknown; Params: { pathId: string } }>({
    method: "GET",
    url: "/v1/editor/learning-paths/:pathId",
    async handler(request, reply) {
      const editor = await editorContext(request, dependencies);
      if (editor.kind !== "authenticated") return editor.kind === "content_unavailable" ? reply.status(503).send({ error: "learning_unavailable" }) : sendGuidedUserError(editor, reply);
      if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) return reply.status(403).send({ error: "forbidden" });
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = PathParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      const result = await dependencies.provider.getEditorPath({ actorUserId: editor.user.id, canEditAll: editor.capabilities.canEditAll, pathId: params.data.pathId });
      if (result.status !== "success") return sendFailure(result, reply);
      return reply.header("Cache-Control", "private, no-store").send(LearningPathDetailSchema.parse(result.value));
    },
  });

  app.patch<{ Body: unknown; Params: { pathId: string } }>("/v1/editor/learning-paths/:pathId", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") return editor.kind === "content_unavailable" ? reply.status(503).send({ error: "learning_unavailable" }) : sendGuidedUserError(editor, reply);
    if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) return reply.status(403).send({ error: "forbidden" });
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const params = PathParamsSchema.safeParse(request.params);
    const body = LearningPathUpdateRequestSchema.safeParse(request.body);
    if (!params.success) return reply.status(404).send({ error: "not_found" });
    if (!body.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.updatePath({ actorUserId: editor.user.id, canEditAll: editor.capabilities.canEditAll, pathId: params.data.pathId, update: body.data });
      if (result.status !== "success") return sendFailure(result, reply);
      return reply.header("Cache-Control", "private, no-store").send(LearningPathDetailSchema.parse(result.value));
    } catch {
      request.log.error("Learning-path update failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.post<{ Params: { pathId: string } }>("/v1/editor/learning-paths/:pathId/validate", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") return editor.kind === "content_unavailable" ? reply.status(503).send({ error: "learning_unavailable" }) : sendGuidedUserError(editor, reply);
    if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) return reply.status(403).send({ error: "forbidden" });
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const params = PathParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(404).send({ error: "not_found" });
    const result = await dependencies.provider.validatePath({ actorUserId: editor.user.id, canEditAll: editor.capabilities.canEditAll, pathId: params.data.pathId });
    if (result.status !== "success") return sendFailure(result, reply);
    return reply.header("Cache-Control", "private, no-store").send(result.value);
  });

  app.post<{ Body: unknown; Params: { pathId: string } }>("/v1/editor/learning-paths/:pathId/transition", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") return editor.kind === "content_unavailable" ? reply.status(503).send({ error: "learning_unavailable" }) : sendGuidedUserError(editor, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const params = PathParamsSchema.safeParse(request.params);
    const body = LearningPathTransitionRequestSchema.safeParse(request.body);
    if (!params.success) return reply.status(404).send({ error: "not_found" });
    if (!body.success) return reply.status(400).send({ error: "invalid_request" });
    const result = await dependencies.provider.transitionPath({
      actorUserId: editor.user.id,
      canPublish: editor.capabilities.canPublish,
      canReview: editor.capabilities.canReview,
      expectedVersion: body.data.expectedVersion,
      pathId: params.data.pathId,
      status: body.data.status,
    });
    if (result.status !== "success") return sendFailure(result, reply);
    return reply.header("Cache-Control", "private, no-store").send(LearningPathDetailSchema.parse(result.value));
  });

  app.post<{ Body: unknown; Params: { pathId: string } }>("/v1/editor/learning-paths/:pathId/versions", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") return editor.kind === "content_unavailable" ? reply.status(503).send({ error: "learning_unavailable" }) : sendGuidedUserError(editor, reply);
    if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) return reply.status(403).send({ error: "forbidden" });
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const params = PathParamsSchema.safeParse(request.params);
    const body = LearningPathCreateVersionRequestSchema.safeParse(request.body);
    if (!params.success) return reply.status(404).send({ error: "not_found" });
    if (!body.success) return reply.status(400).send({ error: "invalid_request" });
    const result = await dependencies.provider.createVersion({ actorUserId: editor.user.id, canEditAll: editor.capabilities.canEditAll, pathId: params.data.pathId, releaseNotes: body.data.releaseNotes });
    if (result.status !== "success") return sendFailure(result, reply);
    return reply.status(201).header("Cache-Control", "private, no-store").send(LearningPathDetailSchema.parse(result.value));
  });

  app.get<{ Params: { pathId: string } }>("/v1/editor/learning-paths/:pathId/preview", async (request, reply) => {
    const editor = await editorContext(request, dependencies);
    if (editor.kind !== "authenticated") return editor.kind === "content_unavailable" ? reply.status(503).send({ error: "learning_unavailable" }) : sendGuidedUserError(editor, reply);
    if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) return reply.status(403).send({ error: "forbidden" });
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const params = PathParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(404).send({ error: "not_found" });
    const result = await dependencies.provider.getEditorPath({ actorUserId: editor.user.id, canEditAll: editor.capabilities.canEditAll, pathId: params.data.pathId });
    if (result.status !== "success") return sendFailure(result, reply);
    return reply.header("Cache-Control", "private, no-store").send(LearningPathDetailSchema.parse(result.value));
  });
}
