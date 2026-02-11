import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // During build/SSG, env vars may not be present.
      // Return a dummy client – it is never called at runtime because
      // every Supabase call lives inside useEffect / event handlers.
      _supabase = createClient(
        'https://placeholder.supabase.co',
        'placeholder-key',
      );
    } else {
      _supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return _supabase;
}

// Lazy proxy so imports at the module level don't crash during SSG.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabase();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
