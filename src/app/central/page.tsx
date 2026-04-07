'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CreditCard,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react';
import type { Restaurant } from '@/lib/types';
import { normalizeRestaurantSlug } from '@/lib/tenant';

interface TenantMetrics {
  orders: number;
  paidOrders: number;
  revenue: number;
  totalTables: number;
  activeTables: number;
}

interface TenantUrls {
  base: string;
  order: string;
  adminLogin: string;
  adminDashboard: string;
}

interface CredentialsHint {
  restaurantName: string;
  restaurantSlug: string;
  manager: { username: string; password: string };
  chef: { username: string; password: string };
  admin: { username: string; password: string };
  urls: TenantUrls;
}

interface CentralRestaurantListResponse {
  restaurants?: Restaurant[];
  metricsByRestaurant?: Record<string, TenantMetrics>;
  error?: string;
}

interface CentralRestaurantCreateResponse {
  restaurant?: Restaurant;
  credentials?: {
    manager: { username: string; password: string };
    chef: { username: string; password: string };
    admin: { username: string; password: string };
  };
  urls?: TenantUrls;
  error?: string;
}

interface CentralRestaurantPatchResponse {
  restaurant?: Restaurant;
  error?: string;
}

const emptyMetrics = (): TenantMetrics => ({
  orders: 0,
  paidOrders: 0,
  revenue: 0,
  totalTables: 0,
  activeTables: 0,
});

const buildTenantUrls = (slug: string): TenantUrls => {
  const normalized = normalizeRestaurantSlug(slug);
  const base = `/t/${normalized}`;

  return {
    base,
    order: `${base}/order`,
    adminLogin: `${base}/admin/login`,
    adminDashboard: `${base}/admin`,
  };
};

export default function CentralAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [metricsByRestaurant, setMetricsByRestaurant] = useState<Record<number, TenantMetrics>>({});
  const [credentialsHint, setCredentialsHint] = useState<CredentialsHint | null>(null);

  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [plan, setPlan] = useState<'basic' | 'premium'>('basic');

  const totalRestaurants = restaurants.length;
  const activeRestaurants = restaurants.filter((restaurant) => restaurant.status === 'active').length;
  const premiumRestaurants = restaurants.filter((restaurant) => restaurant.plan === 'premium').length;

  const aggregatedMetrics = useMemo(() => {
    const totals = {
      orders: 0,
      paidOrders: 0,
      revenue: 0,
      activeTables: 0,
      totalTables: 0,
    };

    Object.values(metricsByRestaurant).forEach((entry) => {
      totals.orders += entry.orders;
      totals.paidOrders += entry.paidOrders;
      totals.revenue += entry.revenue;
      totals.activeTables += entry.activeTables;
      totals.totalTables += entry.totalTables;
    });

    return totals;
  }, [metricsByRestaurant]);

  const loadCentralData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/central/restaurants', { cache: 'no-store' });

      if (response.status === 401) {
        router.push('/central/login');
        return;
      }

      const payload = await response.json() as CentralRestaurantListResponse;

      if (!response.ok) {
        setError(payload.error || 'Could not load central admin data.');
        setRestaurants([]);
        setMetricsByRestaurant({});
        return;
      }

      const tenantRows = payload.restaurants || [];
      setRestaurants(tenantRows);

      const nextMetrics: Record<number, TenantMetrics> = {};
      Object.entries(payload.metricsByRestaurant || {}).forEach(([restaurantId, metrics]) => {
        const numericId = Number(restaurantId);
        if (!Number.isFinite(numericId)) return;
        nextMetrics[numericId] = {
          ...emptyMetrics(),
          ...metrics,
        };
      });

      setMetricsByRestaurant(nextMetrics);
    } catch {
      setError('Could not load central admin data.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const ensureSessionAndLoad = async () => {
      try {
        const response = await fetch('/api/central/auth/session', { cache: 'no-store' });
        if (!response.ok) {
          router.push('/central/login');
          return;
        }

        loadCentralData();
      } catch {
        router.push('/central/login');
      }
    };

    ensureSessionAndLoad();
  }, [router, loadCentralData]);

  const handleLogout = async () => {
    try {
      await fetch('/api/central/auth/logout', { method: 'POST' });
    } catch {
      // Even if logout API fails, force navigation to login.
    }

    router.push('/central/login');
  };

  const handleCreateRestaurant = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCredentialsHint(null);

    const trimmedName = restaurantName.trim();
    const normalizedSlug = normalizeRestaurantSlug(restaurantSlug || trimmedName);

    if (!trimmedName) {
      setError('Restaurant name is required.');
      return;
    }

    if (!normalizedSlug) {
      setError('Restaurant slug is invalid.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/central/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          slug: normalizedSlug,
          ownerEmail: ownerEmail.trim() || null,
          plan,
        }),
      });

      if (response.status === 401) {
        router.push('/central/login');
        return;
      }

      const payload = await response.json() as CentralRestaurantCreateResponse;

      if (!response.ok || !payload.restaurant || !payload.credentials) {
        setError(payload.error || 'Failed to create restaurant.');
        return;
      }

      const tenant = payload.restaurant;
      const managerCreds = payload.credentials.manager;
      const chefCreds = payload.credentials.chef;
      const adminCreds = payload.credentials.admin;

      setCredentialsHint({
        restaurantName: tenant.name,
        restaurantSlug: tenant.slug,
        manager: managerCreds,
        chef: chefCreds,
        admin: adminCreds,
        urls: payload.urls || buildTenantUrls(tenant.slug),
      });

      setRestaurantName('');
      setRestaurantSlug('');
      setOwnerEmail('');
      setPlan('basic');
      setSuccess('Restaurant created and provisioned successfully.');

      loadCentralData();
    } catch {
      setError('Failed to create restaurant.');
    } finally {
      setSaving(false);
    }
  };

  const updateRestaurantPlan = async (id: number, nextPlan: 'basic' | 'premium') => {
    setError('');
    setSuccess('');

    const response = await fetch(`/api/central/restaurants/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan: nextPlan,
      }),
    });

    if (response.status === 401) {
      router.push('/central/login');
      return;
    }

    const payload = await response.json() as CentralRestaurantPatchResponse;

    if (!response.ok) {
      setError(`Could not update plan: ${payload.error || 'Unknown error'}`);
      return;
    }

    setSuccess('Subscription plan updated.');
    loadCentralData();
  };

  const toggleRestaurantStatus = async (restaurant: Restaurant) => {
    setError('');
    setSuccess('');

    const nextStatus: 'active' | 'disabled' = restaurant.status === 'active' ? 'disabled' : 'active';

    const response = await fetch(`/api/central/restaurants/${restaurant.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: nextStatus,
      }),
    });

    if (response.status === 401) {
      router.push('/central/login');
      return;
    }

    const payload = await response.json() as CentralRestaurantPatchResponse;

    if (!response.ok) {
      setError(`Could not update status: ${payload.error || 'Unknown error'}`);
      return;
    }

    setSuccess(`Restaurant ${nextStatus === 'active' ? 'activated' : 'disabled'} successfully.`);
    loadCentralData();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-300 hover:text-white text-sm mb-3">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Central Admin Dashboard</h1>
                <p className="text-sm text-zinc-400">Manage restaurants, subscriptions, and platform health from one place.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadCentralData}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
            >
              <RefreshCcw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 text-sm"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {credentialsHint && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100 space-y-1">
            <p className="font-semibold">New tenant ready: {credentialsHint.restaurantName} ({credentialsHint.restaurantSlug})</p>
            <p>Manager: {credentialsHint.manager.username} / {credentialsHint.manager.password}</p>
            <p>Chef: {credentialsHint.chef.username} / {credentialsHint.chef.password}</p>
            <p>Restaurant Admin: {credentialsHint.admin.username} / {credentialsHint.admin.password}</p>
            <p className="pt-1">Tenant URL: <Link href={credentialsHint.urls.base} className="underline text-amber-200 hover:text-amber-100">{credentialsHint.urls.base}</Link></p>
            <p>Order URL: <Link href={credentialsHint.urls.order} className="underline text-amber-200 hover:text-amber-100">{credentialsHint.urls.order}</Link></p>
            <p>Tenant Admin Login: <Link href={credentialsHint.urls.adminLogin} className="underline text-amber-200 hover:text-amber-100">{credentialsHint.urls.adminLogin}</Link></p>
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Restaurants</p>
            <p className="text-3xl font-black mt-2">{totalRestaurants}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Active</p>
            <p className="text-3xl font-black mt-2 text-emerald-300">{activeRestaurants}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Premium</p>
            <p className="text-3xl font-black mt-2 text-sky-300">{premiumRestaurants}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Platform Orders</p>
            <p className="text-3xl font-black mt-2">{aggregatedMetrics.orders}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Platform Revenue</p>
            <p className="text-3xl font-black mt-2 text-amber-300">${aggregatedMetrics.revenue.toFixed(2)}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-emerald-300" />
              <h2 className="font-bold text-lg">Add Restaurant</h2>
            </div>

            <form className="space-y-3" onSubmit={handleCreateRestaurant}>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Restaurant Name</label>
                <input
                  value={restaurantName}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setRestaurantName(nextName);
                    if (!restaurantSlug.trim()) setRestaurantSlug(normalizeRestaurantSlug(nextName));
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="Tenant Name (example: Green Bowl Downtown)"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Slug</label>
                <input
                  value={restaurantSlug}
                  onChange={(event) => setRestaurantSlug(normalizeRestaurantSlug(event.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="tenant-slug (example: green-bowl-downtown)"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Owner Email</label>
                <input
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="owner@example.com"
                  type="email"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Subscription Plan</label>
                <select
                  value={plan}
                  onChange={(event) => setPlan(event.target.value === 'premium' ? 'premium' : 'basic')}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                >
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2.5 disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Creating...' : 'Create Restaurant'}
              </button>
            </form>
          </div>

          <div className="xl:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-sky-300" />
              <h2 className="font-bold text-lg">Tenant List</h2>
            </div>

            {loading ? (
              <div className="py-10 text-center text-zinc-500">Loading tenant data...</div>
            ) : restaurants.length === 0 ? (
              <div className="py-10 text-center text-zinc-500">No restaurants found. Create your first tenant.</div>
            ) : (
              <div className="space-y-3">
                {restaurants.map((restaurant) => {
                  const metrics = metricsByRestaurant[restaurant.id] || emptyMetrics();
                  const tenantUrls = buildTenantUrls(restaurant.slug);

                  return (
                    <div key={restaurant.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-zinc-100">{restaurant.name}</p>
                          <p className="text-xs text-zinc-400">slug: {restaurant.slug} • owner: {restaurant.owner_email || 'n/a'}</p>
                          <p className="text-[11px] text-zinc-500 mt-1">
                            tenant: <Link href={tenantUrls.base} className="underline hover:text-zinc-300">{tenantUrls.base}</Link>
                            {' • '}
                            admin: <Link href={tenantUrls.adminLogin} className="underline hover:text-zinc-300">{tenantUrls.adminLogin}</Link>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${restaurant.status === 'active' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>
                            {restaurant.status === 'active' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                            {restaurant.status}
                          </span>

                          <select
                            value={restaurant.plan}
                            onChange={(event) => updateRestaurantPlan(restaurant.id, event.target.value === 'premium' ? 'premium' : 'basic')}
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                          >
                            <option value="basic">Basic</option>
                            <option value="premium">Premium</option>
                          </select>

                          <button
                            onClick={() => toggleRestaurantStatus(restaurant)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold ${restaurant.status === 'active' ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'}`}
                          >
                            {restaurant.status === 'active' ? 'Disable' : 'Activate'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
                          <div className="text-zinc-500">Orders</div>
                          <div className="font-semibold">{metrics.orders}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
                          <div className="text-zinc-500">Paid</div>
                          <div className="font-semibold">{metrics.paidOrders}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
                          <div className="text-zinc-500">Revenue</div>
                          <div className="font-semibold">${metrics.revenue.toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
                          <div className="text-zinc-500">Tables</div>
                          <div className="font-semibold">{metrics.totalTables}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
                          <div className="text-zinc-500">Active Tables</div>
                          <div className="font-semibold">{metrics.activeTables}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-amber-300 mt-0.5" />
            <div>
              <p className="font-semibold">Usage Monitoring</p>
              <p className="text-xs text-zinc-400 mt-1">Live totals aggregate orders, paid orders, revenue, and active tables across all tenants.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-sky-300 mt-0.5" />
            <div>
              <p className="font-semibold">Subscription Control</p>
              <p className="text-xs text-zinc-400 mt-1">Switch plan per restaurant and gate premium features like online payments by plan.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-start gap-3">
            <Users className="w-5 h-5 text-emerald-300 mt-0.5" />
            <div>
              <p className="font-semibold">Tenant Activation</p>
              <p className="text-xs text-zinc-400 mt-1">Disable or activate restaurants instantly to control access and workflows safely.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
