import { sql, type Selectable, type Transaction } from "kysely";
import {
  ContentDraftSchema,
  LearningProjectionSchema,
  type LearningProjection,
} from "@cediah/contracts";
import type {
  CediahDatabase,
  ContentItemTable,
  DatabaseClient,
  JsonValue,
} from "../db/database.js";
import { getLearningAdapter } from "./adapters/registry.js";
import type { LearningRevisionSnapshot } from "./adapters/types.js";
import { hashLearningSnapshot } from "./snapshot-hash.js";

type ContentRow = Selectable<ContentItemTable>;

export type ResolvedLearningResource = {
  adapterKey: LearningProjection;
  adapterVersion: number;
  catalogVisibility: "catalog" | "guided_only";
  payload: LearningRevisionSnapshot;
  resourceId: string;
  resourceRevisionId: string;
  revisionNumber: number;
  sourceContentId: string;
  sourceVersion: number;
  studentPayload: unknown;
};

export type LearningResourceResolution =
  | { status: "identity_missing" | "not_found" | "resource_changed" }
  | { status: "success"; value: ResolvedLearningResource };

function draftFromRow(row: ContentRow) {
  return ContentDraftSchema.parse({
    catalogVisibility: row.catalog_visibility,
    content: row.content,
    estimatedMinutes: row.estimated_minutes,
    featured: row.is_featured,
    kind: row.kind,
    slug: row.slug,
    subjectIds: [],
    summary: row.summary,
    title: row.title,
    topic: row.topic,
  });
}

function questionBack(question: {
  correctOptionIndex: number;
  explanation?: string;
  options: string[];
}) {
  const answer = question.options[question.correctOptionIndex] ?? "";
  return question.explanation?.trim()
    ? `${answer}\n\n${question.explanation.trim()}`
    : answer;
}

function adapterContent(row: ContentRow, projection: LearningProjection): unknown {
  const draft = draftFromRow(row);
  if (projection === "video") {
    if (draft.kind !== "video") return null;
    return {
      durationSeconds: draft.content.durationSeconds,
      externalUrl: draft.content.externalUrl,
    };
  }
  if (projection === "guide") {
    if (draft.kind === "guide") {
      return { document: draft.content.document, sections: draft.content.sections };
    }
    if (draft.kind === "video") {
      return {
        document: draft.content.guide.document,
        sections: draft.content.guide.sections,
      };
    }
    return null;
  }
  if (projection === "quiz") {
    if (draft.kind === "quiz") return { questions: draft.content.questions };
    if (draft.kind === "video" || draft.kind === "guide") {
      return { questions: draft.content.quiz.questions };
    }
    return null;
  }
  if (draft.kind === "flashcards") return { cards: draft.content.cards };
  if (draft.kind === "video" || draft.kind === "guide" || draft.kind === "quiz") {
    const questions = draft.kind === "quiz"
      ? draft.content.questions
      : draft.content.quiz.questions;
    return {
      cards: questions.map((question) => ({
        back: questionBack(question),
        front: question.prompt,
        id: question.id,
        itemKind: "question" as const,
        memoryVersion: question.memoryVersion,
      })),
    };
  }
  return null;
}

async function canonicalContentRow(
  transaction: Transaction<CediahDatabase>,
  sourceContentId: string,
  projection: LearningProjection,
) {
  let row = await transaction
    .selectFrom("content_items")
    .selectAll()
    .where("id", "=", sourceContentId)
    .where("status", "=", "published")
    .executeTakeFirst();
  if (!row) return null;

  if (row.kind === "video" && projection !== "video") {
    const linkedGuide = await transaction
      .selectFrom("content_items")
      .selectAll()
      .where("kind", "=", "guide")
      .where("status", "=", "published")
      .where(
        (expression) => expression.fn("jsonb_extract_path_text", [
          "content_items.content",
          expression.val("linkedVideoId"),
        ]),
        "=",
        row.id,
      )
      .orderBy("updated_at", "desc")
      .orderBy("id", "asc")
      .executeTakeFirst();
    if (linkedGuide) row = linkedGuide;
  }
  return row;
}

class IdentityConflict extends Error {}

export function createLearningContentResolver(database: DatabaseClient) {
  return {
    async resolvePublishedRevision(input: {
      allowGuidedOnly: boolean;
      projection: LearningProjection;
      sourceContentId: string;
    }): Promise<LearningResourceResolution> {
      if (!LearningProjectionSchema.safeParse(input.projection).success) {
        return { status: "not_found" };
      }
      try {
        return await database.transaction().execute(async (transaction) => {
          const row = await canonicalContentRow(
            transaction,
            input.sourceContentId,
            input.projection,
          );
          if (
            !row ||
            (row.catalog_visibility === "guided_only" && !input.allowGuidedOnly)
          ) {
            return { status: "not_found" };
          }

          const adapter = getLearningAdapter(input.projection);
          const content = adapterContent(row, input.projection);
          if (content === null) return { status: "not_found" };
          let parsed: unknown;
          try {
            parsed = adapter.parse(content);
          } catch {
            return { status: "identity_missing" };
          }

          const items = adapter.items(parsed);
          for (const item of [...items].sort((left, right) => left.id.localeCompare(right.id))) {
            await transaction
              .insertInto("learning_items")
              .values({
                id: item.id,
                item_kind: item.kind,
                memory_version: item.memoryVersion,
                source_content_id: row.id,
              })
              .onConflict((conflict) => conflict.column("id").doNothing())
              .execute();
            const stored = await transaction
              .selectFrom("learning_items")
              .select(["item_kind", "memory_version", "source_content_id"])
              .where("id", "=", item.id)
              .executeTakeFirstOrThrow();
            if (
              stored.item_kind !== item.kind ||
              stored.memory_version > item.memoryVersion ||
              stored.source_content_id !== row.id
            ) {
              throw new IdentityConflict("Canonical learning item identity collision");
            }
            if (stored.memory_version < item.memoryVersion) {
              await transaction
                .updateTable("learning_items")
                .set({ memory_version: item.memoryVersion })
                .where("id", "=", item.id)
                .where("memory_version", "=", stored.memory_version)
                .executeTakeFirstOrThrow();
            }
          }

          const resource = await transaction
            .insertInto("learning_resources")
            .values({
              adapter_key: adapter.key,
              projection: input.projection,
              source_content_id: row.id,
            })
            .onConflict((conflict) => conflict
              .columns(["source_content_id", "projection"])
              .doUpdateSet({ adapter_key: adapter.key }))
            .returning(["id", "retired_at"])
            .executeTakeFirstOrThrow();
          if (resource.retired_at) return { status: "not_found" };

          await transaction
            .selectFrom("learning_resources")
            .select("id")
            .where("id", "=", resource.id)
            .forUpdate()
            .executeTakeFirstOrThrow();

          const payload: LearningRevisionSnapshot = {
            content: parsed,
            projection: input.projection,
            sourceContentId: row.id,
            sourceVersion: row.version,
            title: row.title,
          };
          const hash = hashLearningSnapshot(payload);
          let revision = await transaction
            .selectFrom("learning_resource_revisions")
            .select(["id", "revision_number"])
            .where("resource_id", "=", resource.id)
            .where("source_version", "=", row.version)
            .where("adapter_version", "=", adapter.version)
            .where("payload_hash", "=", hash)
            .executeTakeFirst();
          if (!revision) {
            const latest = await transaction
              .selectFrom("learning_resource_revisions")
              .select(sql<number>`coalesce(max(revision_number), 0)::integer`.as("number"))
              .where("resource_id", "=", resource.id)
              .executeTakeFirstOrThrow();
            revision = await transaction
              .insertInto("learning_resource_revisions")
              .values({
                adapter_version: adapter.version,
                payload_hash: hash,
                payload_json: payload as unknown as JsonValue,
                resource_id: resource.id,
                revision_number: latest.number + 1,
                schema_version: 1,
                source_version: row.version,
              })
              .returning(["id", "revision_number"])
              .executeTakeFirstOrThrow();
          }

          return {
            status: "success",
            value: {
              adapterKey: adapter.key,
              adapterVersion: adapter.version,
              catalogVisibility: row.catalog_visibility,
              payload,
              resourceId: resource.id,
              resourceRevisionId: revision.id,
              revisionNumber: revision.revision_number,
              sourceContentId: row.id,
              sourceVersion: row.version,
              studentPayload: adapter.toStudentPayload(parsed),
            },
          };
        });
      } catch (error) {
        if (error instanceof IdentityConflict) return { status: "resource_changed" };
        throw error;
      }
    },
  };
}

export type LearningContentResolver = ReturnType<typeof createLearningContentResolver>;
