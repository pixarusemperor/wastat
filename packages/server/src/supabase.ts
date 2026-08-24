import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseKey: string;
  databaseUrl?: string;
}

/**
 * Initializes Supabase Client with service role capabilities for auth, storage, and realtime.
 */
export function initSupabase(config: SupabaseConfig): {
  supabase: SupabaseClient;
  sql?: postgres.Sql;
} {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const sql = config.databaseUrl ? postgres(config.databaseUrl, { max: 10, idle_timeout: 20 }) : undefined;

  return { supabase, sql };
}

export function getSupabaseConfigFromEnv(): SupabaseConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseKey,
    databaseUrl: process.env.DATABASE_URL,
  };
}
