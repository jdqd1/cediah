import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import type { DatabaseClient } from "../db/database.js";

type SuggestionExample = {
  guideSlug: string;
  guideTitle: string;
  sectionAnchor: string;
  sectionHeading: string;
};

type SuggestionRow = {
  examples: SuggestionExample[];
  guide_count: number | string;
  heading: string;
  heading_key: string;
  section_count: number | string;
};

const SuggestionQuerySchema = z.object({
  includeGeneric: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  minGuides: z.coerce.number().int().min(1).max(100).default(2),
  q: z.string().trim().max(180).optional(),
});

const genericHeadingKeys = new Set([
  "anatomia clinica aplicada",
  "anatomia de superficie",
  "anatomia funcional",
  "bordes",
  "caras",
  "conclusiones",
  "configuracion externa",
  "contenido",
  "correlaciones clinicas",
  "drenaje linfatico",
  "drenaje venoso",
  "estructura de la pared",
  "generalidades",
  "identificacion microscopica",
  "inervacion",
  "introduccion",
  "irrigacion arterial",
  "limites",
  "medios de fijacion",
  "objetivos",
  "organizacion general",
  "plano profundo",
  "plano superficial",
  "reconocimiento microscopico",
  "referencias",
  "relacion entre estructura y funcion",
  "relaciones",
  "resumen",
  "situacion y relaciones",
  "vascularizacion",
]);

const genericPrefixes = [
  "borde ",
  "cara ",
  "correlaciones ",
  "pared ",
  "relaciones ",
];

export function isGenericInteractiveTermHeading(headingKey: string) {
  return genericHeadingKeys.has(headingKey)
    || genericPrefixes.some((prefix) => headingKey.startsWith(prefix));
}

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

async function loadSuggestions(
  database: DatabaseClient,
  input: z.infer<typeof SuggestionQuerySchema>,
) {
  const search = input.q?.trim() || null;
  const candidateLimit = Math.min(Math.max(input.limit * 8, 80), 600);
  const result = await sql<SuggestionRow>`
    with grouped as (
      select section.heading_key,
             min(section.heading) as heading,
             count(*)::int as section_count,
             count(distinct section.content_item_id)::int as guide_count
      from public.guide_sections as section
      join public.content_items as guide on guide.id = section.content_item_id
      where guide.kind = 'guide'
        and guide.status = 'published'
        and char_length(btrim(section.heading)) between 2 and 180
        and (${search}::text is null or section.heading ilike '%' || ${search} || '%')
        and not exists (
          select 1
          from public.interactive_terms as term
          where term.normalized_name = section.heading_key
        )
        and not exists (
          select 1
          from public.interactive_term_aliases as alias
          where alias.normalized_alias = section.heading_key
        )
      group by section.heading_key
      having count(distinct section.content_item_id) >= ${input.minGuides}
      order by count(distinct section.content_item_id) desc,
               count(*) desc,
               char_length(min(section.heading)) asc
      limit ${candidateLimit}
    )
    select grouped.heading_key,
           grouped.heading,
           grouped.section_count,
           grouped.guide_count,
           coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'guideSlug', example.guide_slug,
                 'guideTitle', example.guide_title,
                 'sectionAnchor', example.section_anchor,
                 'sectionHeading', example.section_heading
               ) order by example.updated_at desc, example.ordinal asc
             )
             from (
               select guide.slug as guide_slug,
                      guide.title as guide_title,
                      section.anchor as section_anchor,
                      section.heading as section_heading,
                      guide.updated_at,
                      section.ordinal
               from public.guide_sections as section
               join public.content_items as guide on guide.id = section.content_item_id
               where section.heading_key = grouped.heading_key
                 and guide.kind = 'guide'
                 and guide.status = 'published'
               order by guide.updated_at desc, section.ordinal asc
               limit 3
             ) as example
           ), '[]'::jsonb) as examples
    from grouped
    order by grouped.guide_count desc,
             grouped.section_count desc,
             char_length(grouped.heading) asc
  `.execute(database);

  return result.rows
    .map((row) => ({
      examples: row.examples ?? [],
      generic: isGenericInteractiveTermHeading(row.heading_key),
      guideCount: Number(row.guide_count),
      name: row.heading,
      normalizedKey: row.heading_key,
      sectionCount: Number(row.section_count),
    }))
    .filter((suggestion) => input.includeGeneric === "true" || !suggestion.generic)
    .slice(0, input.limit);
}

export function registerInteractiveTermSuggestionRoutes(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  app.get("/v1/admin/interactive-term-suggestions", async (request, reply) => {
    const administrator = await requireAdministrator(app, request);
    if (administrator.status !== 200) {
      return reply
        .status(administrator.status)
        .header("Cache-Control", "no-store")
        .send({ error: administrator.error });
    }
    if (!database) return unavailable(reply);

    const query = SuggestionQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_interactive_term_suggestion_query" });
    }

    try {
      const suggestions = await loadSuggestions(database, query.data);
      return reply
        .header("Cache-Control", "no-store")
        .send({ suggestions });
    } catch (error) {
      request.log.error({ err: error }, "Interactive-term suggestions failed");
      return unavailable(reply);
    }
  });
}
