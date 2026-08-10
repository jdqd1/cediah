import "server-only";
import { getServerEnvironment } from "./env";

type VideoTestApiRequest = {
  accessToken: string;
  body?: unknown;
  method: "GET" | "POST";
  path: string;
};

type VideoTestApiResult = {
  body: unknown;
  status: number;
};

const requestTimeoutMilliseconds = 8_000;
const knownErrorCodes = new Set([
  "forbidden",
  "identity_unavailable",
  "invalid_video_test_upload",
  "not_found",
  "unauthorized",
  "video_test_file_too_large",
  "video_test_unavailable",
]);

export async function requestVideoTestApi(
  input: VideoTestApiRequest,
): Promise<VideoTestApiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMilliseconds);

  try {
    const environment = getServerEnvironment();
    const response = await fetch(new URL(input.path, environment.API_BASE_URL), {
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + input.accessToken,
        ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      method: input.method,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({ error: "video_test_unavailable" }));
    return { body, status: response.status };
  } catch {
    return { body: { error: "video_test_unavailable" }, status: 503 };
  } finally {
    clearTimeout(timeout);
  }
}

export function getVideoTestApiError(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string" &&
    knownErrorCodes.has(body.error)
  ) {
    return body.error;
  }

  return "video_test_unavailable";
}

export function safeVideoTestStatus(status: number) {
  return [400, 401, 403, 404, 413, 503].includes(status) ? status : 503;
}
