import { sql, type Transaction } from "kysely";
import type { ContentTopic } from "@cediah/contracts";
import type { CediahDatabase, DatabaseClient, JsonValue } from "./db/database.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;
type TopicMutationResult =
  | { status: "success"; value: ContentTopic }
  | { status: "conflict" }
  | { status: "in_use" }
  | { status: "not_found" };

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
