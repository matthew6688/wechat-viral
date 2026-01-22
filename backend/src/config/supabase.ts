import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Note: dotenv is loaded in index.ts before any imports

// Use 'any' for database type to avoid strict type checking on tables
// This allows us to use tables without generating TypeScript types
type Database = any;

let _supabase: SupabaseClient<Database> | null = null;

function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    // Use service key for backend (has full permissions)
    // Fallback to anon key if service key is not available
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY environment variables');
    }

    _supabase = createClient<Database>(url, key);
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    const client = getSupabase();
    return client[prop as keyof typeof client];
  }
});
