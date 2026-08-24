import { createClient } from "@supabase/supabase-js";
import {
  SubjectSchema,
  type SubjectProvider,
} from "@cediah/contracts";
import type { SupabaseStorageConfiguration } from "../config.js";

const subjectSelection = "id, slug, name";

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isUniqueConflict(error: unknown) {
  return asRecord(error)?.code === "23505";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createSupabaseSubjectProvider(
  configuration: SupabaseStorageConfiguration,
): SubjectProvider {
  const client = createClient(configuration.url, configuration.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  async function countContentBySubject(
    subjectIds: string[],
    publishedOnly: boolean,
  ) {
    const counts = new Map<string, number>();
    if (subjectIds.length === 0) return counts;

    const { data: relationData, error: relationError } = await client
      .from("content_subjects")
      .select("subject_id, content_item_id")
      .in("subject_id", subjectIds);
    if (relationError) throw relationError;

    const relations = asArray(relationData)
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => Boolean(row));
    const contentIds = Array.from(
      new Set(
        relations
          .map((row) => readString(row.content_item_id))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (contentIds.length === 0) return counts;

    let contentQuery = client
      .from("content_items")
      .select("id, status")
      .in("id", contentIds);
    if (publishedOnly) contentQuery = contentQuery.eq("status", "published");

    const { data: contentData, error: contentError } = await contentQuery;
    if (contentError) throw contentError;

    const allowedContentIds = new Set(
      asArray(contentData)
        .map(asRecord)
        .filter((row): row is Record<string, unknown> => Boolean(row))
        .map((row) => readString(row.id))
        .filter((id): id is string => Boolean(id)),
    );

    for (const relation of relations) {
      const subjectId = readString(relation.subject_id);
      const contentId = readString(relation.content_item_id);
      if (!subjectId || !contentId || !allowedContentIds.has(contentId)) continue;
      counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1);
    }

    return counts;
  }

  async function listSubjects(input: { publishedOnly?: boolean } = {}) {
    const { data, error } = await client
      .from("subjects")
      .select(subjectSelection)
      .order("name", { ascending: true });
    if (error) throw error;

    const rows = asArray(data)
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => Boolean(row));
    const ids = rows
      .map((row) => readString(row.id))
      .filter((id): id is string => Boolean(id));
    const counts = await countContentBySubject(ids, input.publishedOnly ?? false);

    return rows.map((row) =>
      SubjectSchema.parse({
        contentCount: counts.get(readString(row.id) ?? "") ?? 0,
        id: row.id,
        name: row.name,
        slug: row.slug,
      }),
    );
  }

  return {
    async createSubject(input) {
      const name = input.name.trim();
      const slug = slugify(name);
      if (!slug) return { status: "conflict" };

      const { data, error } = await client
        .from("subjects")
        .insert({ name, slug })
        .select(subjectSelection)
        .single();
      if (error) {
        if (isUniqueConflict(error)) return { status: "conflict" };
        throw error;
      }

      const row = asRecord(data);
      const subject = SubjectSchema.parse({
        contentCount: 0,
        id: row?.id,
        name: row?.name,
        slug: row?.slug,
      });
      const { error: auditError } = await client.from("audit_log").insert({
        action: "subject_created",
        actor_user_id: input.actorUserId,
        metadata: { slug: subject.slug },
        target_id: subject.id,
        target_type: "subject",
      });
      if (auditError) throw auditError;

      return { status: "success", value: subject };
    },

    async deleteSubject(input) {
      const { data, error } = await client
        .from("subjects")
        .delete()
        .eq("id", input.subjectId)
        .select(subjectSelection)
        .maybeSingle();
      if (error) throw error;

      const row = asRecord(data);
      const deletedId = readString(row?.id);
      if (!deletedId) return { status: "not_found" };

      try {
        const { error: auditError } = await client.from("audit_log").insert({
          action: "subject_deleted",
          actor_user_id: input.actorUserId,
          metadata: {
            name: readString(row?.name),
            slug: readString(row?.slug),
          },
          target_id: deletedId,
          target_type: "subject",
        });
        if (auditError) throw auditError;
      } catch {
        // The subject is already deleted; audit availability must not turn a
        // completed destructive action into a misleading error response.
      }

      return { status: "success", value: { id: deletedId } };
    },

    async getSubjectBySlug(slug) {
      const subjects = await listSubjects({ publishedOnly: true });
      return subjects.find((subject) => subject.slug === slug) ?? null;
    },

    listSubjects,
  };
}
