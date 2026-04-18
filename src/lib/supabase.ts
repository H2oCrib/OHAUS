import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client singleton.
 *
 * Returns `null` if env vars are missing so the app continues to run in
 * local-only mode without crashing. Callers must null-check.
 *
 * Client init pattern (auth disabled — anon key + RLS only, no user sessions):
 * https://supabase.com/docs/guides/functions/unit-test
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasValidConfig =
  !!url &&
  !!anonKey &&
  url.startsWith('https://') &&
  anonKey !== 'PASTE_YOUR_ANON_KEY_HERE';

export const cloudEnabled: boolean = hasValidConfig;

export const supabase: SupabaseClient | null = hasValidConfig
  ? createClient(url!, anonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;
