import "server-only";
import { headers } from "next/headers";

export type ApiRequestCookieResult =
  | { cookie: string; status: "ready" }
  | { status: "anonymous" };

export async function getApiRequestCookie(): Promise<ApiRequestCookieResult> {
  const cookie = (await headers()).get("cookie")?.trim();
  return cookie ? { cookie, status: "ready" } : { status: "anonymous" };
}
