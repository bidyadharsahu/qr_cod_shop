'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ArrowLeft } from 'lucide-react';
import type { Restaurant } from '@/lib/types';
import {
  clearAdminSession,
  DEFAULT_RESTAURANT_CONTEXT,
  normalizeRestaurantSlug,
  persistAdminSession,
  readAdminSession,
} from '@/lib/tenant';

type StaffRole = 'manager' | 'chef';

const DEFAULT_RESTAURANT_OPTION: Restaurant = {
  id: DEFAULT_RESTAURANT_CONTEXT.restaurantId,
  slug: DEFAULT_RESTAURANT_CONTEXT.restaurantSlug,
  name: DEFAULT_RESTAURANT_CONTEXT.restaurantName,
  plan: 'premium',
  status: 'active',
};

interface TenantResolveResponse {
  restaurant?: Restaurant;
  error?: string;
}

interface TenantCatalogResponse {
  restaurants?: Restaurant[];
  error?: string;
}

interface TenantAuthLoginResponse {
  authenticated?: boolean;
  staffRole?: StaffRole;
  staffUser?: string;
  restaurant?: Restaurant;
  error?: string;
}

interface AdminLoginPageProps {
  forcedTenantSlug?: string;
}

const REQUEST_TIMEOUT_MS = 12000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function LoginContent({ forcedTenantSlug }: AdminLoginPageProps) {
  const router = useRouter();
  const normalizedForcedSlug = normalizeRestaurantSlug(forcedTenantSlug || '');
  const tenantScopedLogin = Boolean(normalizedForcedSlug);
  const backToPath = tenantScopedLogin ? `/t/${normalizedForcedSlug}` : '/';

  const [role, setRole] = useState<StaffRole>('manager');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([DEFAULT_RESTAURANT_OPTION]);
  const [restaurantSlug, setRestaurantSlug] = useState(normalizedForcedSlug || DEFAULT_RESTAURANT_CONTEXT.restaurantSlug);
  const [tenantLabel, setTenantLabel] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [error, setError] = useState('');

  const tenantAdminPath = tenantScopedLogin ? `/t/${normalizedForcedSlug}/admin` : '/admin';

  // Check if already logged in
  useEffect(() => {
    const session = readAdminSession();
    if (!session.authenticated) return;

    if (session.staffRole === 'super_admin') {
      router.push('/central');
      return;
    }

    const sessionSlug = normalizeRestaurantSlug(session.restaurantSlug || '');
    if (tenantScopedLogin && sessionSlug !== normalizedForcedSlug) {
      clearAdminSession();
      return;
    }

    if (sessionSlug && sessionSlug !== DEFAULT_RESTAURANT_CONTEXT.restaurantSlug) {
      router.push(`/t/${sessionSlug}/admin`);
      return;
    }

    router.push(tenantAdminPath);
  }, [normalizedForcedSlug, router, tenantAdminPath, tenantScopedLogin]);

  useEffect(() => {
    const loadRestaurants = async () => {
      setTenantLoading(true);
      setError('');

      try {
        if (tenantScopedLogin) {
          const response = await fetchWithTimeout(`/api/tenant/resolve?slug=${encodeURIComponent(normalizedForcedSlug)}`, {
            cache: 'no-store',
          });

          const payload = await response.json() as TenantResolveResponse;
          if (!response.ok || !payload.restaurant) {
            setError(payload.error || 'This tenant URL is invalid or unavailable.');
            setRestaurants([]);
            return;
          }

          setRestaurants([payload.restaurant]);
          setRestaurantSlug(payload.restaurant.slug);
          setTenantLabel(payload.restaurant.name);
          return;
        }

        const response = await fetchWithTimeout('/api/tenant/catalog', { cache: 'no-store' });
        const payload = await response.json() as TenantCatalogResponse;

        const activeRestaurants = (payload.restaurants || []).filter((restaurant) => restaurant.status === 'active');

        if (!response.ok || activeRestaurants.length === 0) {
          setRestaurants([DEFAULT_RESTAURANT_OPTION]);
          setRestaurantSlug(DEFAULT_RESTAURANT_OPTION.slug);
          setTenantLabel(DEFAULT_RESTAURANT_OPTION.name);
          return;
        }

        setRestaurants(activeRestaurants);
        setRestaurantSlug((current) => {
          const keepCurrent = activeRestaurants.some((restaurant) => restaurant.slug === current);
          return keepCurrent ? current : activeRestaurants[0].slug;
        });
        setTenantLabel(activeRestaurants[0].name);
      } catch (err) {
        const timedOut = err instanceof DOMException && err.name === 'AbortError';

        if (tenantScopedLogin) {
          setRestaurants([]);
          setError(timedOut ? 'Tenant check timed out. Please refresh and try again.' : 'Could not verify this tenant right now.');
          return;
        }

        setRestaurants([DEFAULT_RESTAURANT_OPTION]);
        setRestaurantSlug(DEFAULT_RESTAURANT_OPTION.slug);
        setTenantLabel(DEFAULT_RESTAURANT_OPTION.name);
      } finally {
        setTenantLoading(false);
      }
    };

    loadRestaurants();
  }, [normalizedForcedSlug, tenantScopedLogin]);

  useEffect(() => {
    if (tenantScopedLogin) return;
    const selected = restaurants.find((restaurant) => restaurant.slug === restaurantSlug);
    if (selected) {
      setTenantLabel(selected.name);
    }
  }, [restaurantSlug, restaurants, tenantScopedLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedSlug = tenantScopedLogin ? normalizedForcedSlug : normalizeRestaurantSlug(restaurantSlug);
    const usernameTrimmed = username.trim();

    if (!normalizedSlug) {
      setError('Please select a valid restaurant.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetchWithTimeout('/api/tenant/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantSlug: normalizedSlug,
          username: usernameTrimmed,
          password,
          role,
        }),
      });

      let payload: TenantAuthLoginResponse = {};
      try {
        payload = await response.json() as TenantAuthLoginResponse;
      } catch {
        payload = {};
      }

      if (!response.ok || !payload.authenticated || !payload.restaurant) {
        const fallback = response.status === 503
          ? 'Tenant auth service is not configured. Set SUPABASE_SERVICE_ROLE_KEY and restart the app.'
          : 'Invalid credentials.';

        setError(payload.error || fallback);
        return;
      }

      persistAdminSession({
        staffRole: payload.staffRole || role,
        staffUser: payload.staffUser || usernameTrimmed,
        restaurantId: payload.restaurant.id,
        restaurantSlug: payload.restaurant.slug,
        restaurantName: payload.restaurant.name,
      });

      const scopedSlug = normalizeRestaurantSlug(payload.restaurant.slug || normalizedSlug);
      router.push(scopedSlug ? `/t/${scopedSlug}/admin` : tenantAdminPath);
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'AbortError';
      setError(timedOut ? 'Login timed out. Please try again.' : 'Could not sign in right now. Please try again.');
      return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Back button */}
      <div className="p-6">
        <Link href={backToPath} className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>{tenantScopedLogin ? 'Back to Tenant Home' : 'Back to Home'}</span>
        </Link>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          <div className="bg-zinc-800 rounded-2xl p-8 shadow-xl">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-amber-400 mb-2">{tenantScopedLogin ? 'Tenant Staff Portal' : 'Staff Portal'}</h1>
              <p className="text-gray-400 text-sm">
                {tenantScopedLogin
                  ? (tenantLabel ? `${tenantLabel} • Manager/Chef Login` : 'Manager/Chef Login')
                  : `${tenantLabel || DEFAULT_RESTAURANT_OPTION.name} • Staff Login`}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {tenantScopedLogin ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tenant URL</label>
                  <div className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200 text-sm">
                    {tenantLoading ? 'Loading tenant...' : `/${normalizedForcedSlug}`}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Restaurant</label>
                  <select
                    value={restaurantSlug}
                    onChange={(e) => setRestaurantSlug(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    {restaurants.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.slug}>
                        {restaurant.name} ({restaurant.plan})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="manager">Manager</option>
                  <option value="chef">Chef</option>
                </select>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (tenantScopedLogin && tenantLoading)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black px-6 py-3.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>LOGIN</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-zinc-500 text-center">
                Manager uses dashboard controls. Chef gets kitchen-only workflow. Credentials are tenant-specific.
              </p>

              {!tenantScopedLogin && (
                <p className="text-[11px] text-zinc-500 text-center">
                  Other tenants must use their private URL: /t/your-tenant-slug/admin/login
                </p>
              )}

              {!tenantScopedLogin && (
                <p className="text-[11px] text-zinc-500 text-center">
                  Super admin? <Link className="text-amber-400 hover:text-amber-300" href="/central/login">Open central panel login</Link>
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage(props: AdminLoginPageProps = {}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    }>
      <LoginContent {...props} />
    </Suspense>
  );
}
