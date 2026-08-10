import { describe, expect, it } from "vitest";
import type { IdentityProvider, LearningProvider } from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import type { ApiEnvironment } from "../src/config.js";

const student = {
  email: "estudiante@example.test",
  id: "04761a7d-4c02-48d7-b3a2-94b8baadf021",
};
const anotherStudent = {
  email: "otra-cuenta@example.test",
  id: "20402bbc-63e1-437f-ad0d-71d4c73a9d8f",
};
const lessonId = "4b5b57d0-a492-4316-b81b-90613f1b5149";

const testEnvironment: ApiEnvironment = {
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

function createIdentityProvider(): IdentityProvider {
  return {
    getUser: async (accessToken) => {
      if (accessToken === "student-token") return student;
      if (accessToken === "another-student-token") return anotherStudent;
      return null;
    },
    revokeSessions: async () => undefined,
  };
}

describe("learning API", () => {
  it("returns only the authenticated student's active learning summary", async () => {
    const requestedUserIds: string[] = [];
    const learningProvider: LearningProvider = {
      getStudentDashboard: async (userId) => {
        requestedUserIds.push(userId);
        return {
          courses: [
            {
              accessEndsAt: null,
              id: "ec82a6a2-04f2-43e6-9293-bdb4e6d15d18",
              progress: { completedLessons: 1, totalLessons: 4, watchedSeconds: 615 },
              slug: "torax",
              title: "Tórax",
            },
          ],
        };
      },
      updateLessonProgress: async () => null,
    };
    const app = await buildApp(testEnvironment, {
      identityProvider: createIdentityProvider(),
      learningProvider,
    });

    const response = await app.inject({
      headers: { authorization: "Bearer student-token" },
      method: "GET",
      url: "/v1/learning/dashboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      courses: [
        {
          accessEndsAt: null,
          id: "ec82a6a2-04f2-43e6-9293-bdb4e6d15d18",
          progress: { completedLessons: 1, totalLessons: 4, watchedSeconds: 615 },
          slug: "torax",
          title: "Tórax",
        },
      ],
    });
    expect(requestedUserIds).toEqual([student.id]);

    await app.close();
  });

  it("fails closed before consulting the learning provider when the request has no valid identity", async () => {
    let dashboardRequests = 0;
    const learningProvider: LearningProvider = {
      getStudentDashboard: async () => {
        dashboardRequests += 1;
        return { courses: [] };
      },
      updateLessonProgress: async () => null,
    };
    const app = await buildApp(testEnvironment, {
      identityProvider: createIdentityProvider(),
      learningProvider,
    });

    const response = await app.inject({ method: "GET", url: "/v1/learning/dashboard" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
    expect(dashboardRequests).toBe(0);

    await app.close();
  });

  it("records progress only for a lesson the provider authorizes for the current student", async () => {
    const progressRequests: Parameters<LearningProvider["updateLessonProgress"]>[0][] = [];
    const learningProvider: LearningProvider = {
      getStudentDashboard: async () => ({ courses: [] }),
      updateLessonProgress: async (input) => {
        progressRequests.push(input);
        if (input.userId !== student.id || input.lessonId !== lessonId) return null;

        return {
          completedAt: null,
          lessonId: input.lessonId,
          status: "in_progress",
          watchedSeconds: input.watchedSeconds,
        };
      },
    };
    const app = await buildApp(testEnvironment, {
      identityProvider: createIdentityProvider(),
      learningProvider,
    });

    const allowed = await app.inject({
      headers: {
        authorization: "Bearer student-token",
        "content-type": "application/json",
      },
      method: "PATCH",
      payload: { watchedSeconds: 615 },
      url: `/v1/learning/lessons/${lessonId}/progress`,
    });
    const foreign = await app.inject({
      headers: {
        authorization: "Bearer another-student-token",
        "content-type": "application/json",
      },
      method: "PATCH",
      payload: { watchedSeconds: 615 },
      url: `/v1/learning/lessons/${lessonId}/progress`,
    });
    const malformed = await app.inject({
      headers: {
        authorization: "Bearer student-token",
        "content-type": "application/json",
      },
      method: "PATCH",
      payload: { watchedSeconds: -1 },
      url: `/v1/learning/lessons/${lessonId}/progress`,
    });
    const malformedLessonId = await app.inject({
      headers: {
        authorization: "Bearer student-token",
        "content-type": "application/json",
      },
      method: "PATCH",
      payload: { watchedSeconds: 615 },
      url: "/v1/learning/lessons/not-a-uuid/progress",
    });

    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers["cache-control"]).toBe("no-store");
    expect(allowed.json()).toEqual({
      completedAt: null,
      lessonId,
      status: "in_progress",
      watchedSeconds: 615,
    });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toEqual({ error: "not_found" });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ error: "invalid_lesson_progress" });
    expect(malformedLessonId.statusCode).toBe(404);
    expect(malformedLessonId.json()).toEqual({ error: "not_found" });
    expect(progressRequests).toEqual([
      { lessonId, userId: student.id, watchedSeconds: 615 },
      { lessonId, userId: anotherStudent.id, watchedSeconds: 615 },
    ]);

    await app.close();
  });
});
