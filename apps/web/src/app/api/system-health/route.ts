import { NextResponse } from "next/server";
import { HealthResponseSchema } from "@cediah/contracts";
import { getServerEnvironment } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const environment = getServerEnvironment();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(new URL("/health", environment.API_BASE_URL), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Health endpoint returned a non-success status");

    const health = HealthResponseSchema.parse(await response.json());
    return NextResponse.json(health, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { status: "unavailable", service: "cediah-api" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
