export type SupabaseRuntimeConfig = {
  anonKey: string;
  configured: boolean;
  missing: string[];
  url: string;
};

export type SupportAppRuntimeConfig = {
  url: string;
};

export function resolveSupabaseRuntimeConfig(
  env: Record<string, string | undefined>
): SupabaseRuntimeConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const missing: string[] = [];

  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    anonKey,
    configured: missing.length === 0,
    missing,
    url,
  };
}

export function resolveSupportAppRuntimeConfig(
  env: Record<string, string | undefined>
): SupportAppRuntimeConfig {
  const configuredUrl = env.NEXT_PUBLIC_APP_URL?.trim() ?? env.APP_URL?.trim() ?? "http://localhost:3000";

  return {
    url: configuredUrl.replace(/\/$/, ""),
  };
}
