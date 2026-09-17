import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import type { ContentProvider, IdentityProvider, IdentityRequest } from "@cediah/contracts";
import type { DatabaseClient } from "./db/database.js";
import { getContentKnowledgeTerms, type KnowledgeTermFrequency } from "./knowledge-terms.js";

const ContentTermParamsSchema = z.object({ contentId: z.string().uuid() });
const TermIdParamsSchema = z.object({ termId: z.string().uuid() });
const TermSlugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const FrequencySchema = z.enum(["first_document", "first_section", "all"]);

const TermMutationSchema = z.object({
  aliases: z.array(z.object({
    alias: z.string().trim().min(2).max(160),
    autoLink: z.boolean().default(true),
    caseSensitive: z.boolean().default(false),
  }).strict()).max(100).default([]),
  autoLink: z.boolean().default(true),
  category: z.string().trim().min(1).max(80).nullable().default(null),
  frequency: FrequencySchema.default("first_section"),
  isActive: z.boolean().default(true),
  links: z.array(z.object({
    contentId: z.string().uuid(),
    priority: z.number().int().min(-32768).max(32767).default(0),
    sectionAnchor: z.string().trim().min(1).max(160).nullable().default(null),
  }).strict()).max(20).default([]),
  name: z.string().trim().min(1).max(160),
  priority: z.number().int().min(-32768).max(32767).default(0),
  shortDefinition: z.string().trim().min(1).max(1000),
  slug: TermSlugSchema,
}).strict();

function identityRequest(headers: FastifyRequest["headers"]): IdentityRequest {
  const forwardedFor = headers["x-forwarded-for"];
  return {
    authorization: headers.authorization,
    cookie: headers.cookie,
    forwardedFor: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor,
    userAgent: headers["user-agent"],
  };
}

async function requireAdministrator(
  request: FastifyRequest,
  identityProvider: IdentityProvider | undefined,
  contentProvider: ContentProvider | undefined,
) {
  const identity = identityRequest(request.headers);
  if (!identity.authorization && !identity.cookie) {
    return { kind: "error" as const, status: 401, error: "unauthorized" };
  }
  if (!identityProvider || !contentProvider) {
    return { kind: "error" as const, status: 503, error: "content_unavailable" };
  }
  try {
    const user = await identityProvider.getUser(identity);
    if (!user) return { kind: "error" as const, status: 401, error: "unauthorized" };
    const roles = await contentProvider.getRoles(user.id);
    if (!roles.includes("administrator")) {
      return { kind: "error" as const, status: 403, error: "forbidden" };
    }
    return { kind: "success" as const, user };
  } catch {
    return { kind: "error" as const, status: 503, error: "content_unavailable" };
  }
}

function normalizedAlias(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

async function replaceTermRelations(
  database: DatabaseClient,
  termId: string,
  input: z.infer<typeof TermMutationSchema>,
) {
  await database.transaction().execute(async (transaction) => {
    await transaction.deleteFrom("knowledge_term_aliases" as never)
      .where("term_id" as never, "=" as never, termId as never)
      .execute();
    await transaction.deleteFrom("knowledge_term_links" as never)
      .where("term_id" as never, "=" as never, termId as never)
      .execute();

    for (const alias of input.aliases) {
      await sql`
        insert into public.knowledge_term_aliases (
          term_id, alias, normalized_alias, auto_link, case_sensitive
        ) values (
          ${termId}, ${alias.alias}, ${normalizedAlias(alias.alias)}, ${alias.autoLink}, ${alias.caseSensitive}
        )
      `.execute(transaction);
    }
    for (const link of input.links) {
      await sql`
        insert into public.knowledge_term_links (
          term_id, content_item_id, section_anchor, priority
        ) values (
          ${termId}, ${link.contentId}, ${link.sectionAnchor}, ${link.priority}
        )
      `.execute(transaction);
    }
  });
}

async function readTerm(database: DatabaseClient, termId: string) {
  const term = await sql<{
    auto_link: boolean;
    category: string | null;
    frequency: KnowledgeTermFrequency;
    id: string;
    is_active: boolean;
    name: string;
    priority: number;
    short_definition: string;
    slug: string;
  }>`
    select id, slug, name, short_definition, category, is_active, auto_link, frequency, priority
    from public.knowledge_terms
    where id = ${termId}
    limit 1
  `.execute(database);
  const row = term.rows[0];
  if (!row) return null;
  const [aliases, links] = await Promise.all([
    sql<{ alias: string; auto_link: boolean; case_sensitive: boolean }>`
      select alias, auto_link, case_sensitive
      from public.knowledge_term_aliases
      where term_id = ${termId}
      order by char_length(alias) desc, alias asc
    `.execute(database),
    sql<{ content_item_id: string; priority: number; section_anchor: string | null }>`
      select content_item_id, section_anchor, priority
      from public.knowledge_term_links
      where term_id = ${termId}
      order by priority desc, created_at asc
    `.execute(database),
  ]);
  return {
    aliases: aliases.rows.map((alias) => ({
      alias: alias.alias,
      autoLink: alias.auto_link,
      caseSensitive: alias.case_sensitive,
    })),
    autoLink: row.auto_link,
    category: row.category,
    frequency: row.frequency,
    id: row.id,
    isActive: row.is_active,
    links: links.rows.map((link) => ({
      contentId: link.content_item_id,
      priority: Number(link.priority),
      sectionAnchor: link.section_anchor,
    })),
    name: row.name,
    priority: Number(row.priority),
    shortDefinition: row.short_definition,
    slug: row.slug,
  };
}

export async function registerKnowledgeTermRoutes(
  app: FastifyInstance,
  dependencies: {
    contentProvider: ContentProvider | undefined;
    database: DatabaseClient | undefined;
    identityProvider: IdentityProvider | undefined;
  },
) {
  app.get<{ Params: { contentId: string } }>(
    "/v1/content/:contentId/interactive-terms",
    async (request, reply) => {
      if (!dependencies.database) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
      const params = ContentTermParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      try {
        const result = await getContentKnowledgeTerms(dependencies.database, params.data.contentId);
        if (!result) {
          return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
        }
        return reply
          .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
          .send(result);
      } catch (error) {
        request.log.error({ err: error }, "Interactive term lookup failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
    },
  );

  app.get<{ Params: { termId: string } }>(
    "/v1/editor/interactive-terms/:termId",
    async (request, reply) => {
      const administrator = await requireAdministrator(
        request,
        dependencies.identityProvider,
        dependencies.contentProvider,
      );
      if (administrator.kind === "error") {
        return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
      }
      if (!dependencies.database) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
      const params = TermIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      const term = await readTerm(dependencies.database, params.data.termId);
      return term
        ? reply.header("Cache-Control", "no-store").send({ term })
        : reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    },
  );

  app.post<{ Body: unknown }>("/v1/editor/interactive-terms", async (request, reply) => {
    const administrator = await requireAdministrator(
      request,
      dependencies.identityProvider,
      dependencies.contentProvider,
    );
    if (administrator.kind === "error") {
      return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
    }
    if (!dependencies.database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
    const input = TermMutationSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_term" });
    }
    try {
      const inserted = await sql<{ id: string }>`
        insert into public.knowledge_terms (
          slug, name, short_definition, category, is_active, auto_link, frequency, priority
        ) values (
          ${input.data.slug}, ${input.data.name}, ${input.data.shortDefinition}, ${input.data.category},
          ${input.data.isActive}, ${input.data.autoLink}, ${input.data.frequency}, ${input.data.priority}
        ) returning id
      `.execute(dependencies.database);
      const termId = inserted.rows[0]?.id;
      if (!termId) throw new Error("term_insert_failed");
      await replaceTermRelations(dependencies.database, termId, input.data);
      const term = await readTerm(dependencies.database, termId);
      return reply.status(201).header("Cache-Control", "no-store").send({ term });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.status(409).header("Cache-Control", "no-store").send({ error: "term_conflict" });
      }
      request.log.error({ err: error }, "Interactive term creation failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.patch<{ Body: unknown; Params: { termId: string } }>(
    "/v1/editor/interactive-terms/:termId",
    async (request, reply) => {
      const administrator = await requireAdministrator(
        request,
        dependencies.identityProvider,
        dependencies.contentProvider,
      );
      if (administrator.kind === "error") {
        return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
      }
      if (!dependencies.database) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
      const [params, input] = [
        TermIdParamsSchema.safeParse(request.params),
        TermMutationSchema.safeParse(request.body),
      ];
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!input.success) return reply.status(400).send({ error: "invalid_term" });
      try {
        const updated = await sql<{ id: string }>`
          update public.knowledge_terms set
            slug = ${input.data.slug},
            name = ${input.data.name},
            short_definition = ${input.data.shortDefinition},
            category = ${input.data.category},
            is_active = ${input.data.isActive},
            auto_link = ${input.data.autoLink},
            frequency = ${input.data.frequency},
            priority = ${input.data.priority}
          where id = ${params.data.termId}
          returning id
        `.execute(dependencies.database);
        if (!updated.rows[0]) return reply.status(404).send({ error: "not_found" });
        await replaceTermRelations(dependencies.database, params.data.termId, input.data);
        const term = await readTerm(dependencies.database, params.data.termId);
        return reply.header("Cache-Control", "no-store").send({ term });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          return reply.status(409).header("Cache-Control", "no-store").send({ error: "term_conflict" });
        }
        request.log.error({ err: error }, "Interactive term update failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
    },
  );

  app.delete<{ Params: { termId: string } }>(
    "/v1/editor/interactive-terms/:termId",
    async (request, reply) => {
      const administrator = await requireAdministrator(
        request,
        dependencies.identityProvider,
        dependencies.contentProvider,
      );
      if (administrator.kind === "error") {
        return reply.status(administrator.status).header("Cache-Control", "no-store").send({ error: administrator.error });
      }
      if (!dependencies.database) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
      const params = TermIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      const deleted = await sql<{ id: string }>`
        delete from public.knowledge_terms where id = ${params.data.termId} returning id
      `.execute(dependencies.database);
      return deleted.rows[0]
        ? reply.header("Cache-Control", "no-store").send({ id: deleted.rows[0].id })
        : reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    },
  );
}
