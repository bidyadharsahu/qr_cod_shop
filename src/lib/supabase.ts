import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_SESSION_KEYS, TENANT_STORAGE_KEYS } from '@/lib/tenant';

let _supabase: SupabaseClient | null = null;

const tenantAwareFetch: typeof fetch = async (input, init) => {
  if (typeof window === 'undefined') {
    return fetch(input, init);
  }

  const headers = new Headers(init?.headers || {});
  headers.set('X-Client-Info', 'netrikxr-pwa');

  const tenantId =
    window.sessionStorage.getItem(ADMIN_SESSION_KEYS.restaurantId)
    || window.sessionStorage.getItem(TENANT_STORAGE_KEYS.restaurantId)
    || window.localStorage.getItem(TENANT_STORAGE_KEYS.restaurantId);

  if (tenantId) {
    headers.set('x-restaurant-id', tenantId);
  }

  if (window.sessionStorage.getItem(ADMIN_SESSION_KEYS.centralAdminAuthenticated) === 'true') {
    headers.set('x-central-admin', 'true');
  }

  return fetch(input, {
    ...init,
    headers,
  });
};

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
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
        global: {
          fetch: tenantAwareFetch,
          headers: {
            'X-Client-Info': 'netrikxr-pwa',
          }
        },
      });
    }
  }
  return _supabase;
}

// Lazy proxy so imports at the module level don't crash during SSG.
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
