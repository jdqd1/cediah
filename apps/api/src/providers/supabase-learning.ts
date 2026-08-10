import { createClient } from "@supabase/supabase-js";
import type {
  LearningProgressStatus,
  LearningProvider,
  LessonProgressResponse,
  StudentLearningCourse,
  StudentLearningDashboardResponse,
} from "@cediah/contracts";

type SupabaseLearningConfiguration = {
  secretKey: string;
  url: string;
};

type ActiveEnrollment = {
  accessEndsAt: string | null;
  course: {
    id: string;
    slug: string;
    title: string;
  };
};

type LessonSummary = {
  courseId: string;
  id: string;
};

type StoredProgress = {
  status: LearningProgressStatus;
  watchedSeconds: number;
};

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asSingleRecord(value: unknown) {
  const first = Array.isArray(value) ? value[0] : value;
  return asRecord(first);
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readTimestamp(value: unknown) {
  const raw = readString(value);
  if (!raw || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
}

function readProgressStatus(value: unknown): LearningProgressStatus | null {
  return value === "not_started" || value === "in_progress" || value === "completed" ? value : null;
}

function readActiveEnrollments(value: unknown): ActiveEnrollment[] {
  const enrollments = new Map<string, ActiveEnrollment>();

  for (const item of asArray(value)) {
    const enrollment = asRecord(item);
    const course = asSingleRecord(enrollment?.courses);
    const id = readString(course?.id);
    const slug = readString(course?.slug);
    const title = readString(course?.title);

    if (!id || !slug || !title) continue;

    enrollments.set(id, {
      accessEndsAt: readTimestamp(enrollment?.access_ends_at),
      course: { id, slug, title },
    });
  }

  return [...enrollments.values()].sort((left, right) => left.course.title.localeCompare(right.course.title, "es"));
}

function readLessons(value: unknown): LessonSummary[] {
  const lessons = new Map<string, LessonSummary>();

  for (const item of asArray(value)) {
    const module = asRecord(item);
    const courseId = readString(module?.course_id);
    if (!courseId) continue;

    for (const lessonItem of asArray(module?.lessons)) {
      const lesson = asRecord(lessonItem);
      const id = readString(lesson?.id);
      if (!id) continue;

      lessons.set(id, {
        courseId,
        id,
      });
    }
  }

  return [...lessons.values()];
}

function readStoredProgress(value: unknown) {
  const progress = new Map<string, StoredProgress>();

  for (const item of asArray(value)) {
    const row = asRecord(item);
    const lessonId = readString(row?.lesson_id);
    const status = readProgressStatus(row?.status);
    const watchedSeconds = readNonNegativeInteger(row?.watched_seconds);
    if (!lessonId || !status || watchedSeconds === null) continue;

    progress.set(lessonId, {
      status,
      watchedSeconds,
    });
  }

  return progress;
}

function progressStatus(watchedSeconds: number, durationSeconds: number | null): LearningProgressStatus {
  if (watchedSeconds === 0) return "not_started";
  if (durationSeconds !== null && watchedSeconds >= durationSeconds) return "completed";
  return "in_progress";
}

export function createSupabaseLearningProvider(
  configuration: SupabaseLearningConfiguration,
): LearningProvider {
  const client = createClient(configuration.url, configuration.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return {
    async getStudentDashboard(userId): Promise<StudentLearningDashboardResponse> {
      const now = new Date().toISOString();
      const { data: enrollmentData, error: enrollmentError } = await client
        .from("enrollments")
        .select("access_ends_at, courses!inner(id, slug, title)")
        .eq("user_id", userId)
        .eq("status", "active")
        .lte("access_starts_at", now)
        .or(`access_ends_at.is.null,access_ends_at.gt.${now}`);
      if (enrollmentError) throw enrollmentError;

      const enrollments = readActiveEnrollments(enrollmentData);
      if (enrollments.length === 0) return { courses: [] };

      const courseIds = enrollments.map(({ course }) => course.id);
      const { data: moduleData, error: moduleError } = await client
        .from("course_modules")
        .select("course_id, lessons(id, duration_seconds)")
        .in("course_id", courseIds);
      if (moduleError) throw moduleError;

      const lessons = readLessons(moduleData);
      const lessonIds = lessons.map(({ id }) => id);
      const progress = new Map<string, StoredProgress>();

      if (lessonIds.length > 0) {
        const { data: progressData, error: progressError } = await client
          .from("lesson_progress")
          .select("lesson_id, status, watched_seconds, completed_at")
          .eq("user_id", userId)
          .in("lesson_id", lessonIds);
        if (progressError) throw progressError;
        for (const [lessonId, item] of readStoredProgress(progressData)) progress.set(lessonId, item);
      }

      const lessonsByCourse = new Map<string, LessonSummary[]>();
      for (const lesson of lessons) {
        const existing = lessonsByCourse.get(lesson.courseId) ?? [];
        existing.push(lesson);
        lessonsByCourse.set(lesson.courseId, existing);
      }

      const courses: StudentLearningCourse[] = enrollments.map(({ accessEndsAt, course }) => {
        const courseLessons = lessonsByCourse.get(course.id) ?? [];
        const courseProgress = courseLessons.map((lesson) => progress.get(lesson.id));

        return {
          accessEndsAt,
          id: course.id,
          progress: {
            completedLessons: courseProgress.filter((item) => item?.status === "completed").length,
            totalLessons: courseLessons.length,
            watchedSeconds: courseProgress.reduce((total, item) => total + (item?.watchedSeconds ?? 0), 0),
          },
          slug: course.slug,
          title: course.title,
        };
      });

      return { courses };
    },

    async updateLessonProgress(input): Promise<LessonProgressResponse | null> {
      const { data: lessonData, error: lessonError } = await client
        .from("lessons")
        .select("id, duration_seconds, course_modules!inner(course_id)")
        .eq("id", input.lessonId)
        .maybeSingle();
      if (lessonError) throw lessonError;

      const lesson = asRecord(lessonData);
      const module = asSingleRecord(lesson?.course_modules);
      const courseId = readString(module?.course_id);
      const durationSeconds = readNonNegativeInteger(lesson?.duration_seconds);
      if (!lesson || !courseId) return null;

      const now = new Date().toISOString();
      const { data: enrollmentData, error: enrollmentError } = await client
        .from("enrollments")
        .select("id")
        .eq("user_id", input.userId)
        .eq("course_id", courseId)
        .eq("status", "active")
        .lte("access_starts_at", now)
        .or(`access_ends_at.is.null,access_ends_at.gt.${now}`)
        .maybeSingle();
      if (enrollmentError) throw enrollmentError;
      if (!enrollmentData) return null;

      const { data: existingData, error: existingError } = await client
        .from("lesson_progress")
        .select("completed_at, watched_seconds")
        .eq("user_id", input.userId)
        .eq("lesson_id", input.lessonId)
        .maybeSingle();
      if (existingError) throw existingError;

      const existing = asRecord(existingData);
      const existingWatchedSeconds = readNonNegativeInteger(existing?.watched_seconds) ?? 0;
      const requestedWatchedSeconds = Math.max(existingWatchedSeconds, input.watchedSeconds);
      const watchedSeconds =
        durationSeconds === null ? requestedWatchedSeconds : Math.min(requestedWatchedSeconds, durationSeconds);
      const status = progressStatus(watchedSeconds, durationSeconds);
      const completedAt =
        status === "completed" ? readTimestamp(existing?.completed_at) ?? new Date().toISOString() : null;

      const { data: storedData, error: storedError } = await client
        .from("lesson_progress")
        .upsert(
          {
            completed_at: completedAt,
            lesson_id: input.lessonId,
            status,
            user_id: input.userId,
            watched_seconds: watchedSeconds,
          },
          { onConflict: "user_id,lesson_id" },
        )
        .select("completed_at, lesson_id, status, watched_seconds")
        .single();
      if (storedError) throw storedError;

      const stored = asRecord(storedData);
      return {
        completedAt: readTimestamp(stored?.completed_at),
        lessonId: readString(stored?.lesson_id) ?? input.lessonId,
        status: readProgressStatus(stored?.status) ?? status,
        watchedSeconds: readNonNegativeInteger(stored?.watched_seconds) ?? watchedSeconds,
      };
    },
  };
}
