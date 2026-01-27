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
    
    // Create Supabase client with custom fetch that includes retry logic
    _supabase = createClient<Database>(url, key, {
      auth: {
        persistSession: false, // Don't persist sessions in serverless
      },
      global: {
        // Use custom fetch with timeout and retry
        fetch: async (url, options = {}) => {
          const maxRetries = 3;
          let lastError: any;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
              
              const response = await fetch(url, {
                ...options,
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              return response;
            } catch (error: any) {
              lastError = error;
              console.warn(`[Supabase] Fetch attempt ${attempt}/${maxRetries} failed:`, error.message);
              
              if (attempt < maxRetries) {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
              }
            }
          }
          
          throw new Error(`Supabase fetch failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
        },
      },
    });
    
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
