import { describe, expect, it } from "vitest";
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
} from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import type { ApiEnvironment } from "../src/config.js";

const contentId = "7a8a6513-9384-4b5d-a825-439f42355714";
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
  content: { sections: [{ body: "Verified anatomy content.", heading: "Introduction" }] },
  estimatedMinutes: 15,
  featured: false,
  kind: "guide",
  slug: "thorax-guide",
  summary: "A concise guide used by the content API tests.",
  title: "Thorax guide",
  topic: "Thorax",
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

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe("content API", () => {
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

    const response = await app.inject({ method: "GET", url: "/v1/content?kind=guide&limit=12" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=30, stale-while-revalidate=120");
    expect(response.json()).toEqual({ items: [published] });
    expect(requests).toEqual([{ kind: "guide", limit: 12 }]);
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
});