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
  IdentityProvider,
  PlatformRole,
  ProviderUser,
  SubjectProvider,
} from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import { canEditContent } from "../src/content-authorization.js";
import type { ApiEnvironment } from "../src/config.js";
import {
  isContentReadyForTransition,
  isContentTransitionAllowed,
} from "../src/providers/supabase-content.js";

const contentId = "7a8a6513-9384-4b5d-a825-439f42355714";
const subjectId = "19d4f11b-9ff1-45c2-b2b5-50686038fe42";
const assetId = "86bc79c0-c73b-4aa6-9257-f22f0d89b080";
const createdAt = "2026-08-10T12:00:00.000Z";
const publishedAt = "2026-08-10T13:00:00.000Z";

const users = {
  contributor: { email: "contributor@example.test", id: "20402bbc-63e1-437f-ad0d-71d4c73a9d8f" },
  coordinator: { email: "coordination@example.test", id: "df747a77-f05c-4bec-a2d9-29dd0de7ec33" },
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
    ["contributor-token", users.contributor],
    ["coordination-token", users.coordinator],
    ["editor-token", users.editor],
    ["student-token", users.student],
  ]);

  return {
    getUser: async (token) => byToken.get(token) ?? null,
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

  it("allows a community contributor to create a draft", async () => {
    const requests: Parameters<ContentProvider["createContent"]>[0][] = [];
    const created = guideItem();
    const provider = contentProvider(["community_contributor"], {
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
    expect(requests).toEqual([{ actorUserId: users.contributor.id, draft: guideDraft }]);
    await app.close();
  });

  it("allows a community contributor to persist an incomplete new guide", async () => {
    const requests: Parameters<ContentProvider["createContent"]>[0][] = [];
    const created = guideItem(partialGuideDraft);
    const provider = contentProvider(["community_contributor"], {
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
      { actorUserId: users.contributor.id, draft: partialGuideDraft },
    ]);
    await app.close();
  });

  it("locks published and archived content for every editorial role", () => {
    for (const status of ["published", "archived"] as const) {
      expect(
        canEditContent({
          actorUserId: users.editor.id,
          authorUserId: users.contributor.id,
          roles: ["academic_editor"],
          status,
        }),
      ).toBe(false);
    }

    expect(
      canEditContent({
        actorUserId: users.editor.id,
        authorUserId: users.contributor.id,
        roles: ["academic_editor"],
        status: "in_review",
      }),
    ).toBe(true);

    expect(
      canEditContent({
        actorUserId: users.contributor.id,
        authorUserId: users.contributor.id,
        roles: ["community_contributor"],
        status: "published",
      }),
    ).toBe(false);
  });

  it("allows coordination to restore archived content without broadening editorial permissions", () => {
    expect(
      isContentTransitionAllowed({
        actorUserId: users.coordinator.id,
        authorUserId: users.contributor.id,
        currentStatus: "archived",
        roles: ["coordination"],
        targetStatus: "published",
      }),
    ).toBe(true);
    expect(
      isContentTransitionAllowed({
        actorUserId: users.editor.id,
        authorUserId: users.contributor.id,
        currentStatus: "archived",
        roles: ["academic_editor"],
        targetStatus: "published",
      }),
    ).toBe(false);
  });

  it("allows coordination to delete a guide independently of its status", async () => {
    const requests: Parameters<ContentProvider["deleteContent"]>[0][] = [];
    const provider = contentProvider(["coordination"], {
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
      headers: auth("coordination-token"),
      method: "DELETE",
      url: `/v1/editor/content/${contentId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: contentId });
    expect(requests).toEqual([
      { actorUserId: users.coordinator.id, contentId, roles: ["coordination"] },
    ]);
    await app.close();
  });

  it("rejects guide deletion without publication permission", async () => {
    let deletions = 0;
    const provider = contentProvider(["academic_editor"], {
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
      headers: auth("editor-token"),
      method: "DELETE",
      url: `/v1/editor/content/${contentId}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(deletions).toBe(0);
    await app.close();
  });

  it("allows academic review and coordination publication", async () => {
    const transitions: Parameters<ContentProvider["transitionContent"]>[0][] = [];
    const rolesByUser = new Map<string, PlatformRole[]>([
      [users.editor.id, ["academic_editor"]],
      [users.coordinator.id, ["coordination"]],
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
      headers: auth("coordination-token"),
      method: "POST",
      payload: { status: "published" },
      url: `/v1/editor/content/${contentId}/transition`,
    });

    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe("approved");
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ publishedAt, status: "published" });
    expect(transitions).toEqual([
      { actorUserId: users.editor.id, contentId, roles: ["academic_editor"], status: "approved" },
      { actorUserId: users.coordinator.id, contentId, roles: ["coordination"], status: "published" },
    ]);
    await app.close();
  });

  it("rejects mismatched asset metadata before provisioning an upload", async () => {
    let uploads = 0;
    const provider = contentProvider(["community_contributor"], {
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
    const provider = contentProvider(["community_contributor"], {
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

  it("allows an academic editor to delete a subject", async () => {
    const deletions: Parameters<SubjectProvider["deleteSubject"]>[0][] = [];
    const app = await buildApp(testEnvironment, {
      contentProvider: contentProvider(["academic_editor"]),
      identityProvider: identityProvider(),
      subjectProvider: subjectProvider({
        deleteSubject: async (input) => {
          deletions.push(input);
          return { status: "success", value: { id: input.subjectId } };
        },
      }),
    });

    const response = await app.inject({
      headers: auth("editor-token"),
      method: "DELETE",
      url: `/v1/editor/subjects/${subjectId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: subjectId });
    expect(deletions).toEqual([{ actorUserId: users.editor.id, subjectId }]);
    await app.close();
  });

  it("prevents contributors from deleting shared subjects", async () => {
    let deletions = 0;
    const app = await buildApp(testEnvironment, {
      contentProvider: contentProvider(["community_contributor"]),
      identityProvider: identityProvider(),
      subjectProvider: subjectProvider({
        deleteSubject: async () => {
          deletions += 1;
          return { status: "success", value: { id: subjectId } };
        },
      }),
    });

    const response = await app.inject({
      headers: auth("contributor-token"),
      method: "DELETE",
      url: `/v1/editor/subjects/${subjectId}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(deletions).toBe(0);
    await app.close();
  });
});
