import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseRuntimeConfig } from "./runtime-config";

const runtimeConfig = resolveSupabaseRuntimeConfig(import.meta.env as Record<string, string | undefined>);

let supabaseClient: SupabaseClient | null | undefined;

export function getSupabaseRuntimeConfig() {
  return runtimeConfig;
}

export function getExtensionSupabaseClient() {
  if (!runtimeConfig.configured) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(runtimeConfig.url, runtimeConfig.anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storageKey: "prompt-dock-extension-auth",
      },
    });
  }

  return supabaseClient;
}
