"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfiguration } from "./environment";

let client: SupabaseClient | null | undefined;

export function getBrowserSupabaseClient() {
  if (client !== undefined) return client;

  const configuration = getPublicSupabaseConfiguration();
  client = configuration
    ? createBrowserClient(configuration.url, configuration.publishableKey)
    : null;

  return client;
}
