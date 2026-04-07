'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import {
  DEFAULT_RESTAURANT_CONTEXT,
  normalizeRestaurantSlug,
  persistAdminSession,
  readAdminSession,
} from '@/lib/tenant';

type StaffRole = 'manager' | 'chef' | 'restaurant_admin';

const FALLBACK_STAFF_CREDENTIALS: Record<StaffRole, { username: string; password: string }> = {
  manager: { username: 'hello', password: '789456' },
  chef: { username: 'chef', password: 'chef123' },
  restaurant_admin: { username: 'admin', password: 'admin123' },
};

const DEFAULT_RESTAURANT_OPTION: Restaurant = {
  id: DEFAULT_RESTAURANT_CONTEXT.restaurantId,
  slug: DEFAULT_RESTAURANT_CONTEXT.restaurantSlug,
  name: DEFAULT_RESTAURANT_CONTEXT.restaurantName,
  plan: 'premium',
  status: 'active',
};

function LoginContent() {
  const router = useRouter();
  const [role, setRole] = useState<StaffRole>('manager');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([DEFAULT_RESTAURANT_OPTION]);
  const [restaurantSlug, setRestaurantSlug] = useState(DEFAULT_RESTAURANT_CONTEXT.restaurantSlug);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already logged in
  useEffect(() => {
    const session = readAdminSession();
    if (session.authenticated) {
      router.push('/admin');
    }
  }, [router]);

  useEffect(() => {
    const loadRestaurants = async () => {
      const { data, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, slug, name, plan, status')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (restaurantsError || !data || data.length === 0) {
        setRestaurants([DEFAULT_RESTAURANT_OPTION]);
        setRestaurantSlug(DEFAULT_RESTAURANT_OPTION.slug);
        return;
      }

      const next = data as Restaurant[];
      setRestaurants(next);

      const normalized = normalizeRestaurantSlug(restaurantSlug);
      if (!next.some(r => normalizeRestaurantSlug(r.slug) === normalized)) {
        setRestaurantSlug(next[0].slug);
      }
    };

    loadRestaurants();
  }, [restaurantSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const normalizedSlug = normalizeRestaurantSlug(restaurantSlug);
    const selectedRestaurant = restaurants.find(r => normalizeRestaurantSlug(r.slug) === normalizedSlug) || null;

    let resolvedRestaurant = selectedRestaurant;
    if (!resolvedRestaurant) {
      const { data } = await supabase
        .from('restaurants')
        .select('id, slug, name, plan, status')
        .eq('slug', normalizedSlug)
        .maybeSingle();

      if (data) {
        resolvedRestaurant = data as Restaurant;
      }
    }

    if (!resolvedRestaurant) {
      resolvedRestaurant = DEFAULT_RESTAURANT_OPTION;
    }

    if (resolvedRestaurant.status !== 'active') {
      setError('Restaurant account is disabled. Contact support.');
      setLoading(false);
      return;
    }

    const usernameTrimmed = username.trim();

    const { data: staffMatch, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('id, username, role, is_active')
      .eq('restaurant_id', resolvedRestaurant.id)
      .eq('role', role)
      .eq('username', usernameTrimmed)
      .eq('password', password)
      .eq('is_active', true)
      .maybeSingle();

    const fallback = FALLBACK_STAFF_CREDENTIALS[role];
    const fallbackAllowed =
      normalizeRestaurantSlug(resolvedRestaurant.slug) === DEFAULT_RESTAURANT_CONTEXT.restaurantSlug
      && usernameTrimmed === fallback.username
      && password === fallback.password;

    const isAuthenticated = Boolean(staffMatch) || (!staffError && fallbackAllowed) || (staffError && fallbackAllowed);

    if (!isAuthenticated) {
      setError(`Invalid ${role} credentials for ${resolvedRestaurant.name}`);
      setLoading(false);
      return;
    }

    persistAdminSession({
      staffRole: role,
      staffUser: usernameTrimmed,
      restaurantId: resolvedRestaurant.id,
      restaurantSlug: resolvedRestaurant.slug,
      restaurantName: resolvedRestaurant.name,
    });

    router.push('/admin');
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Back button */}
      <div className="p-6">
        <Link href="/" className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          <div className="bg-zinc-800 rounded-2xl p-8 shadow-xl">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-amber-400 mb-2">Staff Portal</h1>
              <p className="text-gray-400 text-sm">Manager and Chef Login</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="manager">Manager</option>
                  <option value="chef">Chef</option>
                  <option value="restaurant_admin">Restaurant Admin</option>
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
                disabled={loading}
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

              <p className="text-[11px] text-zinc-500 text-center">
                Super admin? <Link className="text-amber-400 hover:text-amber-300" href="/central/login">Open central panel login</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
