import { sql } from "kysely";
import {
  SubjectSchema,
  type Subject,
  type SubjectMutationResult,
  type SubjectProvider,
} from "@cediah/contracts";
import type { DatabaseClient } from "../db/database.js";

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code : null;
}

function isUniqueConflict(error: unknown) {
  return errorCode(error) === "23505";
}

export function slugifySubject(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function selectSubjects(
  database: DatabaseClient,
  input: { publishedOnly: boolean; slug?: string },
): Promise<Subject[]> {
  const rows = await database
    .selectFrom("subjects")
    .leftJoin("content_subjects", "content_subjects.subject_id", "subjects.id")
    .leftJoin("content_items", (join) => {
      const contentJoin = join.onRef(
        "content_items.id",
        "=",
        "content_subjects.content_item_id",
      );
      return input.publishedOnly
        ? contentJoin.on("content_items.status", "=", "published")
        : contentJoin;
    })
    .select([
      "subjects.id as id",
      "subjects.name as name",
      "subjects.slug as slug",
      sql<number>`count(content_items.id)::integer`.as("contentCount"),
    ])
    .$if(input.slug !== undefined, (query) =>
      query.where("subjects.slug", "=", input.slug ?? ""),
    )
    .groupBy(["subjects.id", "subjects.name", "subjects.slug"])
    .orderBy("subjects.name", "asc")
    .execute();

  return rows.map((row) => SubjectSchema.parse(row));
}

export function createPostgresSubjectProvider(database: DatabaseClient): SubjectProvider {
  return {
    async createSubject(input) {
      const name = input.name.trim();
      const slug = slugifySubject(name);
      if (!slug) return { status: "conflict" };

      try {
        return await database.transaction().execute(async (transaction) => {
          const row = await transaction
            .insertInto("subjects")
            .values({ name, slug })
            .returning(["id", "name", "slug"])
            .executeTakeFirstOrThrow();
          const subject = SubjectSchema.parse({ ...row, contentCount: 0 });

          await transaction
            .insertInto("audit_log")
            .values({
              action: "subject_created",
              actor_user_id: input.actorUserId,
              metadata: { slug: subject.slug },
              target_id: subject.id,
              target_type: "subject",
            })
            .execute();

          return {
            status: "success",
            value: subject,
          } satisfies SubjectMutationResult<Subject>;
        });
      } catch (error) {
        if (isUniqueConflict(error)) return { status: "conflict" };
        throw error;
      }
    },

    async deleteSubject(input) {
      return database.transaction().execute(async (transaction) => {
        const deleted = await transaction
          .deleteFrom("subjects")
          .where("id", "=", input.subjectId)
          .returning(["id", "name", "slug"])
          .executeTakeFirst();
        if (!deleted) return { status: "not_found" };

        await transaction
          .insertInto("audit_log")
          .values({
            action: "subject_deleted",
            actor_user_id: input.actorUserId,
            metadata: { name: deleted.name, slug: deleted.slug },
            target_id: deleted.id,
            target_type: "subject",
          })
          .execute();

        return { status: "success", value: { id: deleted.id } };
      });
    },

    async getSubjectBySlug(slug) {
      const subjects = await selectSubjects(database, {
        publishedOnly: true,
        slug,
      });
      return subjects[0] ?? null;
    },

    listSubjects(input = {}) {
      return selectSubjects(database, {
        publishedOnly: input.publishedOnly ?? false,
      });
    },
  };
}
