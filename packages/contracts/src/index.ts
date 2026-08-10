import { z } from "zod";

export const HealthResponseSchema = z.object({
  checkedAt: z.string().datetime(),
  environment: z.enum(["development", "test", "production"]),
  service: z.literal("cediah-api"),
  status: z.literal("ok"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const CurrentUserSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
});

export const CurrentUserResponseSchema = z.object({
  user: CurrentUserSchema,
});

export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;

export type ProviderUser = {
  email: string;
  id: string;
};

export interface IdentityProvider {
  getUser(accessToken: string): Promise<ProviderUser | null>;
  revokeSessions(userId: string): Promise<void>;
}

export interface StorageProvider {
  createDownloadUrl(path: string, expiresInSeconds: number): Promise<string>;
  delete(path: string): Promise<void>;
  upload(path: string, body: Uint8Array, contentType: string): Promise<void>;
}

export const VideoAssetStatusSchema = z.enum([
  "waiting_for_upload",
  "uploading",
  "processing",
  "ready",
  "failed",
]);

export type VideoAssetStatus = z.infer<typeof VideoAssetStatusSchema>;

export type DirectVideoUpload = {
  expiresAt: string;
  externalVideoId: string;
  uploadUrl: string;
  uploadType?: "multipart_post" | "supabase_signed";
  uploadPath?: string;
  uploadToken?: string;
  storageBucket?: string;
};

export type VideoAsset = {
  creatorId: string | null;
  status: VideoAssetStatus;
};

export type VideoPlaybackSession = {
  expiresAt: string;
  iframeUrl?: string;
  playbackUrl?: string;
};

const UnsafeFileNameCharacters = /[\\/\u0000-\u001F]/;

export const TestVideoUploadRequestSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => !UnsafeFileNameCharacters.test(value), {
      message: "fileName must be a file basename",
    }),
  fileSizeBytes: z.number().int().positive().max(200_000_000),
  mimeType: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
});

export const TestVideoUploadResponseSchema = z.object({
  constraints: z.object({
    maxDurationSeconds: z.number().int().positive(),
    maxFileSizeBytes: z.number().int().positive(),
  }),
  upload: z.object({
    expiresAt: z.string().datetime(),
    externalVideoId: z.string().min(1).max(64),
    uploadUrl: z.string().url(),
    uploadType: z.enum(["multipart_post", "supabase_signed"]).default("multipart_post"),
    uploadPath: z.string().min(1).optional(),
    uploadToken: z.string().min(1).optional(),
    storageBucket: z.string().min(1).optional(),
  }).superRefine((upload, context) => {
    if (upload.uploadType === "supabase_signed") {
      if (!upload.uploadPath || !upload.uploadToken || !upload.storageBucket) {
        context.addIssue({
          code: "custom",
          message: "Supabase signed uploads must include their path, token and bucket",
        });
      }
    }
  }),
});

export const TestVideoAssetResponseSchema = z.object({
  expiresAt: z.string().datetime().optional(),
  iframeUrl: z.string().url().optional(),
  playbackUrl: z.string().url().optional(),
  status: VideoAssetStatusSchema,
  videoId: z.string().min(1).max(64),
}).superRefine((asset, context) => {
  if (asset.status === "ready" && !asset.iframeUrl && !asset.playbackUrl) {
    context.addIssue({
      code: "custom",
      message: "Ready video assets must include a playback URL",
    });
  }
});

export type TestVideoUploadRequest = z.infer<typeof TestVideoUploadRequestSchema>;
export type TestVideoUploadResponse = z.infer<typeof TestVideoUploadResponseSchema>;
export type TestVideoAssetResponse = z.infer<typeof TestVideoAssetResponseSchema>;

export interface VideoProvider {
  createDirectUpload(input: {
    creatorId: string;
    expiresAt: string;
    maxDurationSeconds: number;
  }): Promise<DirectVideoUpload>;
  createPlaybackSession(
    videoId: string,
    expiresInSeconds: number,
    creatorId?: string,
  ): Promise<VideoPlaybackSession>;
  getVideoAsset(videoId: string, creatorId?: string): Promise<VideoAsset | null>;
}

export const LearningProgressStatusSchema = z.enum(["not_started", "in_progress", "completed"]);

export type LearningProgressStatus = z.infer<typeof LearningProgressStatusSchema>;

export const StudentLearningCourseSchema = z.object({
  accessEndsAt: z.string().datetime().nullable(),
  id: z.string().uuid(),
  progress: z.object({
    completedLessons: z.number().int().nonnegative(),
    totalLessons: z.number().int().nonnegative(),
    watchedSeconds: z.number().int().nonnegative(),
  }),
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
});

export const StudentLearningDashboardResponseSchema = z.object({
  courses: z.array(StudentLearningCourseSchema),
});

export type StudentLearningCourse = z.infer<typeof StudentLearningCourseSchema>;
export type StudentLearningDashboardResponse = z.infer<typeof StudentLearningDashboardResponseSchema>;

export const UpdateLessonProgressRequestSchema = z.object({
  watchedSeconds: z.number().int().min(0).max(86_400),
});

export type UpdateLessonProgressRequest = z.infer<typeof UpdateLessonProgressRequestSchema>;

export const LessonProgressRouteParamsSchema = z.object({
  lessonId: z.string().uuid(),
});

export const LessonProgressResponseSchema = z.object({
  completedAt: z.string().datetime().nullable(),
  lessonId: z.string().uuid(),
  status: LearningProgressStatusSchema,
  watchedSeconds: z.number().int().nonnegative(),
});

export type LessonProgressResponse = z.infer<typeof LessonProgressResponseSchema>;

export interface LearningProvider {
  getStudentDashboard(userId: string): Promise<StudentLearningDashboardResponse>;
  updateLessonProgress(input: {
    lessonId: string;
    userId: string;
    watchedSeconds: number;
  }): Promise<LessonProgressResponse | null>;
}

export interface PaymentProvider {
  createPaymentIntent(input: {
    amountMinor: number;
    currency: string;
    userId: string;
  }): Promise<{ externalId: string; status: "pending" | "approved" | "rejected" }>;
}

export interface MailProvider {
  send(input: { subject: string; text: string; to: string }): Promise<{ messageId: string }>;
}
