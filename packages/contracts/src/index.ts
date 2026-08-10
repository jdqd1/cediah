import { z } from "zod";

export const HealthResponseSchema = z.object({
  checkedAt: z.string().datetime(),
  environment: z.enum(["development", "test", "production"]),
  service: z.literal("cediah-api"),
  status: z.literal("ok"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const PlatformRoleSchema = z.enum([
  "student",
  "community_contributor",
  "presenter",
  "academic_editor",
  "coordination",
  "finance_readonly",
  "administrator",
]);

export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

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

export const ContentKindSchema = z.enum(["video", "guide", "quiz", "flashcards", "topic"]);
export const ContentStatusSchema = z.enum([
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "archived",
]);

export type ContentKind = z.infer<typeof ContentKindSchema>;
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Only HTTPS URLs are accepted",
  });

const ContentDraftBaseSchema = z.object({
  estimatedMinutes: z.number().int().min(0).max(100_000).nullable().default(null),
  featured: z.boolean().default(false),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().trim().min(1).max(2_000),
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(120),
});

export const GuideSectionSchema = z.object({
  body: z.string().trim().min(1).max(30_000),
  heading: z.string().trim().min(1).max(200),
});

export const QuizQuestionSchema = z
  .object({
    correctOptionIndex: z.number().int().min(0),
    explanation: z.string().trim().max(4_000).default(""),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
    prompt: z.string().trim().min(1).max(2_000),
  })
  .superRefine((question, context) => {
    if (question.correctOptionIndex >= question.options.length) {
      context.addIssue({
        code: "custom",
        message: "correctOptionIndex must reference an existing option",
        path: ["correctOptionIndex"],
      });
    }
  });

export const FlashcardSchema = z.object({
  back: z.string().trim().min(1).max(4_000),
  front: z.string().trim().min(1).max(2_000),
});

export const ContentDraftSchema = z.discriminatedUnion("kind", [
  ContentDraftBaseSchema.extend({
    content: z.object({
      description: z.string().trim().min(1).max(10_000),
      durationSeconds: z.number().int().min(0).max(86_400).nullable().default(null),
      externalUrl: HttpsUrlSchema.nullable().default(null),
      keyPoints: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    }),
    kind: z.literal("video"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      sections: z.array(GuideSectionSchema).max(100).default([]),
    }),
    kind: z.literal("guide"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      questions: z.array(QuizQuestionSchema).min(1).max(100),
    }),
    kind: z.literal("quiz"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      cards: z.array(FlashcardSchema).min(1).max(500),
    }),
    kind: z.literal("flashcards"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      introduction: z.string().trim().min(1).max(20_000),
      objectives: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    }),
    kind: z.literal("topic"),
  }),
]);

export type ContentDraft = z.infer<typeof ContentDraftSchema>;

export const ContentAssetKindSchema = z.enum(["video", "document", "image"]);
export const ContentAssetMimeTypeSchema = z.enum([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ContentAssetSchema = z.object({
  contentId: z.string().uuid(),
  downloadUrl: z.string().url().nullable().default(null),
  fileName: z.string().min(1).max(255),
  id: z.string().uuid(),
  kind: ContentAssetKindSchema,
  mimeType: ContentAssetMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(500_000_000),
  status: z.enum(["pending", "ready"]),
});

export type ContentAsset = z.infer<typeof ContentAssetSchema>;
export type ContentAssetKind = z.infer<typeof ContentAssetKindSchema>;

const ContentRecordSchema = z.object({
  asset: ContentAssetSchema.nullable().default(null),
  authorUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  publishedAt: z.string().datetime().nullable(),
  status: ContentStatusSchema,
  updatedAt: z.string().datetime(),
});

export const ContentItemSchema = z.intersection(ContentDraftSchema, ContentRecordSchema);
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const ContentCatalogResponseSchema = z.object({
  items: z.array(ContentItemSchema),
});

export type ContentCatalogResponse = z.infer<typeof ContentCatalogResponseSchema>;

export const ContentCapabilitiesSchema = z.object({
  canCreate: z.boolean(),
  canEditAll: z.boolean(),
  canPublish: z.boolean(),
  canReview: z.boolean(),
  canUpload: z.boolean(),
});

export type ContentCapabilities = z.infer<typeof ContentCapabilitiesSchema>;

export const ContentWorkspaceResponseSchema = z.object({
  capabilities: ContentCapabilitiesSchema,
  items: z.array(ContentItemSchema),
  roles: z.array(PlatformRoleSchema),
});

export type ContentWorkspaceResponse = z.infer<typeof ContentWorkspaceResponseSchema>;

export const CreateContentRequestSchema = ContentDraftSchema;
export const UpdateContentRequestSchema = ContentDraftSchema;
export const ContentTransitionRequestSchema = z.object({
  status: z.enum(["in_review", "changes_requested", "approved", "published", "archived"]),
});

export type CreateContentRequest = z.infer<typeof CreateContentRequestSchema>;
export type UpdateContentRequest = z.infer<typeof UpdateContentRequestSchema>;
export type ContentTransitionRequest = z.infer<typeof ContentTransitionRequestSchema>;

export const ContentAssetUploadRequestSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((value) => !UnsafeFileNameCharacters.test(value), {
        message: "fileName must be a file basename",
      }),
    fileSizeBytes: z.number().int().positive().max(500_000_000),
    kind: ContentAssetKindSchema,
    mimeType: ContentAssetMimeTypeSchema,
  })
  .superRefine((file, context) => {
    const matchesKind =
      (file.kind === "video" && file.mimeType.startsWith("video/")) ||
      (file.kind === "document" && file.mimeType === "application/pdf") ||
      (file.kind === "image" && file.mimeType.startsWith("image/"));

    if (!matchesKind) {
      context.addIssue({
        code: "custom",
        message: "mimeType must match the asset kind",
        path: ["mimeType"],
      });
    }
  });

export const ContentAssetUploadResponseSchema = z.object({
  asset: ContentAssetSchema,
  constraints: z.object({
    maxFileSizeBytes: z.number().int().positive(),
  }),
  upload: z.object({
    path: z.string().min(1),
    token: z.string().min(1),
    url: z.string().url(),
  }),
});

export type ContentAssetUploadRequest = z.infer<typeof ContentAssetUploadRequestSchema>;
export type ContentAssetUploadResponse = z.infer<typeof ContentAssetUploadResponseSchema>;

export type ContentMutationFailure =
  | "conflict"
  | "forbidden"
  | "not_found"
  | "not_publishable";

export type ContentMutationResult<T> =
  | { status: "success"; value: T }
  | { status: ContentMutationFailure };
export const AdminRoleActionSchema = z.enum(["assign", "revoke"]);
export const AdminRoleUserSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
  roles: z.array(PlatformRoleSchema),
});
export const AdminRoleLookupQuerySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export const AdminRoleMutationRequestSchema = z.object({
  action: AdminRoleActionSchema,
  email: z.string().trim().toLowerCase().email(),
  role: PlatformRoleSchema,
});
export const AdminRoleResponseSchema = z.object({
  user: AdminRoleUserSchema,
});

export type AdminRoleAction = z.infer<typeof AdminRoleActionSchema>;
export type AdminRoleUser = z.infer<typeof AdminRoleUserSchema>;
export type AdminRoleMutationRequest = z.infer<typeof AdminRoleMutationRequestSchema>;
export type AdminRoleResponse = z.infer<typeof AdminRoleResponseSchema>;

export type RoleManagementFailure =
  | "forbidden"
  | "last_administrator"
  | "not_found"
  | "conflict";

export type RoleManagementResult<T> =
  | { status: "success"; value: T }
  | { status: RoleManagementFailure };

export interface RoleManagementProvider {
  getRoles(userId: string): Promise<PlatformRole[]>;
  lookupUserByEmail(email: string): Promise<AdminRoleUser | null>;
  mutateRole(input: {
    action: AdminRoleAction;
    actorUserId: string;
    email: string;
    role: PlatformRole;
  }): Promise<RoleManagementResult<AdminRoleUser>>;
}

export interface ContentProvider {
  createAssetUpload(input: {
    actorUserId: string;
    contentId: string;
    file: ContentAssetUploadRequest;
    roles: PlatformRole[];
  }): Promise<ContentMutationResult<ContentAssetUploadResponse>>;
  createContent(input: {
    actorUserId: string;
    draft: ContentDraft;
  }): Promise<ContentMutationResult<ContentItem>>;
  finalizeAsset(input: {
    actorUserId: string;
    assetId: string;
    roles: PlatformRole[];
  }): Promise<ContentMutationResult<ContentAsset>>;
  getPublishedBySlug(slug: string): Promise<ContentItem | null>;
  getRoles(userId: string): Promise<PlatformRole[]>;
  getWorkspace(input: {
    actorUserId: string;
    roles: PlatformRole[];
  }): Promise<ContentItem[]>;
  listPublished(input: {
    kind?: ContentKind;
    limit: number;
  }): Promise<ContentItem[]>;
  transitionContent(input: {
    actorUserId: string;
    contentId: string;
    roles: PlatformRole[];
    status: ContentTransitionRequest["status"];
  }): Promise<ContentMutationResult<ContentItem>>;
  updateContent(input: {
    actorUserId: string;
    contentId: string;
    draft: ContentDraft;
    roles: PlatformRole[];
  }): Promise<ContentMutationResult<ContentItem>>;
}
