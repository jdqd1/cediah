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
  "content_creator",
  "coordinator",
  "administrator",
]);

export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

export const CurrentUserSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
});

export const CurrentUserResponseSchema = z.object({
  roles: z.array(PlatformRoleSchema).default([]),
  user: CurrentUserSchema,
});

export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;

export type ProviderUser = {
  email: string;
  id: string;
};

export type IdentityRequest = {
  authorization?: string;
  cookie?: string;
  forwardedFor?: string;
  userAgent?: string;
};

export interface IdentityProvider {
  getUser(request: IdentityRequest): Promise<ProviderUser | null>;
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
  uploadType?: "multipart_post" | "signed_put";
  uploadPath?: string;
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
  durationSeconds: z.number().finite().positive().max(36_000),
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
    uploadType: z.enum(["multipart_post", "signed_put"]).default("multipart_post"),
    uploadPath: z.string().min(1).optional(),
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
    durationSeconds: number;
    expiresAt: string;
    fileSizeBytes: number;
    maxDurationSeconds: number;
    mimeType: TestVideoUploadRequest["mimeType"];
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

export const SubjectSchema = z.object({
  contentCount: z.number().int().min(0).default(0),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type Subject = z.infer<typeof SubjectSchema>;

export const SubjectCatalogResponseSchema = z.object({
  subjects: z.array(SubjectSchema),
});

export const SubjectCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const SubjectResponseSchema = z.object({
  subject: SubjectSchema,
});

export const DeletedSubjectSchema = z.object({
  id: z.string().uuid(),
});

export type SubjectCreateRequest = z.infer<typeof SubjectCreateRequestSchema>;

const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Only HTTPS URLs are accepted",
  });

export const RichTextTextAlignSchema = z.enum(["left", "center", "right", "justify"]);

export type RichTextTextAlign = z.infer<typeof RichTextTextAlignSchema>;

const RichTextColorSchema = z
  .string()
  .regex(/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i, {
    message: "Colors must use hexadecimal notation",
  });

const RichTextLinkHrefSchema = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Rich text links must use HTTPS",
  });

export const RichTextMarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("underline") }).strict(),
  z.object({ type: z.literal("strike") }).strict(),
  z.object({ type: z.literal("code") }).strict(),
  z.object({ type: z.literal("subscript") }).strict(),
  z.object({ type: z.literal("superscript") }).strict(),
  z
    .object({
      attrs: z
        .object({
          href: RichTextLinkHrefSchema,
          class: z.string().trim().min(1).max(100).nullable().optional(),
          rel: z.string().trim().min(1).max(100).nullable().optional(),
          target: z.enum(["_blank", "_self"]).nullable().optional(),
        })
        .strict(),
      type: z.literal("link"),
    })
    .strict(),
  z
    .object({
      attrs: z.object({ color: RichTextColorSchema.nullable().optional() }).strict().optional(),
      type: z.literal("highlight"),
    })
    .strict(),
  z
    .object({
      attrs: z.object({ color: RichTextColorSchema.nullable().optional() }).strict(),
      type: z.literal("textStyle"),
    })
    .strict(),
]);

export type RichTextMark = z.infer<typeof RichTextMarkSchema>;

export type RichTextNode =
  | {
      attrs?: { textAlign?: RichTextTextAlign | null };
      content?: RichTextNode[];
      type: "paragraph";
    }
  | {
      attrs: { level: number; textAlign?: RichTextTextAlign | null };
      content?: RichTextNode[];
      type: "heading";
    }
  | {
      content?: RichTextNode[];
      type: "bulletList";
    }
  | {
      attrs?: { start?: number };
      content?: RichTextNode[];
      type: "orderedList";
    }
  | {
      content?: RichTextNode[];
      type: "listItem";
    }
  | {
      content?: RichTextNode[];
      type: "blockquote";
    }
  | {
      content?: RichTextNode[];
      type: "table";
    }
  | {
      content?: RichTextNode[];
      type: "tableRow";
    }
  | {
      attrs?: {
        colspan?: number;
        rowspan?: number;
        colwidth?: number[] | null;
      };
      content?: RichTextNode[];
      type: "tableCell" | "tableHeader";
    }
  | {
      attrs?: { language?: string | null };
      content?: RichTextNode[];
      type: "codeBlock";
    }
  | {
      marks?: RichTextMark[];
      text: string;
      type: "text";
    }
  | {
      type: "hardBreak" | "horizontalRule";
    }
  | {
      attrs: {
        alt?: string | null;
        height?: number | null;
        src: string;
        title?: string | null;
        width?: number | null;
      };
      type: "image";
    };

const RichTextChildrenSchema = z
  .array(z.lazy((): z.ZodType<RichTextNode> => RichTextNodeSchema))
  .max(500)
  .optional();

const RichTextAlignmentAttrsSchema = z
  .object({
    textAlign: RichTextTextAlignSchema.nullable().optional(),
  })
  .strict();

const RichTextTableCellAttrsSchema = z
  .object({
    colspan: z.number().int().min(1).max(100).optional(),
    rowspan: z.number().int().min(1).max(100).optional(),
    colwidth: z.array(z.number().int().positive().max(10_000)).max(100).nullable().optional(),
  })
  .strict();

export const RichTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z
      .object({
        marks: z.array(RichTextMarkSchema).max(12).optional(),
        text: z.string().min(1).max(20_000),
        type: z.literal("text"),
      })
      .strict(),
    z
      .object({
        attrs: RichTextAlignmentAttrsSchema.optional(),
        content: RichTextChildrenSchema,
        type: z.literal("paragraph"),
      })
      .strict(),
    z
      .object({
        attrs: RichTextAlignmentAttrsSchema.extend({
          level: z.number().int().min(1).max(6),
        }).strict(),
        content: RichTextChildrenSchema,
        type: z.literal("heading"),
      })
      .strict(),
    z
      .object({
        content: RichTextChildrenSchema,
        type: z.literal("bulletList"),
      })
      .strict(),
    z
      .object({
        attrs: z.object({ start: z.number().int().min(1).max(1_000_000).optional() }).strict().optional(),
        content: RichTextChildrenSchema,
        type: z.literal("orderedList"),
      })
      .strict(),
    z
      .object({
        content: RichTextChildrenSchema,
        type: z.literal("listItem"),
      })
      .strict(),
    z
      .object({
        content: RichTextChildrenSchema,
        type: z.literal("blockquote"),
      })
      .strict(),
    z
      .object({
        content: RichTextChildrenSchema,
        type: z.literal("table"),
      })
      .strict(),
    z
      .object({
        content: RichTextChildrenSchema,
        type: z.literal("tableRow"),
      })
      .strict(),
    z
      .object({
        attrs: RichTextTableCellAttrsSchema.optional(),
        content: RichTextChildrenSchema,
        type: z.enum(["tableCell", "tableHeader"]),
      })
      .strict(),
    z
      .object({
        attrs: z
          .object({ language: z.string().trim().min(1).max(50).nullable().optional() })
          .strict()
          .optional(),
        content: RichTextChildrenSchema,
        type: z.literal("codeBlock"),
      })
      .strict(),
    z.object({ type: z.literal("hardBreak") }).strict(),
    z.object({ type: z.literal("horizontalRule") }).strict(),
    z
      .object({
        attrs: z
          .object({
            alt: z.string().trim().max(500).nullable().optional(),
            height: z.number().int().positive().max(10_000).nullable().optional(),
            src: HttpsUrlSchema.max(2_048),
            title: z.string().trim().max(500).nullable().optional(),
            width: z.number().int().positive().max(10_000).nullable().optional(),
          })
          .strict(),
        type: z.literal("image"),
      })
      .strict(),
  ]),
);

const RichTextBlockNodeTypes = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "table",
  "codeBlock",
  "horizontalRule",
  "image",
]);

const RichTextInlineNodeTypes = new Set(["text", "hardBreak"]);
const RichTextMaxDepth = 12;
const RichTextMaxNodes = 2_000;
const RichTextMaxTextCharacters = 200_000;
const RichTextMaxInputValues = 20_000;
const RichTextMaxInputCharacters = 500_000;

function inspectRichTextInput(value: unknown, context: z.RefinementCtx): void {
  const pending: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }];
  const seen = new WeakSet<object>();
  let characterCount = 0;
  let valueCount = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    valueCount += 1;

    if (valueCount > RichTextMaxInputValues) {
      context.addIssue({ code: "custom", message: "Rich text document has too many values" });
      return;
    }

    if (current.depth > RichTextMaxDepth * 3) {
      context.addIssue({ code: "custom", message: "Rich text document is nested too deeply" });
      return;
    }

    if (typeof current.value === "string") {
      characterCount += current.value.length;
    } else if (typeof current.value === "object" && current.value !== null) {
      if (seen.has(current.value)) {
        context.addIssue({ code: "custom", message: "Rich text document must be a JSON tree" });
        return;
      }
      seen.add(current.value);

      if (Array.isArray(current.value)) {
        for (const entry of current.value) {
          pending.push({ depth: current.depth + 1, value: entry });
        }
      } else {
        for (const [key, entry] of Object.entries(current.value)) {
          characterCount += key.length;
          pending.push({ depth: current.depth + 1, value: entry });
        }
      }
    }

    if (characterCount > RichTextMaxInputCharacters) {
      context.addIssue({ code: "custom", message: "Rich text document is too large" });
      return;
    }
  }
}

function validateRichTextDocument(
  document: { content: RichTextNode[]; type: "doc" },
  context: z.RefinementCtx,
): void {
  const pending = document.content.map((node) => ({ depth: 1, node, parentType: "doc" }));
  let nodeCount = 0;
  let textCharacters = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    nodeCount += 1;

    if (nodeCount > RichTextMaxNodes) {
      context.addIssue({ code: "custom", message: `Rich text documents support at most ${RichTextMaxNodes} nodes` });
      return;
    }
    if (current.depth > RichTextMaxDepth) {
      context.addIssue({ code: "custom", message: `Rich text documents support at most ${RichTextMaxDepth} nested nodes` });
      return;
    }

    const allowed =
      current.parentType === "paragraph" || current.parentType === "heading"
        ? RichTextInlineNodeTypes.has(current.node.type)
        : current.parentType === "codeBlock"
          ? current.node.type === "text"
          : current.parentType === "bulletList" || current.parentType === "orderedList"
            ? current.node.type === "listItem"
            : current.parentType === "table"
              ? current.node.type === "tableRow"
              : current.parentType === "tableRow"
                ? current.node.type === "tableCell" || current.node.type === "tableHeader"
                : current.parentType === "tableCell" || current.parentType === "tableHeader"
                  ? RichTextBlockNodeTypes.has(current.node.type) && current.node.type !== "table"
            : current.parentType === "doc" || current.parentType === "listItem" || current.parentType === "blockquote"
              ? RichTextBlockNodeTypes.has(current.node.type)
              : false;

    if (!allowed) {
      context.addIssue({
        code: "custom",
        message: `${current.node.type} is not valid inside ${current.parentType}`,
      });
      return;
    }

    if (current.node.type === "text") {
      textCharacters += current.node.text.length;
      if (textCharacters > RichTextMaxTextCharacters) {
        context.addIssue({
          code: "custom",
          message: `Rich text documents support at most ${RichTextMaxTextCharacters} text characters`,
        });
        return;
      }
      continue;
    }

    if ("content" in current.node && current.node.content) {
      for (const child of current.node.content) {
        pending.push({ depth: current.depth + 1, node: child, parentType: current.node.type });
      }
    }
  }
}

const RichTextDocumentShapeSchema = z
  .object({
    content: z.array(RichTextNodeSchema).max(500).default([]),
    type: z.literal("doc"),
  })
  .strict()
  .superRefine(validateRichTextDocument);

export const RichTextDocumentSchema = z
  .unknown()
  .superRefine(inspectRichTextInput)
  .pipe(RichTextDocumentShapeSchema);

export type RichTextDocument = z.infer<typeof RichTextDocumentSchema>;

const ContentDraftBaseSchema = z.object({
  estimatedMinutes: z.number().int().min(0).max(100_000).nullable().default(null),
  featured: z.boolean().default(false),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().trim().max(2_000),
  subjectIds: z.array(z.string().uuid()).max(20).default([]),
  title: z.string().trim().max(200),
  topic: z.string().trim().max(120),
});

const PublishableContentDraftBaseSchema = ContentDraftBaseSchema.extend({
  summary: z.string().trim().min(1).max(2_000),
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(120),
});

export const GuideSectionSchema = z.object({
  body: z.string().trim().min(1).max(30_000),
  heading: z.string().trim().min(1).max(200),
});

export type GuideSection = z.infer<typeof GuideSectionSchema>;

const DraftGuideSectionSchema = z.object({
  body: z.string().trim().max(30_000),
  heading: z.string().trim().max(200),
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

// Guide companions are authored incrementally. Empty fields are valid while a
// publication is still a draft; the API readiness check prevents incomplete
// questions from entering review or being published.
export const GuideQuizQuestionSchema = z
  .object({
    correctOptionIndex: z.number().int().min(0),
    explanation: z.string().trim().max(4_000).default(""),
    options: z.array(z.string().trim().max(500)).min(2).max(8),
    prompt: z.string().trim().max(2_000),
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

const DraftFlashcardSchema = z.object({
  back: z.string().trim().max(4_000),
  front: z.string().trim().max(2_000),
});

export const ContentRegionsSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(12)
  .default([]);

export type ContentRegions = z.infer<typeof ContentRegionsSchema>;

const DraftGuideDocumentSchema = z.object({
  document: RichTextDocumentSchema.nullable().default(null),
  sections: z.array(DraftGuideSectionSchema).max(100).default([]),
});

const PublishableGuideDocumentSchema = z.object({
  document: RichTextDocumentSchema.nullable().default(null),
  sections: z.array(GuideSectionSchema).max(100).default([]),
});

export const ContentDraftSchema = z.discriminatedUnion("kind", [
  ContentDraftBaseSchema.extend({
    content: z.object({
      description: z.string().trim().max(10_000),
      durationSeconds: z.number().int().min(0).max(86_400).nullable().default(null),
      externalUrl: HttpsUrlSchema.nullable().default(null),
      guide: DraftGuideDocumentSchema.default({ document: null, sections: [] }),
      keyPoints: z.array(z.string().trim().max(500)).max(30).default([]),
      quiz: z
        .object({
          questions: z.array(GuideQuizQuestionSchema).max(100).default([]),
        })
        .default({ questions: [] }),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("video"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      document: RichTextDocumentSchema.nullable().default(null),
      keyPoints: z.array(z.string().trim().max(500)).max(30).default([]),
      linkedVideoId: z.string().uuid().nullable().default(null),
      quiz: z
        .object({
          questions: z.array(GuideQuizQuestionSchema).max(100).default([]),
        })
        .default({ questions: [] }),
      regions: ContentRegionsSchema,
      sections: z.array(DraftGuideSectionSchema).max(100).default([]),
    }),
    kind: z.literal("guide"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      questions: z.array(GuideQuizQuestionSchema).max(100).default([]),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("quiz"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      cards: z.array(DraftFlashcardSchema).max(500).default([]),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("flashcards"),
  }),
  ContentDraftBaseSchema.extend({
    content: z.object({
      introduction: z.string().trim().max(20_000),
      objectives: z.array(z.string().trim().max(500)).max(30).default([]),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("topic"),
  }),
]);

export type ContentDraft = z.infer<typeof ContentDraftSchema>;

/**
 * Strict publication contract. Drafts may contain empty authoring fields so
 * progress can be persisted, but review, approval and publication must satisfy
 * this schema in addition to asset-specific readiness checks in the API.
 */
export const PublishableContentDraftSchema = z.discriminatedUnion("kind", [
  PublishableContentDraftBaseSchema.extend({
    content: z.object({
      description: z.string().trim().min(1).max(10_000),
      durationSeconds: z.number().int().min(0).max(86_400).nullable().default(null),
      externalUrl: HttpsUrlSchema.nullable().default(null),
      guide: PublishableGuideDocumentSchema.default({ document: null, sections: [] }),
      keyPoints: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
      quiz: z.object({
        questions: z.array(QuizQuestionSchema).min(1).max(100),
      }),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("video"),
  }),
  PublishableContentDraftBaseSchema.extend({
    content: z.object({
      document: RichTextDocumentSchema.nullable().default(null),
      keyPoints: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
      linkedVideoId: z.string().uuid().nullable().default(null),
      quiz: z
        .object({
          questions: z.array(QuizQuestionSchema).max(100).default([]),
        })
        .default({ questions: [] }),
      regions: ContentRegionsSchema,
      sections: z.array(GuideSectionSchema).max(100).default([]),
    }),
    kind: z.literal("guide"),
  }),
  PublishableContentDraftBaseSchema.extend({
    content: z.object({
      questions: z.array(QuizQuestionSchema).min(1).max(100),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("quiz"),
  }),
  PublishableContentDraftBaseSchema.extend({
    content: z.object({
      cards: z.array(FlashcardSchema).min(1).max(500),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("flashcards"),
  }),
  PublishableContentDraftBaseSchema.extend({
    content: z.object({
      introduction: z.string().trim().min(1).max(20_000),
      objectives: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
      regions: ContentRegionsSchema,
    }),
    kind: z.literal("topic"),
  }),
]);

export type PublishableContentDraft = z.infer<typeof PublishableContentDraftSchema>;

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
  // PostgreSQL clients may serialize `timestamptz` values with a UTC offset
  // (`+00:00`) or with the equivalent `Z` suffix. Both are valid RFC 3339
  // timestamps and must be accepted at this service boundary.
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  status: ContentStatusSchema,
  updatedAt: z.string().datetime({ offset: true }),
});

export const ContentItemSchema = z.intersection(ContentDraftSchema, ContentRecordSchema);
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const ContentCatalogResponseSchema = z.object({
  items: z.array(ContentItemSchema),
});

export type ContentCatalogResponse = z.infer<typeof ContentCatalogResponseSchema>;

export const ContentCapabilitiesSchema = z.object({
  canCreate: z.boolean(),
  canDeleteContent: z.boolean(),
  canEditAll: z.boolean(),
  canManageTaxonomy: z.boolean(),
  canPublish: z.boolean(),
  canReview: z.boolean(),
  canUpload: z.boolean(),
});

export type ContentCapabilities = z.infer<typeof ContentCapabilitiesSchema>;

export const ContentTopicSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subjectIds: z.array(z.string().uuid()),
});

export type ContentTopic = z.infer<typeof ContentTopicSchema>;

export const ContentWorkspaceResponseSchema = z.object({
  capabilities: ContentCapabilitiesSchema,
  items: z.array(ContentItemSchema),
  roles: z.array(PlatformRoleSchema),
  subjects: z.array(SubjectSchema).default([]),
  topics: z.array(ContentTopicSchema).default([]),
});

export type ContentWorkspaceResponse = z.infer<typeof ContentWorkspaceResponseSchema>;
export const ContentSubjectAssignmentRequestSchema = z.object({
  subjectIds: z.array(z.string().uuid()).max(20).default([]),
});
export type ContentSubjectAssignmentRequest = z.infer<typeof ContentSubjectAssignmentRequestSchema>;


export const CreateContentRequestSchema = ContentDraftSchema;
export const UpdateContentRequestSchema = ContentDraftSchema;
export const ContentTransitionRequestSchema = z.object({
  status: z.enum(["in_review", "changes_requested", "approved", "published", "archived"]),
});

export type CreateContentRequest = z.infer<typeof CreateContentRequestSchema>;
export type UpdateContentRequest = z.infer<typeof UpdateContentRequestSchema>;
export type ContentTransitionRequest = z.infer<typeof ContentTransitionRequestSchema>;

export const SubjectDetailResponseSchema = z.object({
  items: z.array(ContentItemSchema),
  subject: SubjectSchema,
});

export type SubjectDetailResponse = z.infer<typeof SubjectDetailResponseSchema>;

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

export type SubjectMutationFailure = "conflict" | "forbidden" | "not_found";

export type SubjectMutationResult<T> =
  | { status: "success"; value: T }
  | { status: SubjectMutationFailure };

export interface SubjectProvider {
  createSubject(input: {
    actorUserId: string;
    name: string;
  }): Promise<SubjectMutationResult<Subject>>;
  deleteSubject(input: {
    actorUserId: string;
    subjectId: string;
  }): Promise<SubjectMutationResult<{ id: string }>>;
  getSubjectBySlug(slug: string): Promise<Subject | null>;
  listSubjects(input?: { publishedOnly?: boolean }): Promise<Subject[]>;
}

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
  assignSubjects?(input: {
    actorUserId: string;
    contentId: string;
    roles: PlatformRole[];
    subjectIds: string[];
  }): Promise<ContentMutationResult<ContentItem>>;
  createContent(input: {
    actorUserId: string;
    draft: ContentDraft;
    roles: PlatformRole[];
  }): Promise<ContentMutationResult<ContentItem>>;
  deleteContent(input: {
    actorUserId: string;
    contentId: string;
    roles: PlatformRole[];
  }): Promise<ContentMutationResult<{ id: string }>>;
  deleteAsset(input: {
    actorUserId: string;
    assetId: string;
    roles: PlatformRole[];
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
    linkedVideoId?: string;
    limit: number;
    subjectId?: string;
  }): Promise<ContentItem[]>;
  listTopics?(): Promise<ContentTopic[]>;
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
