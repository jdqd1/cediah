import { sql, type Transaction } from "kysely";
import type { ContentStatus, ContentTopic } from "@cediah/contracts";
import type { CediahDatabase, DatabaseClient, JsonValue } from "./db/database.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;
type TopicMutationResult =
  | { status: "success"; value: ContentTopic }
  | { status: "conflict" }
  | { status: "in_use" }
  | { status: "not_found" };

type TopicItemOrderMutationResult =
  | { status: "success"; value: { contentIds: string[]; subjectId: string; topic: string } }
  | { status: "conflict" }
  | { status: "not_found" };

export type ContentTopicItemOrder = {
  contentIds: string[];
  topic: string;
};

export type ContentTopicItemSummary = {
  id: string;
  kind: "guide" | "video";
  status: ContentStatus;
  subjectIds: string[];
  title: string;
  topics: string[];
};

export type ContentTopicTaxonomySummary = {
  name: string;
  subjectIds: string[];
};

function normalizeTopic(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("es");
}

function contentTopics(content: JsonValue, fallback: string) {
  const regions =
    content && typeof content === "object" && !Array.isArray(content)
      ? content.regions
      : null;
  const values = Array.isArray(regions) ? regions : [];
  const topics = values.filter((value): value is string => typeof value === "string");
  if (fallback.trim()) topics.push(fallback);

  const unique = new Map<string, string>();
  for (const topic of topics) {
    const cleaned = topic.trim();
    const normalized = normalizeTopic(cleaned);
    if (cleaned && normalized && !unique.has(normalized)) unique.set(normalized, cleaned);
  }
  return [...unique.values()];
}

function renameTopicReferences(content: JsonValue, previousName: string, name: string) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return { changed: false, content };
  }
  if (!Array.isArray(content.regions)) return { changed: false, content };

  const previous = normalizeTopic(previousName);
  let changed = false;
  const unique = new Map<string, JsonValue>();
  for (const value of content.regions) {
    const nextValue =
      typeof value === "string" && normalizeTopic(value) === previous
        ? name
        : value;
    if (nextValue !== value) changed = true;
    const key = typeof nextValue === "string"
      ? `string:${normalizeTopic(nextValue)}`
      : `json:${JSON.stringify(nextValue)}`;
    if (!unique.has(key)) unique.set(key, nextValue);
    else changed = true;
  }
  if (!changed) return { changed: false, content };

  return {
    changed: true,
    content: { ...content, regions: [...unique.values()] } as JsonValue,
  };
}

async function subjectIdsForTopic(database: QueryDatabase, topicId: string) {
  const links = await sql<{ subject_id: string }>`
    select subject_id
    from public.content_topic_subjects
    where topic_id = ${topicId}
    order by subject_id asc
  `.execute(database);
  return links.rows.map((row) => row.subject_id);
}

async function contentTopicItemOrderTableExists(database: QueryDatabase) {
  const result = await sql<{ exists: boolean }>`
    select to_regclass('public.content_topic_item_order') is not null as exists
  `.execute(database);
  return Boolean(result.rows[0]?.exists);
}

function stringArrayFromAuditMetadata(metadata: JsonValue, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const values = (metadata as Record<string, JsonValue>)[key];
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === "string");
}

function contentIdsFromAuditMetadata(metadata: JsonValue) {
  return stringArrayFromAuditMetadata(metadata, "contentIds");
}

function topicIdsFromAuditMetadata(metadata: JsonValue) {
  return stringArrayFromAuditMetadata(metadata, "topicIds");
}

export async function listContentTopicItems(database: DatabaseClient): Promise<{
  items: ContentTopicItemSummary[];
  topics: ContentTopicTaxonomySummary[];
}> {
  const [itemResult, topicResult] = await Promise.all([
    sql<{
      id: string;
      kind: "guide" | "video";
      regions: JsonValue;
      status: ContentStatus;
      subject_ids: string[] | null;
      title: string;
      topic: string;
    }>`
      select
        item.id,
        item.kind,
        item.status,
        item.title,
        item.topic,
        case
          when jsonb_typeof(item.content -> 'regions') = 'array' then item.content -> 'regions'
          else '[]'::jsonb
        end as regions,
        coalesce((
          select array_agg(link.subject_id order by link.subject_id)
          from public.content_subjects as link
          where link.content_item_id = item.id
        ), '{}'::uuid[]) as subject_ids
      from public.content_items as item
      where item.kind in ('guide', 'video')
      order by lower(item.title) asc, item.id asc
    `.execute(database),
    sql<{
      name: string;
      subject_ids: string[] | null;
    }>`
      select
        topic.name,
        coalesce((
          select array_agg(link.subject_id order by link.subject_id)
          from public.content_topic_subjects as link
          where link.topic_id = topic.id
        ), '{}'::uuid[]) as subject_ids
      from public.content_topics as topic
      order by lower(topic.name) asc, topic.id asc
    `.execute(database),
  ]);

  return {
    items: itemResult.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      subjectIds: row.subject_ids ?? [],
      title: row.title,
      topics: contentTopics({ regions: row.regions } as JsonValue, row.topic),
    })),
    topics: topicResult.rows.map((row) => ({
      name: row.name,
      subjectIds: row.subject_ids ?? [],
    })),
  };
}

export async function listContentTopicItemOrders(
  database: DatabaseClient,
  subjectId: string,
): Promise<ContentTopicItemOrder[]> {
  const grouped = new Map<string, string[]>();

  // Audit log is the durable source of truth for manual ordering. It is already
  // part of the production schema and avoids coupling this editor interaction
  // to optional taxonomy-order tables during staggered deployments.
  const auditRows = await sql<{ metadata: JsonValue; topic_name: string }>`
    select audit.metadata, topic.name as topic_name
    from public.audit_log as audit
    join public.content_topics as topic on topic.id = audit.target_id
    where audit.action = 'content_topic_items_reordered'
      and audit.target_type = 'content_topic'
      and audit.metadata ->> 'subjectId' = ${subjectId}
    order by audit.occurred_at desc, audit.id desc
  `.execute(database);

  for (const row of auditRows.rows) {
    const topicKey = normalizeTopic(row.topic_name);
    if (!topicKey || grouped.has(topicKey)) continue;
    grouped.set(topicKey, contentIdsFromAuditMetadata(row.metadata));
  }

  // Preserve compatibility with orders written by the earlier table-backed
  // implementation, but never let an older table row override a newer audit order.
  if (await contentTopicItemOrderTableExists(database)) {
    const rows = await sql<{ content_item_id: string; position: number; topic_key: string }>`
      select content_item_id, position, topic_key
      from public.content_topic_item_order
      where subject_id = ${subjectId}
      order by topic_key asc, position asc, content_item_id asc
    `.execute(database);
    for (const row of rows.rows) {
      const topicKey = normalizeTopic(row.topic_key);
      if (!topicKey || grouped.has(topicKey)) continue;
      grouped.set(topicKey, [...(grouped.get(topicKey) ?? []), row.content_item_id]);
    }
  }

  return [...grouped.entries()].map(([topic, contentIds]) => ({ contentIds, topic }));
}

export async function listContentTopicDisplayOrder(
  database: DatabaseClient,
  subjectId: string,
): Promise<string[]> {
  const audit = await sql<{ metadata: JsonValue }>`
    select metadata
    from public.audit_log
    where action = 'content_topics_reordered'
      and target_type = 'subject'
      and target_id = ${subjectId}
    order by occurred_at desc, id desc
    limit 1
  `.execute(database);
  const topicIds = topicIdsFromAuditMetadata(audit.rows[0]?.metadata ?? null);
  if (topicIds.length === 0) return [];

  const topics = await sql<{ id: string; name: string }>`
    select topic.id, topic.name
    from public.content_topics as topic
    join public.content_topic_subjects as link on link.topic_id = topic.id
    where link.subject_id = ${subjectId}
  `.execute(database);
  const byId = new Map(topics.rows.map((topic) => [topic.id, topic.name]));
  return topicIds.flatMap((topicId) => {
    const name = byId.get(topicId);
    return name ? [name] : [];
  });
}

export async function reorderContentTopics(
  database: DatabaseClient,
  input: {
    actorUserId: string;
    subjectId: string;
    topics: string[];
  },
): Promise<
  | { status: "success"; value: { subjectId: string; topics: string[] } }
  | { status: "conflict" }
  | { status: "not_found" }
> {
  const names = input.topics.map((topic) => topic.trim()).filter(Boolean);
  const keys = names.map(normalizeTopic);
  if (names.length !== input.topics.length || new Set(keys).size !== names.length) {
    return { status: "conflict" };
  }

  return database.transaction().execute(async (transaction) => {
    const subject = await transaction
      .selectFrom("subjects")
      .select("id")
      .where("id", "=", input.subjectId)
      .executeTakeFirst();
    if (!subject) return { status: "not_found" };

    const rows = await sql<{ id: string; name: string }>`
      select topic.id, topic.name
      from public.content_topics as topic
      join public.content_topic_subjects as link on link.topic_id = topic.id
      where link.subject_id = ${input.subjectId}
    `.execute(transaction);
    const byKey = new Map(rows.rows.map((row) => [normalizeTopic(row.name), row]));
    const ordered = names.map((name) => byKey.get(normalizeTopic(name)));
    if (ordered.some((topic) => !topic)) return { status: "conflict" };

    const topicIds = ordered.flatMap((topic) => topic ? [topic.id] : []);
    const canonicalNames = ordered.flatMap((topic) => topic ? [topic.name] : []);

    await transaction
      .insertInto("audit_log")
      .values({
        action: "content_topics_reordered",
        actor_user_id: input.actorUserId,
        metadata: { subjectId: input.subjectId, topicIds },
        target_id: input.subjectId,
        target_type: "subject",
      })
      .execute();

    return {
      status: "success",
      value: { subjectId: input.subjectId, topics: canonicalNames },
    };
  });
}

export async function reorderContentTopicItems(
  database: DatabaseClient,
  input: {
    actorUserId: string;
    contentIds: string[];
    subjectId: string;
    topic: string;
  },
): Promise<TopicItemOrderMutationResult> {
  const topic = input.topic.trim();
  const topicKey = normalizeTopic(topic);
  const contentIds = [...new Set(input.contentIds)];
  if (!topicKey || contentIds.length !== input.contentIds.length) return { status: "conflict" };

  return database.transaction().execute(async (transaction) => {
    const topicResult = await sql<{ id: string; name: string }>`
      select topic.id, topic.name
      from public.content_topics as topic
      join public.content_topic_subjects as link on link.topic_id = topic.id
      where link.subject_id = ${input.subjectId}
        and lower(topic.name) = lower(${topic})
      limit 1
      for update of topic
    `.execute(transaction);
    const storedTopic = topicResult.rows[0];
    if (!storedTopic) return { status: "not_found" };

    if (contentIds.length > 0) {
      const rows = await transaction
        .selectFrom("content_items")
        .innerJoin("content_subjects", "content_subjects.content_item_id", "content_items.id")
        .select(["content_items.content", "content_items.id", "content_items.topic"])
        .where("content_subjects.subject_id", "=", input.subjectId)
        .where("content_items.id", "in", contentIds)
        .execute();
      if (rows.length !== contentIds.length) return { status: "conflict" };
      if (rows.some((row) => !contentTopics(row.content, row.topic).some(
        (candidate) => normalizeTopic(candidate) === topicKey,
      ))) {
        return { status: "conflict" };
      }
    }

    await transaction
      .insertInto("audit_log")
      .values({
        action: "content_topic_items_reordered",
        actor_user_id: input.actorUserId,
        metadata: { contentIds, subjectId: input.subjectId, topic: storedTopic.name },
        target_id: storedTopic.id,
        target_type: "content_topic",
      })
      .execute();

    return {
      status: "success",
      value: { contentIds, subjectId: input.subjectId, topic: topicKey },
    };
  });
}

export async function renameContentTopic(
  database: DatabaseClient,
  input: { actorUserId: string; name: string; previousName: string },
): Promise<TopicMutationResult> {
  const name = input.name.trim();
  const previousName = input.previousName.trim();
  if (!name || !previousName) return { status: "conflict" };

  return database.transaction().execute(async (transaction) => {
    const sourceResult = await sql<{ id: string; name: string }>`
      select id, name
      from public.content_topics
      where lower(name) = lower(${previousName})
      limit 1
      for update
    `.execute(transaction);
    const source = sourceResult.rows[0];
    if (!source) return { status: "not_found" };

    const conflictResult = await sql<{ id: string }>`
      select id
      from public.content_topics
      where lower(name) = lower(${name})
        and id <> ${source.id}
      limit 1
    `.execute(transaction);
    if (conflictResult.rows[0]) return { status: "conflict" };

    const subjectIds = await subjectIdsForTopic(transaction, source.id);
    const rows = await transaction
      .selectFrom("content_items")
      .select(["content", "id", "topic", "version"])
      .execute();
    let affectedContentCount = 0;
    const previous = normalizeTopic(source.name);

    for (const row of rows) {
      const renamedContent = renameTopicReferences(row.content, source.name, name);
      const topicChanged = normalizeTopic(row.topic) === previous;
      if (!renamedContent.changed && !topicChanged) continue;

      const updated = await transaction
        .updateTable("content_items")
        .set({
          content: renamedContent.content,
          topic: topicChanged ? name : row.topic,
          version: row.version + 1,
        })
        .where("id", "=", row.id)
        .where("version", "=", row.version)
        .returning("id")
        .executeTakeFirst();
      if (!updated) return { status: "conflict" };
      affectedContentCount += 1;
    }

    const nextTopicKey = normalizeTopic(name);
    if (nextTopicKey !== previous && await contentTopicItemOrderTableExists(transaction)) {
      await sql`
        update public.content_topic_item_order
        set topic_key = ${nextTopicKey}, updated_at = now()
        where topic_key = ${previous}
      `.execute(transaction);
    }

    await sql`
      update public.content_topics
      set name = ${name}
      where id = ${source.id}
    `.execute(transaction);

    await transaction
      .insertInto("audit_log")
      .values({
        action: "content_topic_updated",
        actor_user_id: input.actorUserId,
        metadata: {
          affectedContentCount,
          name,
          previousName: source.name,
          subjectIds,
        },
        target_id: source.id,
        target_type: "content_topic",
      })
      .execute();

    return { status: "success", value: { name, subjectIds } };
  });
}

export async function deleteContentTopic(
  database: DatabaseClient,
  input: { actorUserId: string; name: string },
): Promise<TopicMutationResult> {
  const name = input.name.trim();
  if (!name) return { status: "conflict" };

  return database.transaction().execute(async (transaction) => {
    const sourceResult = await sql<{ id: string; name: string }>`
      select id, name
      from public.content_topics
      where lower(name) = lower(${name})
      limit 1
      for update
    `.execute(transaction);
    const source = sourceResult.rows[0];
    if (!source) return { status: "not_found" };

    const rows = await transaction
      .selectFrom("content_items")
      .select(["content", "topic"])
      .execute();
    const normalized = normalizeTopic(source.name);
    const inUse = rows.some((row) =>
      contentTopics(row.content, row.topic).some((topic) => normalizeTopic(topic) === normalized),
    );
    if (inUse) return { status: "in_use" };

    const subjectIds = await subjectIdsForTopic(transaction, source.id);
    if (await contentTopicItemOrderTableExists(transaction)) {
      await sql`
        delete from public.content_topic_item_order
        where topic_key = ${normalized}
      `.execute(transaction);
    }
    await sql`
      delete from public.content_topic_subjects
      where topic_id = ${source.id}
    `.execute(transaction);
    await sql`
      delete from public.content_topics
      where id = ${source.id}
    `.execute(transaction);

    await transaction
      .insertInto("audit_log")
      .values({
        action: "content_topic_deleted",
        actor_user_id: input.actorUserId,
        metadata: { name: source.name, subjectIds },
        target_id: source.id,
        target_type: "content_topic",
      })
      .execute();

    return { status: "success", value: { name: source.name, subjectIds } };
  });
}
