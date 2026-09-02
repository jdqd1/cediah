import { describe, expect, it } from "vitest";
import {
  ContentDraftSchema,
  ContentItemSchema,
  PublishableContentDraftSchema,
  RichTextDocumentSchema,
} from "@cediah/contracts";
import type {
  ContentAsset,
  ContentAssetUploadRequest,
  ContentAssetUploadResponse,
  ContentDraft,
  ContentItem,
  ContentProvider,
  ContentReaction,
  IdentityProvider,
  PlatformRole,
  ProviderUser,
  SubjectProvider,
} from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import {
  canEditContent,
  getContentCapabilities,
  isPublishedPermittedUpdate,
} from "../src/content-authorization.js";
import type { ApiEnvironment } from "../src/config.js";
import {
  areContentTopicsAllowed,
  isContentReadyForTransition,
  isContentTransitionAllowed,
} from "../src/providers/postgres-content.js";

const contentId = "7a8a6513-9384-4b5d-a825-439f42355714";
const subjectId = "19d4f11b-9ff1-45c2-b2b5-50686038fe42";
const secondSubjectId = "89c55c8a-90e5-44c1-95b5-feb6d301acda";
const assetId = "86bc79c0-c73b-4aa6-9257-f22f0d89b080";
const linkedVideoId = "16a730c2-f283-45bc-80fd-8a8fbfe11345";
const createdAt = "2026-08-10T12:00:00.000Z";
const publishedAt = "2026-08-10T13:00:00.000Z";

const users = {
  administrator: { email: "administrator@example.test", id: "f4d9e932-aab8-4f7b-8946-b3ec486c2573" },
  contributor: { email: "contributor@example.test", id: "20402bbc-63e1-437f-ad0d-71d4c73a9d8f" },
  coordinator: { email: "coordinator@example.test", id: "df747a77-f05c-4bec-a2d9-29dd0de7ec33" },
  editor: { email: "editor@example.test", id: "466ac8eb-6473-4a9e-a4ee-1ef992671ffa" },
  student: { email: "student@example.test", id: "04761a7d-4c02-48d7-b3a2-94b8baadf021" },
} satisfies Record<string, ProviderUser>;

const testEnvironment: ApiEnvironment = {
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

const guideDraft: ContentDraft = {
  content: {
    document: null,
    keyPoints: [],
    linkedVideoId: null,
    quiz: { questions: [] },
    regions: [],
    sections: [{ body: "Verified anatomy content.", heading: "Introduction" }],
  },
  estimatedMinutes: 15,
  featured: false,
  kind: "guide",
  slug: "thorax-guide",
  subjectIds: [],
  summary: "A concise guide used by the content API tests.",
  title: "Thorax guide",
  topic: "Thorax",
};

const taxonomyTopicDraft: ContentDraft = {
  content: {
    introduction: "Overview of the thorax study unit.",
    objectives: [],
    regions: ["Thorax"],
  },
  estimatedMinutes: null,
  featured: false,
  kind: "topic",
  slug: "thorax-topic",
  subjectIds: [subjectId],
  summary: "Structural topic used by authorization tests.",
  title: "Thorax",
  topic: "Thorax",
};

const partialGuideDraft: ContentDraft = {
  content: {
    document: null,
    keyPoints: [],
    linkedVideoId: null,
    quiz: { questions: [] },
    regions: [],
    sections: [],
  },
  estimatedMinutes: null,
  featured: false,
  kind: "guide",
  slug: "guide-draft-in-progress",
  subjectIds: [],
  summary: "",
  title: "",
  topic: "",
};

function guideItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    ...guideDraft,
    asset: null,
    authorUserId: users.contributor.id,
    createdAt,
    id: contentId,
    publishedAt: null,
    status: "draft",
    updatedAt: createdAt,
    ...overrides,
  } as ContentItem;
}

type VideoDraft = Extract<ContentDraft, { kind: "video" }>;

const completeVideoDraft: VideoDraft = {
  content: {
    description: "A complete anatomy video package.",
    durationSeconds: null,
    externalUrl: null,
    guide: {
      document: null,
      sections: [{ body: "Review the anatomical relationships.", heading: "Study guide" }],
    },
    keyPoints: ["Identify the principal anatomical landmark."],
    quiz: {
      questions: [
        {
          correctOptionIndex: 0,
          explanation: "The first option identifies the landmark.",
          options: ["Correct landmark", "Distractor"],
          prompt: "Which option identifies the landmark?",
        },
      ],
    },
    regions: [],
  },
  estimatedMinutes: null,
  featured: false,
  kind: "video",
  slug: "anatomy-video",
  subjectIds: [],
  summary: "A video package used by the content readiness tests.",
  title: "Anatomy video",
  topic: "Anatomy",
};

const readyVideoAsset: ContentAsset = {
  contentId,
  downloadUrl: "https://storage.example.test/anatomy-video.mp4",
  fileName: "anatomy-video.mp4",
  id: assetId,
  kind: "video",
  mimeType: "video/mp4",
  sizeBytes: 2048,
  status: "ready",
};

function videoItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    ...completeVideoDraft,
    asset: readyVideoAsset,
    authorUserId: users.contributor.id,
    createdAt,
    id: contentId,
    publishedAt: null,
    status: "draft",
    updatedAt: createdAt,
    ...overrides,
  } as ContentItem;
}

function itemFromDraft(draft: ContentDraft): ContentItem {
  return {
    ...draft,
    asset: null,
    authorUserId: users.contributor.id,
    createdAt,
    id: contentId,
    publishedAt: null,
    status: "draft",
    updatedAt: createdAt,
  } as ContentItem;
}

function identityProvider(): IdentityProvider {
  const byToken = new Map<string, ProviderUser>([
    ["administrator-token", users.administrator],
    ["contributor-token", users.contributor],
    ["coordinator-token", users.coordinator],
    ["editor-token", users.editor],
    ["student-token", users.student],
  ]);

  return {
    getUser: async (request) =>
      byToken.get(request.authorization?.replace(/^Bearer\s+/, "") ?? "") ?? null,
    revokeSessions: async () => undefined,
  };
}

function contentProvider(
  roles: PlatformRole[] = [],
  overrides: Partial<ContentProvider> = {},
): ContentProvider {
  return {
    createAssetUpload: async () => ({ status: "not_found" }),
    createContent: async () => ({ status: "conflict" }),
    deleteAsset: async () => ({ status: "not_found" }),
    deleteContent: async () => ({ status: "not_found" }),
    finalizeAsset: async () => ({ status: "not_found" }),
    getPublishedBySlug: async () => null,
    getRoles: async () => roles,
    getWorkspace: async () => [],
    listPublished: async () => [],
    transitionContent: async () => ({ status: "not_found" }),
    updateContent: async () => ({ status: "not_found" }),
    ...overrides,
  };
}

function subjectProvider(overrides: Partial<SubjectProvider> = {}): SubjectProvider {
  return {
    createSubject: async () => ({ status: "conflict" }),
    deleteSubject: async () => ({ status: "not_found" }),
    getSubjectBySlug: async () => null,
    listSubjects: async () => [],
    ...overrides,
  };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe("content API", () => {
  it("records authenticated views using content-scoped opaque keys, never caller-supplied counts", async () => {
    const calls: Array<{ contentId: string; viewerKey: string }> = [];
    const app = await buildApp({ ...testEnvironment, auth: {
      databaseUrl: "postgres://unused.test/test", publicUrl: "http://localhost:4000",
      requireEmailVerification: false, secret: "test-only-content-view-secret-at-least-32-characters", trustedOrigins: [],
    } }, {
      identityProvider: identityProvider(),
      contentProvider: contentProvider([], {
        recordView: async (input) => { calls.push(input); return { status: "success", value: { counted: true } }; },
      }),
    });
    try {
      const url = `/v1/content/${contentId}/views`;
      expect((await app.inject({ method: "POST", url })).statusCode).toBe(401);
      expect(calls).toHaveLength(0);
      const response = await app.inject({ method: "POST", url, headers: auth("student-token"), payload: { viewCount: 9000 } });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json()).toEqual({ counted: true });
      await app.inject({ method: "POST", url, headers: auth("student-token") });
      await app.inject({ method: "POST", url: `/v1/content/${linkedVideoId}/views`, headers: auth("student-token") });
      expect(calls[0]?.viewerKey).toMatch(/^[a-f0-9]{64}$/);
      expect(calls[0]).toEqual(calls[1]);
      expect(calls[2]?.viewerKey).not.toBe(calls[0]?.viewerKey);
      expect(calls[0]).not.toHaveProperty("viewCount");
    } finally { await app.close(); }
  });

  it("passes view ranking to the provider before applying the catalog limit", async () => {
    let input: Parameters<ContentProvider["listPublished"]>[0] | undefined;
    const app = await buildApp(testEnvironment, { contentProvider: contentProvider([], {
      listPublished: async (query) => { input = query; return []; },
    }) });
    try {
      expect((await app.inject({ url: "/v1/content?kind=video&sort=views&limit=8" })).statusCode).toBe(200);
      expect(input).toEqual({ kind: "video", sort: "views", limit: 8 });
      expect((await app.inject({ url: "/v1/content?sort=untrusted" })).statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it("authenticates reaction reads/writes, isolates viewers, and never returns totals", async () => {
    const calls: Array<{ contentId: string; viewerKey: string; reaction?: ContentReaction | null }> = [];
    const saved = new Map<string, ContentReaction | null>();
    const app = await buildApp({ ...testEnvironment, auth: {
      databaseUrl: "postgres://unused.test/test", publicUrl: "http://localhost:4000",
      requireEmailVerification: false, secret: "test-only-reaction-secret-at-least-32-characters", trustedOrigins: [],
    } }, { identityProvider: identityProvider(), contentProvider: contentProvider([], {
      getReaction: async (input) => {
        calls.push(input);
        return { status: "success", value: { reaction: saved.get(input.viewerKey) ?? null, likeCount: 99, dislikeCount: 44 } };
      },
      setReaction: async (input) => {
        calls.push(input);
        saved.set(input.viewerKey, input.reaction);
        return { status: "success", value: { reaction: input.reaction, likeCount: 99 } };
      },
    }) });
    try {
      const url = `/v1/content/${contentId}/reaction`;
      expect((await app.inject({ url })).statusCode).toBe(401);
      expect((await app.inject({ method: "PATCH", url, payload: { reaction: "liked" } })).statusCode).toBe(401);
      expect(calls).toHaveLength(0);
      for (const reaction of ["liked", "disliked", null] as const) {
        const response = await app.inject({ method: "PATCH", url, headers: auth("student-token"), payload: { reaction } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        expect(response.json()).toEqual({ reaction });
        expect((await app.inject({ url, headers: auth("student-token") })).json()).toEqual({ reaction });
      }
      expect(calls[0]?.viewerKey).toMatch(/^[a-f0-9]{64}$/);
      expect(calls[0]?.viewerKey).toBe(calls[1]?.viewerKey);
      await app.inject({ url, headers: auth("editor-token") });
      expect(calls.at(-1)?.viewerKey).not.toBe(calls[0]?.viewerKey);
      await app.inject({ url: `/v1/content/${linkedVideoId}/reaction`, headers: auth("student-token") });
      expect(calls.at(-1)?.viewerKey).not.toBe(calls[0]?.viewerKey);
    } finally { await app.close(); }
  });

  it("rejects malformed or caller-supplied reaction identities and totals", async () => {
    let writes = 0;
    const app = await buildApp({ ...testEnvironment, auth: {
      databaseUrl: "postgres://unused.test/test", publicUrl: "http://localhost:4000",
      requireEmailVerification: false, secret: "test-only-reaction-secret-at-least-32-characters", trustedOrigins: [],
    } }, { identityProvider: identityProvider(), contentProvider: contentProvider([], {
      getReaction: async () => ({ status: "not_found" }),
      setReaction: async () => { writes += 1; return { status: "not_found" }; },
    }) });
    try {
      const url = `/v1/content/${contentId}/reaction`;
      for (const payload of [{}, { reaction: "up" }, { reaction: "liked", viewerKey: "another-user" }, { reaction: "liked", likeCount: 100 }]) {
        expect((await app.inject({ method: "PATCH", url, headers: auth("student-token"), payload })).statusCode).toBe(400);
      }
      expect(writes).toBe(0);
      expect((await app.inject({ url: "/v1/content/invalid/reaction", headers: auth("student-token") })).statusCode).toBe(400);
      expect((await app.inject({ url, headers: auth("student-token") })).statusCode).toBe(404);
      expect((await app.inject({ method: "PATCH", url, headers: auth("student-token"), payload: { reaction: "liked" } })).statusCode).toBe(404);
    } finally { await app.close(); }
  });

  it("returns an unavailable reaction response when persistence is not configured", async () => {
    const app = await buildApp(testEnvironment, { identityProvider: identityProvider(), contentProvider: contentProvider() });
    try {
      for (const method of ["GET", "PATCH"] as const) {
        const response = await app.inject({ method, url: `/v1/content/${contentId}/reaction`, headers: auth("student-token") });
        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({ error: "reactions_unavailable" });
      }
    } finally { await app.close(); }
  });

  it("maps the four platform roles to the requested permission matrix", () => {
    expect(getContentCapabilities(["student"])).toEqual({
      canCreate: false,
      canDeleteContent: false,
      canEditAll: false,
      canManageTaxonomy: false,
      canPublish: false,
      canReview: false,
      canUpload: false,
    });
    expect(getContentCapabilities(["content_creator"])).toEqual({
      canCreate: true,
      canDeleteContent: false,
      canEditAll: false,
      canManageTaxonomy: false,
      canPublish: false,
      canReview: false,
      canUpload: true,
    });
    expect(getContentCapabilities(["coordinator"])).toEqual({
      canCreate: true,
      canDeleteContent: false,
      canEditAll: true,
      canManageTaxonomy: false,
      canPublish: true,
      canReview: true,
      canUpload: true,
    });
    expect(getContentCapabilities(["administrator"])).toEqual({
      canCreate: true,
      canDeleteContent: true,
      canEditAll: true,
      canManageTaxonomy: true,
      canPublish: true,
      canReview: true,
      canUpload: true,
    });
  });

  it("hydrates empty companion content when parsing a legacy video draft", () => {
    const draft = ContentDraftSchema.parse({
      content: {
        description: "A legacy video without companion fields.",
        durationSeconds: null,
        externalUrl: null,
      },
      estimatedMinutes: null,
      featured: false,
      kind: "video",
      slug: "legacy-video",
      summary: "Legacy video fixture.",
      title: "Legacy video",
      topic: "Anatomy",
    });

    expect(draft.kind).toBe("video");
    if (draft.kind !== "video") throw new Error("Expected a video draft");
    expect(draft.content.guide).toEqual({ document: null, sections: [] });
    expect(draft.content.keyPoints).toEqual([]);
    expect(draft.content.quiz).toEqual({ questions: [] });
    expect(draft.content.regions).toEqual([]);
  });

  it("hydrates guide authoring fields and normalizes region tags in a legacy guide", () => {
    const draft = ContentDraftSchema.parse({
      content: {
        regions: ["  Miembro inferior ", " Pelvis"],
        sections: [{ body: "Verified anatomy content.", heading: "Introduction" }],
      },
      kind: "guide",
      slug: "legacy-guide",
      summary: "Legacy guide fixture.",
      title: "Legacy guide",
      topic: "Anatomy",
    });

    expect(draft.kind).toBe("guide");
    if (draft.kind !== "guide") throw new Error("Expected a guide draft");
    expect(draft.content).toEqual({
      document: null,
      keyPoints: [],
      linkedVideoId: null,
      quiz: { questions: [] },
      regions: ["Miembro inferior", "Pelvis"],
      sections: [{ body: "Verified anatomy content.", heading: "Introduction" }],
    });
  });

  it("allows partially written guide companions to be saved as a draft", () => {
    const draft = ContentDraftSchema.parse({
      ...guideDraft,
      content: {
        ...guideDraft.content,
        keyPoints: [""],
        quiz: {
          questions: [
            {
              correctOptionIndex: 0,
              explanation: "",
              options: ["", ""],
              prompt: "",
            },
          ],
        },
      },
    });

    expect(draft.kind).toBe("guide");
    if (draft.kind !== "guide") throw new Error("Expected a guide draft");
    expect(draft.content.keyPoints).toEqual([""]);
    expect(draft.content.quiz.questions[0]?.options).toEqual(["", ""]);
  });

  it("persists incomplete authoring fields only in working draft states", () => {
    const partialDrafts: ContentDraft[] = [
      partialGuideDraft,
      ContentDraftSchema.parse({
        content: {
          description: "",
          guide: { sections: [{ body: "", heading: "" }] },
          keyPoints: [""],
          quiz: {
            questions: [
              { correctOptionIndex: 0, options: ["", ""], prompt: "" },
            ],
          },
        },
        kind: "video",
        slug: "video-draft-in-progress",
        summary: "",
        title: "",
        topic: "",
      }),
      ContentDraftSchema.parse({
        content: {
          questions: [
            { correctOptionIndex: 0, options: ["", ""], prompt: "" },
          ],
        },
        kind: "quiz",
        slug: "quiz-draft-in-progress",
        summary: "",
        title: "",
        topic: "",
      }),
      ContentDraftSchema.parse({
        content: { cards: [{ back: "", front: "" }] },
        kind: "flashcards",
        slug: "flashcards-draft-in-progress",
        summary: "",
        title: "",
        topic: "",
      }),
      ContentDraftSchema.parse({
        content: { introduction: "", objectives: [""] },
        kind: "topic",
        slug: "topic-draft-in-progress",
        summary: "",
        title: "",
        topic: "",
      }),
    ];
    const record = {
      asset: null,
      authorUserId: users.contributor.id,
      createdAt,
      id: contentId,
      publishedAt: null,
      updatedAt: createdAt,
    };

    for (const draft of partialDrafts) {
      expect(ContentDraftSchema.safeParse(draft).success).toBe(true);
      expect(PublishableContentDraftSchema.safeParse(draft).success).toBe(false);
      expect(ContentItemSchema.safeParse({ ...draft, ...record, status: "draft" }).success).toBe(true);
      expect(
        ContentItemSchema.safeParse({ ...draft, ...record, status: "changes_requested" }).success,
      ).toBe(true);
    }
  });

  it("hydrates empty region tags for every remaining legacy content kind", () => {
    const legacyDrafts = [
      {
        content: {
          questions: [
            {
              correctOptionIndex: 0,
              options: ["Correct", "Distractor"],
              prompt: "Which answer is correct?",
            },
          ],
        },
        kind: "quiz",
        slug: "legacy-quiz",
      },
      {
        content: { cards: [{ back: "Answer", front: "Question" }] },
        kind: "flashcards",
        slug: "legacy-flashcards",
      },
      {
        content: { introduction: "Anatomy introduction." },
        kind: "topic",
        slug: "legacy-topic",
      },
    ].map((draft) => ({
      ...draft,
      summary: "Legacy content fixture.",
      title: "Legacy content",
      topic: "Anatomy",
    }));

    for (const legacyDraft of legacyDrafts) {
      expect(ContentDraftSchema.parse(legacyDraft).content.regions).toEqual([]);
    }
  });

  it("accepts bounded Tiptap JSON and rejects unsafe image sources", () => {
    const document = RichTextDocumentSchema.parse({
      content: [
        {
          attrs: { level: 2, textAlign: "center" },
          content: [{ marks: [{ type: "bold" }], text: "Anatomía", type: "text" }],
          type: "heading",
        },
        {
          attrs: {
            alt: "Vista anatómica",
            src: "https://assets.example.test/anatomy.webp",
            title: null,
          },
          type: "image",
        },
      ],
      type: "doc",
    });

    expect(document.type).toBe("doc");
    expect(document.content).toHaveLength(2);
    expect(
      RichTextDocumentSchema.safeParse({
        content: [{ attrs: { src: "http://assets.example.test/anatomy.webp" }, type: "image" }],
        type: "doc",
      }).success,
    ).toBe(false);
  });

  it("requires every video companion before review and publication", () => {
    const incompleteVideos = [
      videoItem({ asset: null }),
      videoItem({
        content: { ...completeVideoDraft.content, keyPoints: [] },
      }),
      videoItem({
        content: {
          ...completeVideoDraft.content,
          guide: { document: null, sections: [] },
        },
      }),
      videoItem({
        content: {
          ...completeVideoDraft.content,
          quiz: { questions: [] },
        },
      }),
      videoItem({
        content: { ...completeVideoDraft.content, keyPoints: [""] },
      }),
      videoItem({
        content: {
          ...completeVideoDraft.content,
          quiz: {
            questions: [
              {
                correctOptionIndex: 0,
                explanation: "",
                options: ["", ""],
                prompt: "",
              },
            ],
          },
        },
      }),
    ];

    expect(isContentReadyForTransition(videoItem(), "in_review")).toBe(true);
    expect(isContentReadyForTransition(videoItem(), "published")).toBe(true);
    for (const item of incompleteVideos) {
      expect(isContentReadyForTransition(item, "in_review")).toBe(false);
      expect(isContentReadyForTransition(item, "published")).toBe(false);
    }
  });

  it("keeps complete legacy externally hosted videos publishable", () => {
    const item = videoItem({
      asset: null,
      content: {
        ...completeVideoDraft.content,
        externalUrl: "https://videos.example.test/anatomy-video",
      },
    });

    expect(isContentReadyForTransition(item, "in_review")).toBe(true);
    expect(isContentReadyForTransition(item, "published")).toBe(true);
  });

  it("keeps incomplete optional guide companions out of review and publication", () => {
    const incompleteGuides = [
      guideItem({ content: { ...guideDraft.content, keyPoints: [""] } }),
      guideItem({
        content: {
          ...guideDraft.content,
          quiz: {
            questions: [
              {
                correctOptionIndex: 0,
                explanation: "",
                options: ["Correct", ""],
                prompt: "Question in progress",
              },
            ],
          },
        },
      }),
    ];

    expect(isContentReadyForTransition(guideItem(), "in_review")).toBe(true);
    expect(isContentReadyForTransition(guideItem(), "published")).toBe(true);
    for (const item of incompleteGuides) {
      expect(isContentReadyForTransition(item, "in_review")).toBe(false);
      expect(isContentReadyForTransition(item, "published")).toBe(false);
    }
  });

  it("requires complete metadata for review, approval and publication", () => {
    const incompleteMetadata = [
      guideItem({ title: "" }),
      guideItem({ summary: "" }),
      guideItem({ topic: "" }),
    ];

    for (const item of incompleteMetadata) {
      expect(isContentReadyForTransition(item, "changes_requested")).toBe(true);
      expect(isContentReadyForTransition(item, "in_review")).toBe(false);
      expect(isContentReadyForTransition(item, "approved")).toBe(false);
      expect(isContentReadyForTransition(item, "published")).toBe(false);
    }
  });

  it("keeps incomplete quizzes, flashcards and topics out of strict editorial states", () => {
    const fixtures = [
      {
        complete: ContentDraftSchema.parse({
          content: {
            questions: [
              { correctOptionIndex: 0, options: ["Correct", "Distractor"], prompt: "Question?" },
            ],
          },
          kind: "quiz",
          slug: "complete-quiz",
          summary: "Complete quiz summary.",
          title: "Complete quiz",
          topic: "Anatomy",
        }),
        incomplete: ContentDraftSchema.parse({
          content: { questions: [] },
          kind: "quiz",
          slug: "incomplete-quiz",
          summary: "Incomplete quiz summary.",
          title: "Incomplete quiz",
          topic: "Anatomy",
        }),
      },
      {
        complete: ContentDraftSchema.parse({
          content: { cards: [{ back: "Answer", front: "Question" }] },
          kind: "flashcards",
          slug: "complete-flashcards",
          summary: "Complete flashcards summary.",
          title: "Complete flashcards",
          topic: "Anatomy",
        }),
        incomplete: ContentDraftSchema.parse({
          content: { cards: [{ back: "", front: "" }] },
          kind: "flashcards",
          slug: "incomplete-flashcards",
          summary: "Incomplete flashcards summary.",
          title: "Incomplete flashcards",
          topic: "Anatomy",
        }),
      },
      {
        complete: ContentDraftSchema.parse({
          content: { introduction: "Complete topic introduction." },
          kind: "topic",
          slug: "complete-topic",
          summary: "Complete topic summary.",
          title: "Complete topic",
          topic: "Anatomy",
        }),
        incomplete: ContentDraftSchema.parse({
          content: { introduction: "", objectives: [""] },
          kind: "topic",
          slug: "incomplete-topic",
          summary: "Incomplete topic summary.",
          title: "Incomplete topic",
          topic: "Anatomy",
        }),
      },
    ];

    for (const fixture of fixtures) {
      const complete = itemFromDraft(fixture.complete);
      const incomplete = itemFromDraft(fixture.incomplete);
      for (const status of ["in_review", "approved", "published"] as const) {
        expect(isContentReadyForTransition(complete, status)).toBe(true);
        expect(isContentReadyForTransition(incomplete, status)).toBe(false);
      }
    }
  });

  it("accepts rich guide bodies even when no legacy sections are stored", () => {
    const document = RichTextDocumentSchema.parse({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Introduction" }] },
        { type: "paragraph", content: [{ type: "text", text: "Verified rich anatomy content." }] },
      ],
    });
    const standalone = guideItem({
      content: { ...guideDraft.content, document, sections: [] },
    });
    const video = videoItem({
      content: {
        ...completeVideoDraft.content,
        guide: { document, sections: [] },
      },
    });

    expect(isContentReadyForTransition(standalone, "published")).toBe(true);
    expect(isContentReadyForTransition(video, "in_review")).toBe(true);
    expect(isContentReadyForTransition(video, "published")).toBe(true);
  });

  it("does not treat a heading-only rich document as publishable guide content", () => {
    const document = RichTextDocumentSchema.parse({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Introduction" }] },
      ],
    });

    expect(isContentReadyForTransition(guideItem({
      content: { ...guideDraft.content, document, sections: [] },
    }), "published")).toBe(false);
  });

  it("accepts RFC 3339 offsets returned by Supabase for content timestamps", () => {
    const item = ContentItemSchema.safeParse({
      ...guideDraft,
      asset: null,
      authorUserId: users.contributor.id,
      createdAt: "2026-08-11T18:29:21.25481+00:00",
      id: contentId,
      publishedAt: null,
      status: "draft",
      updatedAt: "2026-08-11T18:29:21.25481+00:00",
    });

    expect(item.success).toBe(true);
  });

  it("serves the published catalog without authentication", async () => {
    const published = guideItem({ publishedAt, status: "published", updatedAt: publishedAt });
    const requests: Parameters<ContentProvider["listPublished"]>[0][] = [];
    const provider = contentProvider([], {
      listPublished: async (input) => {
        requests.push(input);
        return [published];
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      method: "GET",
      url: `/v1/content?kind=guide&limit=12&linkedVideoId=${contentId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=30, stale-while-revalidate=120");
    expect(response.json()).toEqual({ items: [published] });
    expect(requests).toEqual([{ kind: "guide", limit: 12, linkedVideoId: contentId }]);

    const invalidReference = await app.inject({
      method: "GET",
      url: "/v1/content?kind=guide&linkedVideoId=not-a-uuid",
    });
    expect(invalidReference.statusCode).toBe(400);
    await app.close();
  });

  it("returns the authenticated user's roles for navigation and route guards", async () => {
    const app = await buildApp(testEnvironment, {
      contentProvider: contentProvider(["coordinator"]),
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("coordinator-token"),
      method: "GET",
      url: "/v1/auth/me",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      roles: ["coordinator"],
      user: users.coordinator,
    });
    await app.close();
  });

  it("fails closed for anonymous users before resolving roles", async () => {
    let roleLookups = 0;
    let creations = 0;
    const provider = contentProvider([], {
      createContent: async () => {
        creations += 1;
        return { status: "conflict" };
      },
      getRoles: async () => {
        roleLookups += 1;
        return [];
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({ method: "POST", payload: guideDraft, url: "/v1/editor/content" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
    expect(roleLookups).toBe(0);
    expect(creations).toBe(0);
    await app.close();
  });

  it("does not allow a student to create content", async () => {
    let creations = 0;
    const provider = contentProvider(["student"], {
      createContent: async () => {
        creations += 1;
        return { status: "conflict" };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("student-token"),
      method: "POST",
      payload: guideDraft,
      url: "/v1/editor/content",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(creations).toBe(0);
    await app.close();
  });

  it("allows a content creator to create a draft", async () => {
    const requests: Parameters<ContentProvider["createContent"]>[0][] = [];
    const created = guideItem();
    const provider = contentProvider(["content_creator"], {
      createContent: async (input) => {
        requests.push(input);
        return { status: "success", value: created };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("contributor-token"),
      method: "POST",
      payload: guideDraft,
      url: "/v1/editor/content",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(created);
    expect(requests).toEqual([{
      actorUserId: users.contributor.id,
      draft: guideDraft,
      roles: ["content_creator"],
    }]);
    await app.close();
  });

  it.each([
    { label: "content creator", roles: ["content_creator"], token: "contributor-token" },
    { label: "coordinator", roles: ["coordinator"], token: "coordinator-token" },
  ] satisfies { label: string; roles: PlatformRole[]; token: string }[])(
    "does not allow a $label to create or modify a structural topic",
    async ({ roles, token }) => {
      let creations = 0;
      let updates = 0;
      const provider = contentProvider(roles, {
        createContent: async () => {
          creations += 1;
          return { status: "conflict" };
        },
        updateContent: async () => {
          updates += 1;
          return { status: "not_found" };
        },
      });
      const app = await buildApp(testEnvironment, {
        contentProvider: provider,
        identityProvider: identityProvider(),
      });

      const response = await app.inject({
        headers: auth(token),
        method: "POST",
        payload: taxonomyTopicDraft,
        url: "/v1/editor/content",
      });
      const updateResponse = await app.inject({
        headers: auth(token),
        method: "PATCH",
        payload: taxonomyTopicDraft,
        url: `/v1/editor/content/${contentId}`,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "forbidden" });
      expect(updateResponse.statusCode).toBe(403);
      expect(updateResponse.json()).toEqual({ error: "forbidden" });
      expect(creations).toBe(0);
      expect(updates).toBe(0);
      await app.close();
    },
  );

  it("allows an administrator to create a structural topic", async () => {
    const created = itemFromDraft(taxonomyTopicDraft);
    const requests: Parameters<ContentProvider["createContent"]>[0][] = [];
    const provider = contentProvider(["administrator"], {
      createContent: async (input) => {
        requests.push(input);
        return { status: "success", value: created };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("administrator-token"),
      method: "POST",
      payload: taxonomyTopicDraft,
      url: "/v1/editor/content",
    });

    expect(response.statusCode).toBe(201);
    expect(requests).toEqual([{
      actorUserId: users.administrator.id,
      draft: taxonomyTopicDraft,
      roles: ["administrator"],
    }]);
    await app.close();
  });

  it("allows a content creator to persist an incomplete new guide", async () => {
    const requests: Parameters<ContentProvider["createContent"]>[0][] = [];
    const created = guideItem(partialGuideDraft);
    const provider = contentProvider(["content_creator"], {
      createContent: async (input) => {
        requests.push(input);
        return { status: "success", value: created };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("contributor-token"),
      method: "POST",
      payload: partialGuideDraft,
      url: "/v1/editor/content",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(created);
    expect(requests).toEqual([
      { actorUserId: users.contributor.id, draft: partialGuideDraft, roles: ["content_creator"] },
    ]);
    await app.close();
  });

  it("lets creators select existing topics but reserves new topics for administrators", () => {
    const classifiedDraft = ContentDraftSchema.parse({
      ...guideDraft,
      subjectIds: [subjectId],
      topic: "Tórax",
      content: { ...guideDraft.content, regions: ["Tórax"] },
    });
    const newTopicDraft = ContentDraftSchema.parse({
      ...classifiedDraft,
      topic: "Abdomen",
      content: { ...classifiedDraft.content, regions: ["Abdomen"] },
    });
    const expandedSubjectDraft = ContentDraftSchema.parse({
      ...classifiedDraft,
      subjectIds: [subjectId, secondSubjectId],
    });
    const topics = [{ name: "Tórax", subjectIds: [subjectId] }];

    expect(areContentTopicsAllowed({
      draft: classifiedDraft,
      roles: ["content_creator"],
      topics,
    })).toBe(true);
    expect(areContentTopicsAllowed({
      draft: newTopicDraft,
      roles: ["content_creator"],
      topics,
    })).toBe(false);
    expect(areContentTopicsAllowed({
      draft: newTopicDraft,
      roles: ["coordinator"],
      topics,
    })).toBe(false);
    expect(areContentTopicsAllowed({
      draft: expandedSubjectDraft,
      roles: ["content_creator"],
      topics,
    })).toBe(false);
    expect(areContentTopicsAllowed({
      draft: expandedSubjectDraft,
      roles: ["content_creator"],
      topics: [{ name: "Tórax", subjectIds: [subjectId, secondSubjectId] }],
    })).toBe(true);
    expect(areContentTopicsAllowed({
      draft: newTopicDraft,
      roles: ["administrator"],
      topics,
    })).toBe(true);
    expect(areContentTopicsAllowed({
      draft: taxonomyTopicDraft,
      roles: ["content_creator"],
      topics,
    })).toBe(false);
    expect(areContentTopicsAllowed({
      draft: taxonomyTopicDraft,
      roles: ["administrator"],
      topics,
    })).toBe(true);
  });

  it("keeps published content locked and reserves archived edits for publishers", () => {
    expect(
      canEditContent({
        actorUserId: users.coordinator.id,
        authorUserId: users.contributor.id,
        roles: ["coordinator"],
        status: "published",
      }),
    ).toBe(false);

    expect(
      canEditContent({
        actorUserId: users.contributor.id,
        authorUserId: users.contributor.id,
        roles: ["content_creator"],
        status: "archived",
      }),
    ).toBe(false);

    expect(
      canEditContent({
        actorUserId: users.coordinator.id,
        authorUserId: users.contributor.id,
        roles: ["coordinator"],
        status: "archived",
      }),
    ).toBe(true);

    expect(
      canEditContent({
        actorUserId: users.editor.id,
        authorUserId: users.contributor.id,
        roles: ["coordinator"],
        status: "in_review",
      }),
    ).toBe(true);

    expect(
      canEditContent({
        actorUserId: users.contributor.id,
        authorUserId: users.contributor.id,
        roles: ["content_creator"],
        status: "published",
      }),
    ).toBe(false);
  });

  it("limits published updates to title, organization and guide video links", () => {
    const published = guideItem({ status: "published" });
    const organizationUpdate = ContentDraftSchema.parse({
      ...published,
      subjectIds: [subjectId],
      topic: "Cuello",
      content: {
        ...published.content,
        linkedVideoId,
        regions: ["Cuello", "Cabeza"],
      },
    });
    const titleUpdate = ContentDraftSchema.parse({
      ...published,
      title: "Título modificado después de publicar",
    });
    const combinedUpdate = ContentDraftSchema.parse({
      ...organizationUpdate,
      title: "Título y organización modificados después de publicar",
    });
    const contentUpdate = ContentDraftSchema.parse({
      ...titleUpdate,
      summary: "Resumen modificado después de publicar",
    });

    expect(isPublishedPermittedUpdate(published, organizationUpdate)).toBe(true);
    expect(isPublishedPermittedUpdate(published, titleUpdate)).toBe(true);
    expect(isPublishedPermittedUpdate(published, combinedUpdate)).toBe(true);
    expect(isPublishedPermittedUpdate(published, contentUpdate)).toBe(false);
  });

  it("allows a coordinator to restore archived content without granting that power to creators", () => {
    expect(
      isContentTransitionAllowed({
        actorUserId: users.coordinator.id,
        authorUserId: users.contributor.id,
        currentStatus: "archived",
        roles: ["coordinator"],
        targetStatus: "published",
      }),
    ).toBe(true);
    expect(
      isContentTransitionAllowed({
        actorUserId: users.contributor.id,
        authorUserId: users.contributor.id,
        currentStatus: "archived",
        roles: ["content_creator"],
        targetStatus: "published",
      }),
    ).toBe(false);
  });

  it("allows only an administrator to delete a guide independently of its status", async () => {
    const requests: Parameters<ContentProvider["deleteContent"]>[0][] = [];
    const provider = contentProvider(["administrator"], {
      deleteContent: async (input) => {
        requests.push(input);
        return { status: "success", value: { id: input.contentId } };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("administrator-token"),
      method: "DELETE",
      url: `/v1/editor/content/${contentId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: contentId });
    expect(requests).toEqual([
      { actorUserId: users.administrator.id, contentId, roles: ["administrator"] },
    ]);
    await app.close();
  });

  it("rejects guide deletion for a coordinator", async () => {
    let deletions = 0;
    const provider = contentProvider(["coordinator"], {
      deleteContent: async () => {
        deletions += 1;
        return { status: "success", value: { id: contentId } };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("coordinator-token"),
      method: "DELETE",
      url: `/v1/editor/content/${contentId}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(deletions).toBe(0);
    await app.close();
  });

  it("allows coordinators to review and publish", async () => {
    const transitions: Parameters<ContentProvider["transitionContent"]>[0][] = [];
    const rolesByUser = new Map<string, PlatformRole[]>([
      [users.editor.id, ["coordinator"]],
      [users.coordinator.id, ["coordinator"]],
    ]);
    const provider = contentProvider([], {
      getRoles: async (userId) => rolesByUser.get(userId) ?? [],
      transitionContent: async (input) => {
        transitions.push(input);
        return {
          status: "success",
          value: guideItem({
            publishedAt: input.status === "published" ? publishedAt : null,
            status: input.status,
            updatedAt: publishedAt,
          }),
        };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const approved = await app.inject({
      headers: auth("editor-token"),
      method: "POST",
      payload: { status: "approved" },
      url: `/v1/editor/content/${contentId}/transition`,
    });
    const published = await app.inject({
      headers: auth("coordinator-token"),
      method: "POST",
      payload: { status: "published" },
      url: `/v1/editor/content/${contentId}/transition`,
    });

    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe("approved");
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ publishedAt, status: "published" });
    expect(transitions).toEqual([
      { actorUserId: users.editor.id, contentId, roles: ["coordinator"], status: "approved" },
      { actorUserId: users.coordinator.id, contentId, roles: ["coordinator"], status: "published" },
    ]);
    await app.close();
  });

  it("rejects mismatched asset metadata before provisioning an upload", async () => {
    let uploads = 0;
    const provider = contentProvider(["content_creator"], {
      createAssetUpload: async () => {
        uploads += 1;
        return { status: "not_found" };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("contributor-token"),
      method: "POST",
      payload: {
        fileName: "guide.pdf",
        fileSizeBytes: 2048,
        kind: "video",
        mimeType: "application/pdf",
      },
      url: `/v1/editor/content/${contentId}/assets`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_content_asset" });
    expect(uploads).toBe(0);
    await app.close();
  });

  it("provisions a valid direct upload and finalizes its asset", async () => {
    const file: ContentAssetUploadRequest = {
      fileName: "guide.pdf",
      fileSizeBytes: 2048,
      kind: "document",
      mimeType: "application/pdf",
    };
    const pending: ContentAsset = {
      contentId,
      downloadUrl: null,
      fileName: file.fileName,
      id: assetId,
      kind: file.kind,
      mimeType: file.mimeType,
      sizeBytes: file.fileSizeBytes,
      status: "pending",
    };
    const upload: ContentAssetUploadResponse = {
      asset: pending,
      constraints: { maxFileSizeBytes: 50_000_000 },
      upload: {
        path: `content/${contentId}/${assetId}.pdf`,
        token: "signed-token",
        url: "https://storage.example.test/upload/signed-token",
      },
    };
    const provider = contentProvider(["content_creator"], {
      createAssetUpload: async () => ({ status: "success", value: upload }),
      finalizeAsset: async () => ({
        status: "success",
        value: { ...pending, downloadUrl: "https://storage.example.test/guide.pdf", status: "ready" },
      }),
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const provisioned = await app.inject({
      headers: auth("contributor-token"),
      method: "POST",
      payload: file,
      url: `/v1/editor/content/${contentId}/assets`,
    });
    const finalized = await app.inject({
      headers: auth("contributor-token"),
      method: "POST",
      url: `/v1/editor/assets/${assetId}/finalize`,
    });

    expect(provisioned.statusCode).toBe(201);
    expect(provisioned.json()).toEqual(upload);
    expect(finalized.statusCode).toBe(200);
    expect(finalized.json()).toMatchObject({ id: assetId, status: "ready" });
    await app.close();
  });

  it("removes an attached asset through the authenticated editor API", async () => {
    const removals: Parameters<ContentProvider["deleteAsset"]>[0][] = [];
    const updated = videoItem({ asset: null });
    const provider = contentProvider(["content_creator"], {
      deleteAsset: async (input) => {
        removals.push(input);
        return { status: "success", value: updated };
      },
    });
    const app = await buildApp(testEnvironment, {
      contentProvider: provider,
      identityProvider: identityProvider(),
    });

    const response = await app.inject({
      headers: auth("contributor-token"),
      method: "DELETE",
      url: `/v1/editor/assets/${assetId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ asset: null, id: contentId });
    expect(removals).toEqual([
      { actorUserId: users.contributor.id, assetId, roles: ["content_creator"] },
    ]);
    await app.close();
  });

  it("allows an administrator to create a subject", async () => {
    const creations: Parameters<SubjectProvider["createSubject"]>[0][] = [];
    const subject = { contentCount: 0, id: subjectId, name: "Anatomía", slug: "anatomia" };
    const app = await buildApp(testEnvironment, {
      contentProvider: contentProvider(["administrator"]),
      identityProvider: identityProvider(),
      subjectProvider: subjectProvider({
        createSubject: async (input) => {
          creations.push(input);
          return { status: "success", value: subject };
        },
      }),
    });

    const response = await app.inject({
      headers: auth("administrator-token"),
      method: "POST",
      payload: { name: "Anatomía" },
      url: "/v1/editor/subjects",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ subject });
    expect(creations).toEqual([{ actorUserId: users.administrator.id, name: "Anatomía" }]);
    await app.close();
  });

  it("allows an administrator to delete a subject", async () => {
    const deletions: Parameters<SubjectProvider["deleteSubject"]>[0][] = [];
    const app = await buildApp(testEnvironment, {
      contentProvider: contentProvider(["administrator"]),
      identityProvider: identityProvider(),
      subjectProvider: subjectProvider({
        deleteSubject: async (input) => {
          deletions.push(input);
          return { status: "success", value: { id: input.subjectId } };
        },
      }),
    });

    const response = await app.inject({
      headers: auth("administrator-token"),
      method: "DELETE",
      url: `/v1/editor/subjects/${subjectId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: subjectId });
    expect(deletions).toEqual([{ actorUserId: users.administrator.id, subjectId }]);
    await app.close();
  });

  it.each([
    ["content creators", "content_creator", "contributor-token"],
    ["coordinators", "coordinator", "coordinator-token"],
  ] as const)("prevents %s from deleting shared subjects", async (_label, role, token) => {
    let deletions = 0;
    const app = await buildApp(testEnvironment, {
      contentProvider: contentProvider([role]),
      identityProvider: identityProvider(),
      subjectProvider: subjectProvider({
        deleteSubject: async () => {
          deletions += 1;
          return { status: "success", value: { id: subjectId } };
        },
      }),
    });

    const response = await app.inject({
      headers: auth(token),
      method: "DELETE",
      url: `/v1/editor/subjects/${subjectId}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(deletions).toBe(0);
    await app.close();
  });

  it.each([
    ["content creators", "content_creator", "contributor-token"],
    ["coordinators", "coordinator", "coordinator-token"],
  ] as const)("prevents %s from creating subjects", async (_label, role, token) => {
    let creations = 0;
    const app = await buildApp(testEnvironment, {
      contentProvider: contentProvider([role]),
      identityProvider: identityProvider(),
      subjectProvider: subjectProvider({
        createSubject: async () => {
          creations += 1;
          return { status: "conflict" };
        },
      }),
    });

    const response = await app.inject({
      headers: auth(token),
      method: "POST",
      payload: { name: "Anatomía" },
      url: "/v1/editor/subjects",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(creations).toBe(0);
    await app.close();
  });
});
