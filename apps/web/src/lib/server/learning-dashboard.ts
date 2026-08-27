import "server-only";
import {
  StudentLearningDashboardResponseSchema,
  type StudentLearningDashboardResponse,
} from "@cediah/contracts";
import { getServerEnvironment } from "./env";
import { getApiRequestCookie } from "./api-session";

export type LearningDashboardResult =
  | { dashboard: StudentLearningDashboardResponse; status: "ready" }
  | { status: "unavailable" };

export async function getLearningDashboard(): Promise<LearningDashboardResult> {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return { status: "unavailable" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const environment = getServerEnvironment();
    const response = await fetch(new URL("/v1/learning/dashboard", environment.API_BASE_URL), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Cookie: session.cookie,
      },
      signal: controller.signal,
    });
    if (!response.ok) return { status: "unavailable" };

    return {
      dashboard: StudentLearningDashboardResponseSchema.parse(await response.json()),
      status: "ready",
    };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
