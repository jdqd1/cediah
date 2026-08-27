import { describe, expect, it } from "vitest";
import type { IdentityProvider, VideoProvider } from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import type { ApiEnvironment } from "../src/config.js";

const testUser = {
  email: "pruebas@example.test",
  id: "04761a7d-4c02-48d7-b3a2-94b8baadf021",
};
const otherUser = {
  email: "otra-cuenta@example.test",
  id: "20402bbc-63e1-437f-ad0d-71d4c73a9d8f",
};

const testEnvironment: ApiEnvironment = {
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGINS: "http://localhost:3000",
  testVideoUpload: {
    maxDurationSeconds: 900,
    maxFileSizeBytes: 190_000_000,
    uploaderIds: new Set([testUser.id]),
  },
  webOrigins: new Set(["http://localhost:3000"]),
};

function createIdentityProvider(): IdentityProvider {
  return {
    getUser: async (request) => {
      if (request.authorization === "Bearer test-user-token") return testUser;
      if (request.authorization === "Bearer other-user-token") return otherUser;
      return null;
    },
    revokeSessions: async () => undefined,
  };
}

describe("test-video API", () => {
  it("issues a private, short-lived direct-upload URL only to the configured test account", async () => {
    let directUploadInput: Parameters<VideoProvider["createDirectUpload"]>[0] | undefined;
    const videoProvider: VideoProvider = {
      createDirectUpload: async (input) => {
        directUploadInput = input;
        return {
          expiresAt: input.expiresAt,
          externalVideoId: "test-video-1",
          uploadUrl: "https://upload.videodelivery.net/test-video-1",
        };
      },
      createPlaybackSession: async () => ({
        expiresAt: "2026-08-10T20:10:00.000Z",
        iframeUrl: "https://customer-demo.cloudflarestream.com/token/iframe",
      }),
      getVideoAsset: async () => null,
    };
    const app = await buildApp(testEnvironment, {
      identityProvider: createIdentityProvider(),
      videoProvider,
    });

    const response = await app.inject({
      headers: {
        authorization: "Bearer test-user-token",
        "content-type": "application/json",
      },
      method: "POST",
      payload: {
        durationSeconds: 420,
        fileName: "prueba-reproductor.mp4",
        fileSizeBytes: 42_000_000,
        mimeType: "video/mp4",
      },
      url: "/v1/videos/test-uploads",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      constraints: {
        maxDurationSeconds: 900,
        maxFileSizeBytes: 190_000_000,
      },
      upload: {
        externalVideoId: "test-video-1",
        uploadUrl: "https://upload.videodelivery.net/test-video-1",
      },
    });
    expect(directUploadInput).toMatchObject({
      creatorId: testUser.id,
      durationSeconds: 420,
      fileSizeBytes: 42_000_000,
      maxDurationSeconds: 900,
      mimeType: "video/mp4",
    });
    expect(Date.parse(directUploadInput?.expiresAt ?? "")).toBeGreaterThan(Date.now());

    await app.close();
  });

  it("fails closed for unauthenticated, non-allowlisted and oversized upload requests", async () => {
    const videoProvider: VideoProvider = {
      createDirectUpload: async () => {
        throw new Error("The provider must not be called");
      },
      createPlaybackSession: async () => {
        throw new Error("The provider must not be called");
      },
      getVideoAsset: async () => null,
    };
    const app = await buildApp(testEnvironment, {
      identityProvider: createIdentityProvider(),
      videoProvider,
    });

    const anonymous = await app.inject({
      method: "POST",
      payload: {},
      url: "/v1/videos/test-uploads",
    });
    const forbidden = await app.inject({
      headers: {
        authorization: "Bearer other-user-token",
        "content-type": "application/json",
      },
      method: "POST",
      payload: {
        durationSeconds: 60,
        fileName: "prueba.mp4",
        fileSizeBytes: 1,
        mimeType: "video/mp4",
      },
      url: "/v1/videos/test-uploads",
    });
    const oversized = await app.inject({
      headers: {
        authorization: "Bearer test-user-token",
        "content-type": "application/json",
      },
      method: "POST",
      payload: {
        durationSeconds: 60,
        fileName: "prueba.mp4",
        fileSizeBytes: 190_000_001,
        mimeType: "video/mp4",
      },
      url: "/v1/videos/test-uploads",
    });

    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toEqual({ error: "unauthorized" });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "forbidden" });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: "video_test_file_too_large" });

    await app.close();
  });

  it("rejects a declared video duration above the configured test limit", async () => {
    const videoProvider: VideoProvider = {
      createDirectUpload: async () => {
        throw new Error("The provider must not be called");
      },
      createPlaybackSession: async () => {
        throw new Error("The provider must not be called");
      },
      getVideoAsset: async () => null,
    };
    const app = await buildApp(testEnvironment, {
      identityProvider: createIdentityProvider(),
      videoProvider,
    });

    const response = await app.inject({
      headers: {
        authorization: "Bearer test-user-token",
        "content-type": "application/json",
      },
      method: "POST",
      payload: {
        durationSeconds: 901,
        fileName: "prueba.mp4",
        fileSizeBytes: 42_000_000,
        mimeType: "video/mp4",
      },
      url: "/v1/videos/test-uploads",
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: "video_test_duration_too_long" });
    await app.close();
  });

  it("only creates a playback session for a ready video owned by the requesting test account", async () => {
    let playbackRequests = 0;
    const videoProvider: VideoProvider = {
      createDirectUpload: async () => {
        throw new Error("The provider must not be called");
      },
      createPlaybackSession: async (videoId) => {
        playbackRequests += 1;
        return {
          expiresAt: "2026-08-10T20:10:00.000Z",
          iframeUrl: "https://customer-demo.cloudflarestream.com/" + videoId + "/iframe",
        };
      },
      getVideoAsset: async (videoId) => {
        if (videoId === "test-video-1") {
          return { creatorId: testUser.id, status: "ready" };
        }
        return { creatorId: otherUser.id, status: "ready" };
      },
    };
    const app = await buildApp(testEnvironment, {
      identityProvider: createIdentityProvider(),
      videoProvider,
    });

    const allowed = await app.inject({
      headers: { authorization: "Bearer test-user-token" },
      method: "GET",
      url: "/v1/videos/test-assets/test-video-1",
    });
    const foreign = await app.inject({
      headers: { authorization: "Bearer test-user-token" },
      method: "GET",
      url: "/v1/videos/test-assets/other-video",
    });

    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({
      expiresAt: "2026-08-10T20:10:00.000Z",
      iframeUrl: "https://customer-demo.cloudflarestream.com/test-video-1/iframe",
      status: "ready",
      videoId: "test-video-1",
    });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toEqual({ error: "not_found" });
    expect(playbackRequests).toBe(1);

    await app.close();
  });
});
