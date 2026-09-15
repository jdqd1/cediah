import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import { CurrentUserResponseSchema } from "@cediah/contracts";
import type { DatabaseClient } from "./db/database.js";

const DeleteTopicRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const DeletedTopicResponseSchema = z.object({
  topic: z.object({
    name: z.string().trim().min(1).max(120),
    subjectIds: z.array(z.string().uuid()),
  }),
});

type DeleteTopicResult =
  | { status: "success"; value: { name: string; subjectIds: string[] } }
  | { status: "in_use" }
  | { status: "not_found" };

async function resolveCurrentUser(app: FastifyInstance, request: FastifyRequest) {
  const headers: Record<string, string> = {};
  if (request.headers.authorization) headers.authorization = request.headers.authorization;
  if (request.headers.cookie) headers.cookie = request.headers.cookie;

  const response = await app.inject({
    headers,
    method: "GET",
    url: "/v1/auth/me",
  });

  if (response.statusCode !== 200) {
    return { statusCode: response.statusCode, user: null };
  }

  let body: unknown;
  try {
    body = JSON.parse(response.payload) as unknown;
  } catch {
    return { statusCode: 503, user: null };
  }
  const parsed = CurrentUserResponseSchema.safeParse(body);
  return parsed.success
    ? { statusCode: 200, user: parsed.data }
    : { statusCode: 503, user: null };
}

export async function deleteEditorialTopic(
  database: DatabaseClient,
  input: { actorUserId: string; name: string },
): Promise<DeleteTopicResult> {
  return database.transaction().execute(async (transaction) => {
    const topicResult = await sql<{ id: string; name: string }>`
      select id, name
      from public.content_topics
      where lower(btrim(name)) = lower(btrim(${input.name}))
      limit 1
      for update
    `.execute(transaction);
    const topic = topicResult.rows[0];
    if (!topic) return { status: "not_found" };

    const usage = await sql<{ id: string }>`
      select item.id
      from public.content_items as item
      where lower(btrim(item.topic)) = lower(btrim(${topic.name}))
        or exists (
          select 1
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(item.content -> 'regions') = 'array'
                then item.content -> 'regions'
              else '[]'::jsonb
            end
          ) as region(value)
          where lower(btrim(region.value)) = lower(btrim(${topic.name}))
        )
      limit 1
    `.execute(transaction);
    if (usage.rows.length > 0) return { status: "in_use" };

    await sql`
      delete from public.content_topics
      where id = ${topic.id}
    `.execute(transaction);

    await transaction
      .insertInto("audit_log")
      .values({
        action: "content_topic_deleted",
        actor_user_id: input.actorUserId,
        metadata: { name: topic.name },
        target_id: topic.id,
        target_type: "content_topic",
      })
      .execute();

    return {
      status: "success",
      value: { name: topic.name, subjectIds: [] },
    };
  });
}

export function registerEditorTopicDeleteRoute(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  app.delete<{ Body: unknown }>("/v1/editor/topics", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!database) return reply.status(503).send({ error: "content_unavailable" });

    const current = await resolveCurrentUser(app, request);
    if (!current.user) {
      const statusCode = current.statusCode === 401 ? 401 : 503;
      return reply.status(statusCode).send({
        error: statusCode === 401 ? "unauthorized" : "identity_unavailable",
      });
    }
    if (!current.user.roles.includes("administrator")) {
      return reply.status(403).send({ error: "forbidden" });
    }

    const input = DeleteTopicRequestSchema.safeParse(request.body);
    if (!input.success) return reply.status(400).send({ error: "invalid_topic" });

    try {
      const result = await deleteEditorialTopic(database, {
        actorUserId: current.user.user.id,
        name: input.data.name,
      });
      if (result.status === "not_found") {
        return reply.status(404).send({ error: "not_found" });
      }
      if (result.status === "in_use") {
        return reply.status(409).send({ error: "topic_in_use" });
      }
      return reply.send(DeletedTopicResponseSchema.parse({ topic: result.value }));
    } catch (error) {
      request.log.error({ err: error }, "Content topic deletion failed");
      return reply.status(503).send({ error: "content_unavailable" });
    }
  });
}
