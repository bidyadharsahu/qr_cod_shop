import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // During build/SSG, env vars may not be available - use placeholder
    // The client will only be used at runtime when env vars are present
    if (!supabaseUrl || !supabaseAnonKey) {
      // Return a mock client during build time to avoid errors
      // This will never be used at runtime since env vars will be set
      _supabase = createClient(
        'https://placeholder.supabase.co',
        'placeholder-key'
      );
    } else {
      _supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return _supabase;
}

// For backward compatibility – lazy getter so the client is only created at runtime
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
