import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../logger/logger";

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Checks whether Supabase environment variables are configured on the server.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && serviceRoleKey);
}

/**
 * Returns a server-only Supabase admin client initialized with the service role key.
 *
 * Security:
 * - This function is strictly server-side.
 * - The service role key bypasses Row Level Security (RLS) and must NEVER be exposed to the browser.
 * - Returns `null` if required environment variables are missing, enabling safe fallback in development.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  try {
    cachedAdminClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedAdminClient;
  } catch (error) {
    logger.error("Failed to initialize Supabase admin client", error);
    return null;
  }
}
