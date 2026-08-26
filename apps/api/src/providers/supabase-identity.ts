import { createClient } from "@supabase/supabase-js";
import type { IdentityProvider, ProviderUser } from "@cediah/contracts";

type SupabaseIdentityConfiguration = {
  secretKey: string;
  url: string;
};

export function createSupabaseIdentityProvider(
  configuration: SupabaseIdentityConfiguration,
): IdentityProvider {
  const client = createClient(configuration.url, configuration.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return {
    async getUser(accessToken: string): Promise<ProviderUser | null> {
      const { data, error } = await client.auth.getUser(accessToken);
      if (
        error ||
        !data.user?.email ||
        !data.user.email_confirmed_at ||
        data.user.is_anonymous
      ) {
        return null;
      }

      return { email: data.user.email, id: data.user.id };
    },
    async revokeSessions(userId: string): Promise<void> {
      const { error } = await client.auth.admin.signOut(userId, "global");
      if (error) throw error;
    },
  };
}
