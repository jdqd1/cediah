import { sql } from "kysely";
import type {
  LearningProgressStatus,
  LearningProvider,
  LessonProgressResponse,
  StudentLearningCourse,
} from "@cediah/contracts";
import type { DatabaseClient } from "../db/database.js";

function toIsoString(value: Date | string | null) {
  if (value === null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function progressStatus(
  watchedSeconds: number,
  durationSeconds: number | null,
): LearningProgressStatus {
  if (watchedSeconds === 0) return "not_started";
  if (durationSeconds !== null && watchedSeconds >= durationSeconds) return "completed";
  return "in_progress";
}

export function createPostgresLearningProvider(database: DatabaseClient): LearningProvider {
  return {
    async getStudentDashboard(userId) {
      const now = new Date();
      const enrollments = await database
        .selectFrom("enrollments")
        .innerJoin("courses", "courses.id", "enrollments.course_id")
        .select([
          "courses.id as id",
          "courses.slug as slug",
          "courses.title as title",
          "enrollments.access_ends_at as accessEndsAt",
        ])
        .where("enrollments.user_id", "=", userId)
        .where("enrollments.status", "=", "active")
        .where("enrollments.access_starts_at", "<=", now)
        .where((expression) =>
          expression.or([
            expression("enrollments.access_ends_at", "is", null),
            expression("enrollments.access_ends_at", ">", now),
          ]),
        )
        .orderBy("courses.title", "asc")
        .execute();

      if (enrollments.length === 0) return { courses: [] };

      const courseIds = enrollments.map((enrollment) => enrollment.id);
      const lessons = await database
        .selectFrom("course_modules")
        .innerJoin("lessons", "lessons.module_id", "course_modules.id")
        .leftJoin("lesson_progress", (join) =>
          join
            .onRef("lesson_progress.lesson_id", "=", "lessons.id")
            .on("lesson_progress.user_id", "=", userId),
        )
        .select([
          "course_modules.course_id as courseId",
          "lessons.id as lessonId",
          "lesson_progress.status as status",
          "lesson_progress.watched_seconds as watchedSeconds",
        ])
        .where("course_modules.course_id", "in", courseIds)
        .execute();

      const progressByCourse = new Map<
        string,
        { completedLessons: number; totalLessons: number; watchedSeconds: number }
      >();

      for (const lesson of lessons) {
        const progress = progressByCourse.get(lesson.courseId) ?? {
          completedLessons: 0,
          totalLessons: 0,
          watchedSeconds: 0,
        };
        progress.totalLessons += 1;
        progress.watchedSeconds += lesson.watchedSeconds ?? 0;
        if (lesson.status === "completed") progress.completedLessons += 1;
        progressByCourse.set(lesson.courseId, progress);
      }

      const courses: StudentLearningCourse[] = enrollments.map((enrollment) => ({
        accessEndsAt: toIsoString(enrollment.accessEndsAt),
        id: enrollment.id,
        progress: progressByCourse.get(enrollment.id) ?? {
          completedLessons: 0,
          totalLessons: 0,
          watchedSeconds: 0,
        },
        slug: enrollment.slug,
        title: enrollment.title,
      }));

      return { courses };
    },

    async updateLessonProgress(input): Promise<LessonProgressResponse | null> {
      return database.transaction().execute(async (transaction) => {
        const lesson = await transaction
          .selectFrom("lessons")
          .innerJoin("course_modules", "course_modules.id", "lessons.module_id")
          .select([
            "lessons.duration_seconds as durationSeconds",
            "course_modules.course_id as courseId",
          ])
          .where("lessons.id", "=", input.lessonId)
          .executeTakeFirst();
        if (!lesson) return null;

        const now = new Date();
        const enrollment = await transaction
          .selectFrom("enrollments")
          .select("id")
          .where("user_id", "=", input.userId)
          .where("course_id", "=", lesson.courseId)
          .where("status", "=", "active")
          .where("access_starts_at", "<=", now)
          .where((expression) =>
            expression.or([
              expression("access_ends_at", "is", null),
              expression("access_ends_at", ">", now),
            ]),
          )
          .executeTakeFirst();
        if (!enrollment) return null;

        const requestedWatchedSeconds =
          lesson.durationSeconds === null
            ? input.watchedSeconds
            : Math.min(input.watchedSeconds, lesson.durationSeconds);
        const requestedStatus = progressStatus(
          requestedWatchedSeconds,
          lesson.durationSeconds,
        );
        const requestedCompletedAt = requestedStatus === "completed" ? now : null;

        const stored = await sql<{
          completed_at: Date | string | null;
          lesson_id: string;
          status: LearningProgressStatus;
          watched_seconds: number;
        }>`
          insert into public.lesson_progress (
            completed_at,
            lesson_id,
            status,
            user_id,
            watched_seconds
          ) values (
            ${requestedCompletedAt},
            ${input.lessonId}::uuid,
            ${requestedStatus}::public.progress_status,
            ${input.userId}::uuid,
            ${requestedWatchedSeconds}
          )
          on conflict (user_id, lesson_id) do update
          set
            watched_seconds = greatest(
              public.lesson_progress.watched_seconds,
              excluded.watched_seconds
            ),
            status = case
              when greatest(
                public.lesson_progress.watched_seconds,
                excluded.watched_seconds
              ) = 0 then 'not_started'::public.progress_status
              when ${lesson.durationSeconds}::integer is not null
                and greatest(
                  public.lesson_progress.watched_seconds,
                  excluded.watched_seconds
                ) >= ${lesson.durationSeconds}::integer
                then 'completed'::public.progress_status
              else 'in_progress'::public.progress_status
            end,
            completed_at = case
              when ${lesson.durationSeconds}::integer is not null
                and greatest(
                  public.lesson_progress.watched_seconds,
                  excluded.watched_seconds
                ) >= ${lesson.durationSeconds}::integer
                then coalesce(
                  public.lesson_progress.completed_at,
                  excluded.completed_at,
                  now()
                )
              else null
            end,
            updated_at = now()
          returning completed_at, lesson_id, status, watched_seconds
        `.execute(transaction);
        const row = stored.rows[0];
        if (!row) throw new Error("Lesson progress upsert returned no row.");

        return {
          completedAt: toIsoString(row.completed_at),
          lessonId: row.lesson_id,
          status: row.status,
          watchedSeconds: row.watched_seconds,
        };
      });
    },
  };
}
