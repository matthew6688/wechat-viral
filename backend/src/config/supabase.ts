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

    console.log('[Supabase] Initializing client with URL:', url);
    console.log('[Supabase] Service key present:', !!process.env.SUPABASE_SERVICE_KEY);
    console.log('[Supabase] Node version:', process.version);
    console.log('[Supabase] Vercel environment:', process.env.VERCEL);
    
    // Verify URL format
    if (!url.startsWith('https://')) {
      throw new Error(`Invalid SUPABASE_URL format: ${url}. Must start with https://`);
    }
    
    // Create Supabase client
    // Note: In Vercel, we rely on the default fetch implementation
    // If DNS resolution fails, it's likely a Vercel network configuration issue
    try {
      _supabase = createClient<Database>(url, key, {
        auth: {
          persistSession: false, // Don't persist sessions in serverless
        },
      });
      
      // Test connection by making a simple query
      // This will fail early if there's a DNS issue
      console.log('[Supabase] Client created, testing connection...');
    } catch (error: any) {
      console.error('[Supabase] Failed to create client:', error);
      throw new Error(`Failed to initialize Supabase client: ${error.message}`);
    }
    
    console.log('[Supabase] Client initialized successfully');
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    const client = getSupabase();
    return client[prop as keyof typeof client];
  }
});
