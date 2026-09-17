import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import type { DatabaseClient } from "../db/database.js";

type OccurrencePolicy = "all" | "first_per_guide" | "first_per_section";

type DictionaryEntry = {
  normalized: string;
  occurrencePolicy: OccurrencePolicy;
  priority: number;
  termId: string;
};

type AutomatonNode = {
  fail: number;
  next: Map<string, number>;
  outputs: DictionaryEntry[];
};

type PreviewOccurrence = {
  e: number;
  p: string;
  s: number;
  t: string;
};

const PreviewLeafSchema = z.object({
  path: z.string().min(1).max(240),
  section: z.string().max(240).default("__root"),
  text: z.string().max(20_000),
});

const PreviewRequestSchema = z.object({
  leaves: z.array(PreviewLeafSchema).max(8_000),
});

function unavailable(reply: FastifyReply) {
  return reply
    .status(503)
    .header("Cache-Control", "no-store")
    .send({ error: "interactive_term_preview_unavailable" });
}

async function requireAdministrator(app: FastifyInstance, request: FastifyRequest) {
  const headers: Record<string, string> = {};
  if (request.headers.authorization) headers.authorization = request.headers.authorization;
  if (request.headers.cookie) headers.cookie = request.headers.cookie;
  if (!headers.authorization && !headers.cookie) {
    return { error: "unauthorized" as const, status: 401 };
  }

  try {
    const response = await app.inject({ headers, method: "GET", url: "/v1/auth/me" });
    if (response.statusCode === 401) return { error: "unauthorized" as const, status: 401 };
    if (response.statusCode !== 200) return { error: "identity_unavailable" as const, status: 503 };
    const body = response.json() as { roles?: unknown };
    const roles = Array.isArray(body.roles) ? body.roles : [];
    if (!roles.includes("administrator")) return { error: "forbidden" as const, status: 403 };
    return { status: 200 as const };
  } catch {
    return { error: "identity_unavailable" as const, status: 503 };
  }
}

function normalizeTermKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildAutomaton(entries: DictionaryEntry[]): AutomatonNode[] {
  const nodes: AutomatonNode[] = [{ fail: 0, next: new Map(), outputs: [] }];
  for (const entry of entries) {
    let state = 0;
    for (const character of entry.normalized) {
      let next = nodes[state]!.next.get(character);
      if (next === undefined) {
        next = nodes.length;
        nodes[state]!.next.set(character, next);
        nodes.push({ fail: 0, next: new Map(), outputs: [] });
      }
      state = next;
    }
    nodes[state]!.outputs.push(entry);
  }

  const queue: number[] = [];
  for (const child of nodes[0]!.next.values()) queue.push(child);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const state = queue[cursor]!;
    for (const [character, child] of nodes[state]!.next) {
      queue.push(child);
      let fallback = nodes[state]!.fail;
      while (fallback !== 0 && !nodes[fallback]!.next.has(character)) fallback = nodes[fallback]!.fail;
      const transition = nodes[fallback]!.next.get(character);
      nodes[child]!.fail = transition !== undefined && transition !== child ? transition : 0;
      nodes[child]!.outputs.push(...nodes[nodes[child]!.fail]!.outputs);
    }
  }
  return nodes;
}

function normalizeWithSourceMap(value: string) {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let sourceOffset = 0;
  let previousSpace = false;

  for (const character of value) {
    const sourceStart = sourceOffset;
    sourceOffset += character.length;
    const folded = character
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]/g, " ");
    for (const rawCharacter of folded) {
      const outputCharacter = /[a-z0-9]/.test(rawCharacter) ? rawCharacter : " ";
      if (outputCharacter === " " && previousSpace) continue;
      normalized += outputCharacter;
      starts.push(sourceStart);
      ends.push(sourceOffset);
      previousSpace = outputCharacter === " ";
    }
  }
  return { normalized, starts, ends };
}

function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[a-z0-9]/.test(value));
}

function findTextMatches(value: string, automaton: AutomatonNode[]) {
  const normalizedText = normalizeWithSourceMap(value);
  const matches: Array<PreviewOccurrence & {
    length: number;
    policy: OccurrencePolicy;
    priority: number;
  }> = [];
  let state = 0;

  for (let index = 0; index < normalizedText.normalized.length; index += 1) {
    const character = normalizedText.normalized[index]!;
    while (state !== 0 && !automaton[state]!.next.has(character)) state = automaton[state]!.fail;
    state = automaton[state]!.next.get(character) ?? 0;

    for (const output of automaton[state]!.outputs) {
      const normalizedStart = index - output.normalized.length + 1;
      if (normalizedStart < 0) continue;
      const before = normalizedText.normalized[normalizedStart - 1];
      const after = normalizedText.normalized[index + 1];
      if (isWordCharacter(before) || isWordCharacter(after)) continue;
      const sourceStart = normalizedText.starts[normalizedStart];
      const sourceEnd = normalizedText.ends[index];
      if (sourceStart === undefined || sourceEnd === undefined || sourceEnd <= sourceStart) continue;
      matches.push({
        e: sourceEnd,
        length: sourceEnd - sourceStart,
        p: "",
        policy: output.occurrencePolicy,
        priority: output.priority,
        s: sourceStart,
        t: output.termId,
      });
    }
  }

  const sorted = matches.sort(
    (left, right) => left.s - right.s || right.length - left.length || right.priority - left.priority,
  );
  const accepted: typeof sorted = [];
  for (const candidate of sorted) {
    if (accepted.some((current) => current.s < candidate.e && candidate.s < current.e)) continue;
    accepted.push(candidate);
  }
  return accepted;
}

async function loadDictionary(database: DatabaseClient) {
  const [revisionResult, patternResult] = await Promise.all([
    sql<{ revision: number | string }>`
      select revision
      from public.interactive_term_dictionary_state
      where singleton = true
    `.execute(database),
    sql<{
      occurrence_policy: OccurrencePolicy;
      pattern: string;
      priority: number;
      source_rank: number;
      term_id: string;
    }>`
      select id as term_id, name as pattern, occurrence_policy, priority, 1 as source_rank
      from public.interactive_terms
      where is_active = true and auto_match = true
      union all
      select term.id as term_id, alias.alias as pattern, term.occurrence_policy,
             term.priority, 0 as source_rank
      from public.interactive_term_aliases as alias
      join public.interactive_terms as term on term.id = alias.term_id
      where term.is_active = true and term.auto_match = true and alias.auto_match = true
    `.execute(database),
  ]);

  const byPattern = new Map<string, DictionaryEntry & { sourceRank: number }>();
  for (const row of patternResult.rows) {
    const normalized = normalizeTermKey(row.pattern);
    if (normalized.length < 2) continue;
    const candidate = {
      normalized,
      occurrencePolicy: row.occurrence_policy,
      priority: Number(row.priority),
      sourceRank: Number(row.source_rank),
      termId: row.term_id,
    };
    const current = byPattern.get(normalized);
    if (
      !current
      || candidate.priority > current.priority
      || (candidate.priority === current.priority && candidate.sourceRank > current.sourceRank)
    ) byPattern.set(normalized, candidate);
  }

  const entries: DictionaryEntry[] = [...byPattern.values()].map((entry) => ({
    normalized: entry.normalized,
    occurrencePolicy: entry.occurrencePolicy,
    priority: entry.priority,
    termId: entry.termId,
  }));

  return {
    automaton: buildAutomaton(entries),
    revision: Number(revisionResult.rows[0]?.revision ?? 1),
  };
}

async function buildPreview(database: DatabaseClient, leaves: z.infer<typeof PreviewLeafSchema>[]) {
  const dictionary = await loadDictionary(database);
  const candidates: Array<PreviewOccurrence & { policy: OccurrencePolicy; section: string }> = [];

  for (const leaf of leaves) {
    for (const match of findTextMatches(leaf.text, dictionary.automaton)) {
      candidates.push({ ...match, p: leaf.path, section: leaf.section });
    }
  }

  const seenGuide = new Set<string>();
  const seenSection = new Set<string>();
  const occurrences = candidates
    .filter((occurrence) => {
      if (occurrence.policy === "all") return true;
      if (occurrence.policy === "first_per_guide") {
        if (seenGuide.has(occurrence.t)) return false;
        seenGuide.add(occurrence.t);
        return true;
      }
      const key = `${occurrence.section}\u0000${occurrence.t}`;
      if (seenSection.has(key)) return false;
      seenSection.add(key);
      return true;
    })
    .map(({ e, p, s, t }) => ({ e, p, s, t }));

  const termIds = [...new Set(occurrences.map((occurrence) => occurrence.t))];
  if (termIds.length === 0) {
    return { dictionaryRevision: dictionary.revision, occurrences, terms: [] };
  }

  const termsResult = await sql<{
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
    from public.interactive_terms as term
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
    where term.id = any(${sql.val(termIds)}::uuid[])
      and term.is_active = true
    order by term.name asc
  `.execute(database);

  return {
    dictionaryRevision: dictionary.revision,
    occurrences,
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
  };
}

export function registerInteractiveTermPreviewRoutes(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  app.post<{ Body: unknown }>("/v1/admin/interactive-terms/preview", async (request, reply) => {
    const administrator = await requireAdministrator(app, request);
    if (administrator.status !== 200) {
      return reply
        .status(administrator.status)
        .header("Cache-Control", "no-store")
        .send({ error: administrator.error });
    }
    if (!database) return unavailable(reply);

    const input = PreviewRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_interactive_term_preview" });
    }

    try {
      const preview = await buildPreview(database, input.data.leaves);
      return reply.header("Cache-Control", "no-store").send({
        contentId: "00000000-0000-0000-0000-000000000000",
        contentVersion: 1,
        dictionaryRevision: preview.dictionaryRevision,
        occurrences: preview.occurrences,
        sections: [],
        terms: preview.terms,
      });
    } catch (error) {
      request.log.error({ err: error }, "Interactive-term editor preview failed");
      return unavailable(reply);
    }
  });
}
