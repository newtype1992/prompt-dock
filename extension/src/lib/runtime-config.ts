export type SupabaseRuntimeConfig = {
  anonKey: string;
  configured: boolean;
  missing: string[];
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
