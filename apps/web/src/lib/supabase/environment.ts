type PublicSupabaseConfiguration = {
  publishableKey: string;
  url: string;
};

const exampleValues = ["your-project.supabase.co", "replace_me"];

export function getPublicSupabaseConfiguration(): PublicSupabaseConfiguration | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey || exampleValues.some((value) => url.includes(value) || publishableKey.includes(value))) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const isLocalUrl = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
    if (parsedUrl.protocol !== "https:" && !(isLocalUrl && parsedUrl.protocol === "http:")) {
      return null;
    }
  } catch {
    return null;
  }

  return { publishableKey, url };
}
