import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql, type Transaction } from "kysely";
import { z } from "zod";
import type { CediahDatabase, DatabaseClient } from "../db/database.js";

type DatabaseExecutor = DatabaseClient | Transaction<CediahDatabase>;

type AdminTermAlias = {
  alias: string;
  autoMatch: boolean;
  id: string;
};

type AdminTermDestination = {
  guideId: string;
  guideSlug: string;
  guideTitle: string;
  id: string;
  primary: boolean;
  priority: number;
  sectionAnchor: string | null;
  sectionHeading: string | null;
};

type AdminTermRow = {
  aliases: AdminTermAlias[];
  auto_match: boolean;
  category: string | null;
  created_at: Date | string;
  destinations: AdminTermDestination[];
  id: string;
  is_active: boolean;
  name: string;
  occurrence_policy: "all" | "first_per_guide" | "first_per_section";
  priority: number;
  short_definition: string;
  slug: string;
  updated_at: Date | string;
  usage_count: number | string;
};

const SlugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180);
const OccurrencePolicySchema = z.enum(["first_per_section", "first_per_guide", "all"]);
const AliasSchema = z.object({
  alias: z.string().trim().min(1).max(180),
  autoMatch: z.boolean().default(true),
});
const DestinationSchema = z.object({
  guideSlug: SlugSchema,
  primary: z.boolean().default(false),
  priority: z.number().int().min(-1_000).max(1_000).default(0),
  sectionAnchor: z.string().trim().min(1).max(180).nullable().optional(),
});
const TermWriteSchema = z.object({
  aliases: z.array(AliasSchema).max(80).default([]),
  autoMatch: z.boolean().default(true),
  category: z.string().trim().max(120).nullable().default(null),
  destinations: z.array(DestinationSchema).max(30).default([]),
  isActive: z.boolean().default(true),
  name: z.string().trim().min(1).max(180),
  occurrencePolicy: OccurrencePolicySchema.default("first_per_section"),
  priority: z.number().int().min(-1_000).max(1_000).default(0),
  shortDefinition: z.string().trim().min(1).max(1_200),
  slug: SlugSchema,
}).superRefine((value, context) => {
  if (value.destinations.filter((destination) => destination.primary).length > 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only one primary destination is allowed.",
      path: ["destinations"],
    });
  }
});
const TermIdParamsSchema = z.object({ termId: z.string().uuid() });
const TermListQuerySchema = z.object({
  active: z.enum(["all", "true", "false"]).default("all"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  q: z.string().trim().max(200).optional(),
});

function unavailable(reply: FastifyReply) {
  return reply
    .status(503)
    .header("Cache-Control", "no-store")
    .send({ error: "interactive_term_admin_unavailable" });
}

async function requireAdministrator(app: FastifyInstance, request: FastifyRequest) {
  const headers: Record<string, string> = {};
  if (request.headers.authorization) headers.authorization = request.headers.authorization;
  if (request.headers.cookie) headers.cookie = request.headers.cookie;
  if (!headers.authorization && !headers.cookie) {
    return { error: "unauthorized" as const, status: 401 };
  }

  try {
    const response = await app.inject({
      headers,
      method: "GET",
      url: "/v1/auth/me",
    });
    if (response.statusCode === 401) return { error: "unauthorized" as const, status: 401 };
    if (response.statusCode !== 200) {
      return { error: "identity_unavailable" as const, status: 503 };
    }
    const body = response.json() as { roles?: unknown };
    const roles = Array.isArray(body.roles) ? body.roles : [];
    if (!roles.includes("administrator")) {
      return { error: "forbidden" as const, status: 403 };
    }
    return { status: 200 as const };
  } catch {
    return { error: "identity_unavailable" as const, status: 503 };
  }
}

function serializeTerm(row: AdminTermRow) {
  return {
    aliases: row.aliases ?? [],
    autoMatch: row.auto_match,
    category: row.category,
    createdAt: new Date(row.created_at).toISOString(),
    destinations: row.destinations ?? [],
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    occurrencePolicy: row.occurrence_policy,
    priority: row.priority,
    shortDefinition: row.short_definition,
    slug: row.slug,
    updatedAt: new Date(row.updated_at).toISOString(),
    usageCount: Number(row.usage_count),
  };
}

async function loadTerm(database: DatabaseExecutor, termId: string) {
  const result = await sql<AdminTermRow>`
    select term.id,
           term.slug,
           term.name,
           term.short_definition,
           term.category,
           term.priority,
           term.occurrence_policy,
           term.auto_match,
           term.is_active,
           term.created_at,
           term.updated_at,
           coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'id', alias.id,
                 'alias', alias.alias,
                 'autoMatch', alias.auto_match
               ) order by alias.alias asc
             )
             from public.interactive_term_aliases as alias
             where alias.term_id = term.id
           ), '[]'::jsonb) as aliases,
           coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'id', link.id,
                 'guideId', guide.id,
                 'guideSlug', guide.slug,
                 'guideTitle', guide.title,
                 'sectionAnchor', section.anchor,
                 'sectionHeading', section.heading,
                 'primary', link.is_primary,
                 'priority', link.priority
               ) order by link.is_primary desc, link.priority desc, guide.title asc
             )
             from public.interactive_term_links as link
             join public.content_items as guide on guide.id = link.guide_id
             left join public.guide_sections as section on section.id = link.section_id
             where link.term_id = term.id
           ), '[]'::jsonb) as destinations,
           coalesce((
             select sum(usage.occurrence_count)
             from public.guide_term_usage as usage
             where usage.term_id = term.id
           ), 0) as usage_count
    from public.interactive_terms as term
    where term.id = ${termId}
    limit 1
  `.execute(database);
  return result.rows[0] ?? null;
}

async function listTerms(
  database: DatabaseExecutor,
  input: z.infer<typeof TermListQuerySchema>,
) {
  const query = input.q?.trim() || null;
  const active = input.active === "all" ? null : input.active === "true";
  const result = await sql<AdminTermRow>`
    select term.id,
           term.slug,
           term.name,
           term.short_definition,
           term.category,
           term.priority,
           term.occurrence_policy,
           term.auto_match,
           term.is_active,
           term.created_at,
           term.updated_at,
           coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'id', alias.id,
                 'alias', alias.alias,
                 'autoMatch', alias.auto_match
               ) order by alias.alias asc
             )
             from public.interactive_term_aliases as alias
             where alias.term_id = term.id
           ), '[]'::jsonb) as aliases,
           coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'id', link.id,
                 'guideId', guide.id,
                 'guideSlug', guide.slug,
                 'guideTitle', guide.title,
                 'sectionAnchor', section.anchor,
                 'sectionHeading', section.heading,
                 'primary', link.is_primary,
                 'priority', link.priority
               ) order by link.is_primary desc, link.priority desc, guide.title asc
             )
             from public.interactive_term_links as link
             join public.content_items as guide on guide.id = link.guide_id
             left join public.guide_sections as section on section.id = link.section_id
             where link.term_id = term.id
           ), '[]'::jsonb) as destinations,
           coalesce((
             select sum(usage.occurrence_count)
             from public.guide_term_usage as usage
             where usage.term_id = term.id
           ), 0) as usage_count
    from public.interactive_terms as term
    where (
      ${query}::text is null
      or term.name ilike '%' || ${query} || '%'
      or term.slug ilike '%' || ${query} || '%'
      or coalesce(term.category, '') ilike '%' || ${query} || '%'
      or term.short_definition ilike '%' || ${query} || '%'
      or exists (
        select 1
        from public.interactive_term_aliases as alias_search
        where alias_search.term_id = term.id
          and alias_search.alias ilike '%' || ${query} || '%'
      )
    )
      and (${active}::boolean is null or term.is_active = ${active})
    order by term.is_active desc, term.updated_at desc, term.name asc
    limit ${input.limit}
  `.execute(database);
  return result.rows.map(serializeTerm);
}

async function syncRelations(
  database: DatabaseExecutor,
  termId: string,
  input: z.infer<typeof TermWriteSchema>,
) {
  await sql`delete from public.interactive_term_aliases where term_id = ${termId}`.execute(database);
  for (const alias of input.aliases) {
    await sql`
      insert into public.interactive_term_aliases (term_id, alias, auto_match)
      values (${termId}, ${alias.alias}, ${alias.autoMatch})
    `.execute(database);
  }

  await sql`delete from public.interactive_term_links where term_id = ${termId}`.execute(database);
  for (const destination of input.destinations) {
    const guideResult = await sql<{ id: string }>`
      select id
      from public.content_items
      where slug = ${destination.guideSlug}
        and kind = 'guide'
      limit 1
    `.execute(database);
    const guideId = guideResult.rows[0]?.id;
    if (!guideId) throw new Error("interactive_term_guide_not_found");

    let sectionId: string | null = null;
    if (destination.sectionAnchor) {
      const sectionResult = await sql<{ id: string }>`
        select id
        from public.guide_sections
        where content_item_id = ${guideId}
          and anchor = ${destination.sectionAnchor}
        limit 1
      `.execute(database);
      sectionId = sectionResult.rows[0]?.id ?? null;
      if (!sectionId) throw new Error("interactive_term_section_not_found");
    }

    await sql`
      insert into public.interactive_term_links (
        term_id,
        guide_id,
        section_id,
        is_primary,
        priority
      ) values (
        ${termId},
        ${guideId},
        ${sectionId},
        ${destination.primary},
        ${destination.priority}
      )
    `.execute(database);
  }
}

function mutationError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "interactive_term_guide_not_found") {
      return { error: error.message, status: 400 };
    }
    if (error.message === "interactive_term_section_not_found") {
      return { error: error.message, status: 400 };
    }
  }
  if (
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "23505"
  ) {
    return { error: "interactive_term_conflict", status: 409 };
  }
  return null;
}

export function registerInteractiveTermAdminRoutes(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  app.get("/v1/admin/interactive-terms", async (request, reply) => {
    const administrator = await requireAdministrator(app, request);
    if (administrator.status !== 200) {
      return reply
        .status(administrator.status)
        .header("Cache-Control", "no-store")
        .send({ error: administrator.error });
    }
    if (!database) return unavailable(reply);

    const query = TermListQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_interactive_term_query" });
    }

    try {
      const terms = await listTerms(database, query.data);
      return reply.header("Cache-Control", "no-store").send({ terms });
    } catch (error) {
      request.log.error({ err: error }, "Interactive-term admin list failed");
      return unavailable(reply);
    }
  });

  app.post<{ Body: unknown }>("/v1/admin/interactive-terms", async (request, reply) => {
    const administrator = await requireAdministrator(app, request);
    if (administrator.status !== 200) {
      return reply
        .status(administrator.status)
        .header("Cache-Control", "no-store")
        .send({ error: administrator.error });
    }
    if (!database) return unavailable(reply);

    const input = TermWriteSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_interactive_term" });
    }

    try {
      const term = await database.transaction().execute(async (transaction) => {
        const inserted = await sql<{ id: string }>`
          insert into public.interactive_terms (
            slug,
            name,
            short_definition,
            category,
            priority,
            occurrence_policy,
            auto_match,
            is_active
          ) values (
            ${input.data.slug},
            ${input.data.name},
            ${input.data.shortDefinition},
            ${input.data.category || null},
            ${input.data.priority},
            ${input.data.occurrencePolicy},
            ${input.data.autoMatch},
            ${input.data.isActive}
          )
          returning id
        `.execute(transaction);
        const termId = inserted.rows[0]?.id;
        if (!termId) throw new Error("interactive_term_create_failed");
        await syncRelations(transaction, termId, input.data);
        const row = await loadTerm(transaction, termId);
        if (!row) throw new Error("interactive_term_create_failed");
        return serializeTerm(row);
      });
      return reply.status(201).header("Cache-Control", "no-store").send({ term });
    } catch (error) {
      const known = mutationError(error);
      if (known) return reply.status(known.status).header("Cache-Control", "no-store").send({ error: known.error });
      request.log.error({ err: error }, "Interactive-term admin create failed");
      return unavailable(reply);
    }
  });

  app.patch<{ Body: unknown; Params: { termId: string } }>(
    "/v1/admin/interactive-terms/:termId",
    async (request, reply) => {
      const administrator = await requireAdministrator(app, request);
      if (administrator.status !== 200) {
        return reply
          .status(administrator.status)
          .header("Cache-Control", "no-store")
          .send({ error: administrator.error });
      }
      if (!database) return unavailable(reply);

      const params = TermIdParamsSchema.safeParse(request.params);
      const input = TermWriteSchema.safeParse(request.body);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      if (!input.success) {
        return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_interactive_term" });
      }

      try {
        const term = await database.transaction().execute(async (transaction) => {
          const updated = await sql<{ id: string }>`
            update public.interactive_terms
            set slug = ${input.data.slug},
                name = ${input.data.name},
                short_definition = ${input.data.shortDefinition},
                category = ${input.data.category || null},
                priority = ${input.data.priority},
                occurrence_policy = ${input.data.occurrencePolicy},
                auto_match = ${input.data.autoMatch},
                is_active = ${input.data.isActive},
                updated_at = now()
            where id = ${params.data.termId}
            returning id
          `.execute(transaction);
          if (!updated.rows[0]) return null;
          await syncRelations(transaction, params.data.termId, input.data);
          const row = await loadTerm(transaction, params.data.termId);
          return row ? serializeTerm(row) : null;
        });
        if (!term) {
          return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
        }
        return reply.header("Cache-Control", "no-store").send({ term });
      } catch (error) {
        const known = mutationError(error);
        if (known) return reply.status(known.status).header("Cache-Control", "no-store").send({ error: known.error });
        request.log.error({ err: error }, "Interactive-term admin update failed");
        return unavailable(reply);
      }
    },
  );
}
