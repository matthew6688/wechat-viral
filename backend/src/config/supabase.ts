import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

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
    
    // Create a fetch adapter using axios for better DNS resolution in Vercel
    // Axios has better DNS handling in Node.js/serverless environments
    const axiosFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const method = init?.method || 'GET';
      const headers = init?.headers || {};
      const body = init?.body ? (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)) : undefined;
      
      try {
        const response = await axios({
          url,
          method: method as any,
          headers: headers as any,
          data: body,
          validateStatus: () => true, // Don't throw on any status code
          timeout: 30000, // 30 second timeout
        });
        
        // Convert axios response to Fetch Response
        return new Response(JSON.stringify(response.data), {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers as any),
        });
      } catch (error: any) {
        console.error('[Supabase] Axios fetch error:', error.message);
        throw error;
      }
    };
    
    // Create Supabase client with axios-based fetch
    // This should resolve DNS issues in Vercel serverless functions
    try {
      _supabase = createClient<Database>(url, key, {
        auth: {
          persistSession: false, // Don't persist sessions in serverless
        },
        global: {
          fetch: axiosFetch,
        },
      });
      
      console.log('[Supabase] Client created with axios fetch adapter');
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
