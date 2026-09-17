import type { FastifyInstance, FastifyReply } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import type { DatabaseClient } from "../db/database.js";
import { ensurePublishedGuideManifest } from "./indexer.js";

const GuideSlugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const TermIdParamsSchema = z.object({ termId: z.string().uuid() });

type CompactOccurrence = {
  e: number;
  p: string;
  s: number;
  t: string;
};

function unavailable(reply: FastifyReply) {
  return reply
    .status(503)
    .header("Cache-Control", "no-store")
    .send({ error: "interactive_terms_unavailable" });
}

export function registerInteractiveTermRoutes(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  app.get<{ Params: { slug: string } }>("/v1/guide-terms/:slug", async (request, reply) => {
    if (!database) return unavailable(reply);
    const params = GuideSlugParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    try {
      const contentId = await ensurePublishedGuideManifest(database, params.data.slug);
      if (!contentId) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      const [manifestResult, sectionsResult, termsResult] = await Promise.all([
        sql<{
          content_version: number;
          dictionary_revision: string | number;
          occurrences: CompactOccurrence[];
        }>`
          select content_version, dictionary_revision, occurrences
          from public.guide_term_manifests
          where content_item_id = ${contentId}
        `.execute(database),
        sql<{ anchor: string; node_path: string }>`
          select anchor, node_path
          from public.guide_sections
          where content_item_id = ${contentId}
          order by ordinal asc
        `.execute(database),
        sql<{
          category: string | null;
          guide_slug: string | null;
          guide_title: string | null;
          id: string;
          name: string;
          section_anchor: string | null;
          section_heading: string | null;
          short_definition: string;
          slug: string;
        }>`
          select term.id,
                 term.slug,
                 term.name,
                 term.short_definition,
                 term.category,
                 destination.guide_slug,
                 destination.guide_title,
                 destination.section_anchor,
                 destination.section_heading
          from public.guide_term_usage as usage
          join public.interactive_terms as term on term.id = usage.term_id
          left join lateral (
            select guide.slug as guide_slug,
                   guide.title as guide_title,
                   section.anchor as section_anchor,
                   section.heading as section_heading
            from public.interactive_term_links as link
            join public.content_items as guide on guide.id = link.guide_id
            left join public.guide_sections as section on section.id = link.section_id
            where link.term_id = term.id
              and guide.kind = 'guide'
              and guide.status = 'published'
              and guide.catalog_visibility = 'catalog'
            order by link.is_primary desc, link.priority desc, link.created_at asc
            limit 1
          ) as destination on true
          where usage.content_item_id = ${contentId}
            and term.is_active = true
          order by term.name asc
        `.execute(database),
      ]);

      const manifest = manifestResult.rows[0];
      if (!manifest) return unavailable(reply);
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send({
          contentId,
          contentVersion: manifest.content_version,
          dictionaryRevision: Number(manifest.dictionary_revision),
          occurrences: manifest.occurrences ?? [],
          sections: sectionsResult.rows.map((section) => ({
            anchor: section.anchor,
            path: section.node_path,
          })),
          terms: termsResult.rows.map((term) => ({
            category: term.category,
            id: term.id,
            name: term.name,
            primaryLink: term.guide_slug
              ? {
                  guideSlug: term.guide_slug,
                  guideTitle: term.guide_title ?? term.guide_slug,
                  sectionAnchor: term.section_anchor,
                  sectionHeading: term.section_heading,
                }
              : null,
            shortDefinition: term.short_definition,
            slug: term.slug,
          })),
        });
    } catch (error) {
      request.log.error({ err: error }, "Guide interactive-term manifest request failed");
      return unavailable(reply);
    }
  });

  app.get<{ Params: { termId: string } }>("/v1/terms/:termId", async (request, reply) => {
    if (!database) return unavailable(reply);
    const params = TermIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    try {
      const termResult = await sql<{
        category: string | null;
        id: string;
        name: string;
        short_definition: string;
        slug: string;
      }>`
        select id, slug, name, short_definition, category
        from public.interactive_terms
        where id = ${params.data.termId} and is_active = true
        limit 1
      `.execute(database);
      const term = termResult.rows[0];
      if (!term) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      const links = await sql<{
        guide_slug: string;
        guide_title: string;
        is_primary: boolean;
        section_anchor: string | null;
        section_heading: string | null;
      }>`
        select guide.slug as guide_slug,
               guide.title as guide_title,
               link.is_primary,
               section.anchor as section_anchor,
               section.heading as section_heading
        from public.interactive_term_links as link
        join public.content_items as guide on guide.id = link.guide_id
        left join public.guide_sections as section on section.id = link.section_id
        where link.term_id = ${term.id}
          and guide.kind = 'guide'
          and guide.status = 'published'
          and guide.catalog_visibility = 'catalog'
        order by link.is_primary desc, link.priority desc, link.created_at asc
      `.execute(database);

      return reply
        .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
        .send({
          term: {
            category: term.category,
            id: term.id,
            links: links.rows.map((link) => ({
              guideSlug: link.guide_slug,
              guideTitle: link.guide_title,
              primary: link.is_primary,
              sectionAnchor: link.section_anchor,
              sectionHeading: link.section_heading,
            })),
            name: term.name,
            shortDefinition: term.short_definition,
            slug: term.slug,
          },
        });
    } catch (error) {
      request.log.error({ err: error }, "Interactive-term detail request failed");
      return unavailable(reply);
    }
  });
}
