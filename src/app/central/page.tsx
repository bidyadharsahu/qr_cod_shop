'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Eye,
  KeyRound,
  LogOut,
  Plus,
  QrCode,
  RefreshCcw,
  Save,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
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

interface StaffCredential {
  username: string;
  password: string;
}

interface TenantBranding {
  businessName: string;
  adminSubtitle: string;
  logoUrl: string;
  chatbotName: string;
}

interface TenantDetails {
  restaurant: Restaurant & { owner_phone?: string | null };
  credentials: {
    manager: StaffCredential | null;
    chef: StaffCredential | null;
    legacyAdmin?: StaffCredential | null;
  };
  branding: TenantBranding;
  urls: TenantUrls;
}

interface CredentialsHint {
  restaurantName: string;
  restaurantSlug: string;
  manager: StaffCredential;
  chef: StaffCredential;
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
    manager: StaffCredential;
    chef: StaffCredential;
  };
  urls?: TenantUrls;
  error?: string;
}

interface CentralRestaurantPatchResponse {
  restaurant?: Restaurant & { owner_phone?: string | null };
  credentials?: {
    manager: StaffCredential | null;
    chef: StaffCredential | null;
    legacyAdmin?: StaffCredential | null;
  };
  branding?: TenantBranding;
  urls?: TenantUrls;
  message?: string;
  deleted?: boolean;
  error?: string;
}

const DEFAULT_RESTAURANT_SLUG = 'coasis';
const DEFAULT_CHATBOT_NAME = 'SIA';
const DEFAULT_LOGO_URL = '/icons/icon-192x192.png';

const emptyMetrics = (): TenantMetrics => ({
  orders: 0,
  paidOrders: 0,
  revenue: 0,
  totalTables: 0,
  activeTables: 0,
});

const buildTenantUrls = (slug: string, origin = ''): TenantUrls => {
  const normalized = normalizeRestaurantSlug(slug);
  const basePath = `/t/${normalized}`;
  const base = origin ? `${origin}${basePath}` : basePath;

  return {
    base,
    order: `${base}/order`,
    adminLogin: `${base}/admin/login`,
    adminDashboard: `${base}/admin`,
  };
};

const buildQrImageUrl = (payload: string, size = 180): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(payload)}`;
};

const buildTenantPublicQrPayload = (restaurant: Restaurant, urls: TenantUrls): string => {
  return [
    `Restaurant: ${restaurant.name}`,
    `ID: ${restaurant.id}`,
    `Slug: ${restaurant.slug}`,
    `Owner Email: ${restaurant.owner_email || 'n/a'}`,
    `Status: ${restaurant.status}`,
    `Plan: ${restaurant.plan}`,
    `Tenant URL: ${urls.base}`,
    `Admin Login: ${urls.adminLogin}`,
    `Order URL: ${urls.order}`,
  ].join('\n');
};

const buildTenantPrivateQrPayload = (details: TenantDetails): string => {
  return [
    `Restaurant: ${details.restaurant.name}`,
    `ID: ${details.restaurant.id}`,
    `Slug: ${details.restaurant.slug}`,
    `Owner Email: ${details.restaurant.owner_email || 'n/a'}`,
    `Owner Phone: ${details.restaurant.owner_phone || 'n/a'}`,
    `Status: ${details.restaurant.status}`,
    `Plan: ${details.restaurant.plan}`,
    `Manager Username: ${details.credentials.manager?.username || 'n/a'}`,
    `Manager Password: ${details.credentials.manager?.password || 'n/a'}`,
    `Chef Username: ${details.credentials.chef?.username || 'n/a'}`,
    `Chef Password: ${details.credentials.chef?.password || 'n/a'}`,
    `Chatbot Name: ${details.branding.chatbotName || DEFAULT_CHATBOT_NAME}`,
    `Logo URL: ${details.branding.logoUrl || DEFAULT_LOGO_URL}`,
    `Tenant URL: ${details.urls.base}`,
    `Admin Login: ${details.urls.adminLogin}`,
    `Order URL: ${details.urls.order}`,
  ].join('\n');
};

interface TenantDetailForm {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPhone: string;
  managerUsername: string;
  managerPassword: string;
  chefUsername: string;
  chefPassword: string;
  chatbotName: string;
  logoUrl: string;
}

const emptyDetailForm = (): TenantDetailForm => ({
  name: '',
  slug: '',
  ownerEmail: '',
  ownerPhone: '',
  managerUsername: 'manager',
  managerPassword: '',
  chefUsername: 'chef',
  chefPassword: '',
  chatbotName: DEFAULT_CHATBOT_NAME,
  logoUrl: DEFAULT_LOGO_URL,
});

const panelClass = 'rounded-3xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_24px_48px_rgba(0,0,0,0.35)]';
const inputClass = 'w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-500/20 transition';
const subtleButtonClass = 'inline-flex items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 transition';

export default function CentralAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deletingTenantId, setDeletingTenantId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [metricsByRestaurant, setMetricsByRestaurant] = useState<Record<number, TenantMetrics>>({});
  const [credentialsHint, setCredentialsHint] = useState<CredentialsHint | null>(null);
  const [detailsByRestaurant, setDetailsByRestaurant] = useState<Record<number, TenantDetails>>({});
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null);
  const [activeRestaurantId, setActiveRestaurantId] = useState<number | null>(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [origin, setOrigin] = useState('');
  const [detailForm, setDetailForm] = useState<TenantDetailForm>(emptyDetailForm());

  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [plan, setPlan] = useState<'basic' | 'premium'>('basic');

  const totalRestaurants = restaurants.length;
  const activeRestaurants = restaurants.filter((restaurant) => restaurant.status === 'active').length;
  const premiumRestaurants = restaurants.filter((restaurant) => restaurant.plan === 'premium').length;

  const ownerDirectory = useMemo(() => {
    const byOwner = new Map<string, { email: string; tenantCount: number; activeCount: number }>();

    restaurants.forEach((restaurant) => {
      const email = (restaurant.owner_email || '').trim().toLowerCase();
      if (!email) return;

      const existing = byOwner.get(email) || { email, tenantCount: 0, activeCount: 0 };
      existing.tenantCount += 1;
      if (restaurant.status === 'active') {
        existing.activeCount += 1;
      }
      byOwner.set(email, existing);
    });

    return Array.from(byOwner.values()).sort((left, right) => left.email.localeCompare(right.email));
  }, [restaurants]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOrigin(window.location.origin);
  }, []);

  const activeRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === activeRestaurantId) || null,
    [activeRestaurantId, restaurants],
  );

  const activeDetails = useMemo(() => {
    if (!activeRestaurantId) return null;
    return detailsByRestaurant[activeRestaurantId] || null;
  }, [activeRestaurantId, detailsByRestaurant]);

  const setDetailFormFromData = useCallback((restaurant: Restaurant, details: TenantDetails | null) => {
    const sourceRestaurant = details?.restaurant || restaurant;

    setDetailForm({
      name: sourceRestaurant.name || '',
      slug: sourceRestaurant.slug || '',
      ownerEmail: sourceRestaurant.owner_email || '',
      ownerPhone: details?.restaurant.owner_phone || '',
      managerUsername: details?.credentials.manager?.username || 'manager',
      managerPassword: details?.credentials.manager?.password || '',
      chefUsername: details?.credentials.chef?.username || 'chef',
      chefPassword: details?.credentials.chef?.password || '',
      chatbotName: details?.branding.chatbotName || DEFAULT_CHATBOT_NAME,
      logoUrl: details?.branding.logoUrl || DEFAULT_LOGO_URL,
    });
  }, []);

  const fetchRestaurantDetails = useCallback(async (restaurantId: number, silent = false): Promise<TenantDetails | null> => {
    if (!silent) {
      setDetailsLoadingId(restaurantId);
      setError('');
    }

    try {
      const response = await fetch(`/api/central/restaurants/${restaurantId}`, { cache: 'no-store' });

      if (response.status === 401) {
        router.push('/central/login');
        return null;
      }

      const payload = await response.json() as CentralRestaurantPatchResponse;
      if (!response.ok || !payload.restaurant || !payload.credentials || !payload.branding || !payload.urls) {
        if (!silent) {
          setError(payload.error || 'Could not load tenant details.');
        }
        return null;
      }

      const normalizedRestaurant = payload.restaurant.is_default
        ? { ...payload.restaurant, slug: DEFAULT_RESTAURANT_SLUG }
        : payload.restaurant;

      const details: TenantDetails = {
        restaurant: normalizedRestaurant,
        credentials: {
          manager: payload.credentials.manager,
          chef: payload.credentials.chef,
          legacyAdmin: payload.credentials.legacyAdmin,
        },
        branding: payload.branding,
        urls: payload.urls,
      };

      setDetailsByRestaurant((prev) => ({
        ...prev,
        [restaurantId]: details,
      }));

      return details;
    } catch {
      if (!silent) {
        setError('Could not load tenant details.');
      }
      return null;
    } finally {
      if (!silent) {
        setDetailsLoadingId((current) => (current === restaurantId ? null : current));
      }
    }
  }, [router]);

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

      const tenantRows = (payload.restaurants || []).map((restaurant) => (
        restaurant.is_default
          ? { ...restaurant, slug: DEFAULT_RESTAURANT_SLUG }
          : restaurant
      ));
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
          ownerPhone: ownerPhone.trim() || null,
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

      setCredentialsHint({
        restaurantName: tenant.name,
        restaurantSlug: tenant.slug,
        manager: managerCreds,
        chef: chefCreds,
        urls: payload.urls || buildTenantUrls(tenant.slug, origin),
      });

      setRestaurantName('');
      setRestaurantSlug('');
      setOwnerEmail('');
      setOwnerPhone('');
      setPlan('basic');
      setSuccess('Restaurant created and provisioned successfully.');

      const details: TenantDetails = {
        restaurant: tenant,
        credentials: {
          manager: managerCreds,
          chef: chefCreds,
          legacyAdmin: null,
        },
        branding: {
          businessName: tenant.name,
          adminSubtitle: 'Admin Panel',
          logoUrl: DEFAULT_LOGO_URL,
          chatbotName: DEFAULT_CHATBOT_NAME,
        },
        urls: payload.urls || buildTenantUrls(tenant.slug, origin),
      };

      setDetailsByRestaurant((prev) => ({
        ...prev,
        [tenant.id]: details,
      }));

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

  const openTenantDetails = async (restaurant: Restaurant) => {
    setActiveRestaurantId(restaurant.id);
    setDeletePasscode('');
    setError('');

    const cached = detailsByRestaurant[restaurant.id] || null;
    setDetailFormFromData(restaurant, cached);

    const details = await fetchRestaurantDetails(restaurant.id);
    if (details) {
      setDetailFormFromData(restaurant, details);
    }
  };

  const handleSaveTenantDetails = async () => {
    if (!activeRestaurant) return;

    setSavingDetails(true);
    setError('');
    setSuccess('');

    const normalizedSlug = normalizeRestaurantSlug(detailForm.slug || detailForm.name);
    if (!normalizedSlug) {
      setSavingDetails(false);
      setError('Tenant slug is invalid.');
      return;
    }

    try {
      const response = await fetch(`/api/central/restaurants/${activeRestaurant.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: detailForm.name.trim(),
          slug: normalizedSlug,
          ownerEmail: detailForm.ownerEmail.trim() || null,
          ownerPhone: detailForm.ownerPhone.trim() || null,
          credentials: {
            manager: {
              username: detailForm.managerUsername.trim(),
              password: detailForm.managerPassword,
            },
            chef: {
              username: detailForm.chefUsername.trim(),
              password: detailForm.chefPassword,
            },
          },
          branding: {
            businessName: detailForm.name.trim(),
            adminSubtitle: 'Admin Panel',
            logoUrl: detailForm.logoUrl.trim() || DEFAULT_LOGO_URL,
            chatbotName: detailForm.chatbotName.trim() || DEFAULT_CHATBOT_NAME,
          },
        }),
      });

      if (response.status === 401) {
        router.push('/central/login');
        return;
      }

      const payload = await response.json() as CentralRestaurantPatchResponse;
      if (!response.ok || !payload.restaurant || !payload.credentials || !payload.branding || !payload.urls) {
        setError(payload.error || 'Could not update tenant details.');
        return;
      }

      setSuccess('Tenant credentials and settings updated.');

      const normalizedRestaurant = payload.restaurant.is_default
        ? { ...payload.restaurant, slug: DEFAULT_RESTAURANT_SLUG }
        : payload.restaurant;

      const nextDetails: TenantDetails = {
        restaurant: normalizedRestaurant,
        credentials: {
          manager: payload.credentials.manager,
          chef: payload.credentials.chef,
          legacyAdmin: payload.credentials.legacyAdmin,
        },
        branding: payload.branding,
        urls: payload.urls,
      };

      setDetailsByRestaurant((prev) => ({
        ...prev,
        [activeRestaurant.id]: nextDetails,
      }));

      setDetailFormFromData(nextDetails.restaurant, nextDetails);
      await loadCentralData();
    } catch {
      setError('Could not update tenant details.');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDeleteRestaurant = async () => {
    if (!activeRestaurant) return;

    const passcode = deletePasscode.trim();
    if (!passcode) {
      setError('Delete passcode is required.');
      return;
    }

    setDeletingTenantId(activeRestaurant.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/central/restaurants/${activeRestaurant.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode }),
      });

      if (response.status === 401) {
        router.push('/central/login');
        return;
      }

      const payload = await response.json() as CentralRestaurantPatchResponse;
      if (!response.ok || !payload.deleted) {
        setError(payload.error || 'Could not delete restaurant.');
        return;
      }

      setSuccess(payload.message || 'Restaurant deleted successfully.');
      setActiveRestaurantId(null);
      setDeletePasscode('');
      setDetailsByRestaurant((prev) => {
        const next = { ...prev };
        delete next[activeRestaurant.id];
        return next;
      });
      await loadCentralData();
    } catch {
      setError('Could not delete restaurant.');
    } finally {
      setDeletingTenantId(null);
    }
  };

  const closeDetailsModal = () => {
    setActiveRestaurantId(null);
    setDeletePasscode('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_85%_20%,rgba(14,165,233,0.12),transparent_35%)]" />
      <div className="relative px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mx-auto w-full max-w-[1320px] space-y-5 lg:space-y-6 xl:space-y-7">
          <div className={`${panelClass} p-5 sm:p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4`}>
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-300 hover:text-white text-sm mb-4 transition">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
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
              className={subtleButtonClass}
            >
              <RefreshCcw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/20 transition"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {credentialsHint && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100 space-y-1">
            <p className="font-semibold">New tenant ready: {credentialsHint.restaurantName} ({credentialsHint.restaurantSlug})</p>
            <p>Manager: {credentialsHint.manager.username} / {credentialsHint.manager.password}</p>
            <p>Chef: {credentialsHint.chef.username} / {credentialsHint.chef.password}</p>
            <p className="pt-1">Tenant URL: <Link href={credentialsHint.urls.base} className="underline text-amber-200 hover:text-amber-100">{credentialsHint.urls.base}</Link></p>
            <p>Order URL: <Link href={credentialsHint.urls.order} className="underline text-amber-200 hover:text-amber-100">{credentialsHint.urls.order}</Link></p>
            <p>Tenant Admin Login: <Link href={credentialsHint.urls.adminLogin} className="underline text-amber-200 hover:text-amber-100">{credentialsHint.urls.adminLogin}</Link></p>
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 xl:gap-5">
          <div className={`${panelClass} p-4`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Restaurants</p>
            <p className="text-3xl font-black mt-2 leading-none">{totalRestaurants}</p>
          </div>
          <div className={`${panelClass} p-4`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Active</p>
            <p className="text-3xl font-black mt-2 leading-none text-emerald-300">{activeRestaurants}</p>
          </div>
          <div className={`${panelClass} p-4`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Premium</p>
            <p className="text-3xl font-black mt-2 leading-none text-sky-300">{premiumRestaurants}</p>
          </div>
          <div className={`${panelClass} p-4`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Platform Orders</p>
            <p className="text-3xl font-black mt-2 leading-none">{aggregatedMetrics.orders}</p>
          </div>
          <div className={`${panelClass} p-4`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Platform Revenue</p>
            <p className="text-3xl font-black mt-2 leading-none text-amber-300">${aggregatedMetrics.revenue.toFixed(2)}</p>
          </div>
          <div className={`${panelClass} p-4`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Owner Contacts</p>
            <p className="text-3xl font-black mt-2 leading-none text-indigo-300">{ownerDirectory.length}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)] gap-4 xl:gap-6 items-start">
          <div className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-emerald-300" />
              <h2 className="font-bold text-lg">Add Restaurant</h2>
            </div>

            <form className="space-y-3.5" onSubmit={handleCreateRestaurant}>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Restaurant Name</label>
                <input
                  value={restaurantName}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setRestaurantName(nextName);
                    if (!restaurantSlug.trim()) setRestaurantSlug(normalizeRestaurantSlug(nextName));
                  }}
                  className={inputClass}
                  placeholder="Tenant Name (example: Green Bowl Downtown)"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Slug</label>
                <input
                  value={restaurantSlug}
                  onChange={(event) => setRestaurantSlug(normalizeRestaurantSlug(event.target.value))}
                  className={inputClass}
                  placeholder="tenant-slug (example: green-bowl-downtown)"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Owner Email</label>
                <input
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  className={inputClass}
                  placeholder="owner@example.com"
                  type="email"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Owner Phone</label>
                <input
                  value={ownerPhone}
                  onChange={(event) => setOwnerPhone(event.target.value)}
                  className={inputClass}
                  placeholder="+1 000 000 0000"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Subscription Plan</label>
                <select
                  value={plan}
                  onChange={(event) => setPlan(event.target.value === 'premium' ? 'premium' : 'basic')}
                  className={inputClass}
                >
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-zinc-950 font-semibold hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Creating...' : 'Create Restaurant'}
              </button>
            </form>
          </div>

          <div className={`${panelClass} p-5 min-w-0`}>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-sky-300" />
              <h2 className="font-bold text-lg">Tenant List</h2>
            </div>

            {loading ? (
              <div className="py-10 text-center text-zinc-500">Loading tenant data...</div>
            ) : restaurants.length === 0 ? (
              <div className="py-10 text-center text-zinc-500">No restaurants found. Create your first tenant.</div>
            ) : (
              <div className="space-y-4">
                {restaurants.map((restaurant) => {
                  const metrics = metricsByRestaurant[restaurant.id] || emptyMetrics();
                  const tenantUrls = buildTenantUrls(restaurant.slug, origin);
                  const details = detailsByRestaurant[restaurant.id] || null;
                  const cardQrPayload = details
                    ? buildTenantPrivateQrPayload(details)
                    : buildTenantPublicQrPayload(restaurant, tenantUrls);

                  return (
                    <div key={restaurant.id} className="rounded-2xl border border-zinc-800/90 bg-zinc-950/70 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.25)]">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-zinc-100 leading-tight">{restaurant.name}</p>
                            <button
                              onClick={() => openTenantDetails(restaurant)}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-800 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {detailsLoadingId === restaurant.id ? 'Loading...' : 'View'}
                            </button>
                          </div>
                          <p className="text-xs text-zinc-400">slug: {restaurant.slug} • owner: {restaurant.owner_email || 'n/a'}</p>
                          {details?.restaurant.owner_phone && (
                            <p className="text-[11px] text-zinc-500">phone: {details.restaurant.owner_phone}</p>
                          )}
                          <p className="text-[11px] text-zinc-500 mt-1">
                            tenant: <Link href={tenantUrls.base} className="underline hover:text-zinc-300">{tenantUrls.base}</Link>
                            {' • '}
                            admin: <Link href={tenantUrls.adminLogin} className="underline hover:text-zinc-300">{tenantUrls.adminLogin}</Link>
                          </p>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${restaurant.status === 'active' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>
                              {restaurant.status === 'active' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                              {restaurant.status}
                            </span>

                            <select
                              value={restaurant.plan}
                              onChange={(event) => updateRestaurantPlan(restaurant.id, event.target.value === 'premium' ? 'premium' : 'basic')}
                              className="rounded-lg border border-zinc-700/80 bg-zinc-900 px-2.5 py-1.5 text-xs"
                            >
                              <option value="basic">Basic</option>
                              <option value="premium">Premium</option>
                            </select>

                            <button
                              onClick={() => toggleRestaurantStatus(restaurant)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${restaurant.status === 'active' ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'}`}
                            >
                              {restaurant.status === 'active' ? 'Disable' : 'Activate'}
                            </button>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 w-[98px] h-[122px] flex flex-col items-center justify-between">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wide inline-flex items-center gap-1">
                              <QrCode className="w-3 h-3" />
                              QR
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={buildQrImageUrl(cardQrPayload, 82)}
                              alt={`QR for ${restaurant.name}`}
                              className="w-[82px] h-[82px] rounded bg-white"
                            />
                            <div className="text-[10px] text-zinc-500">{details ? 'full' : 'public'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-2">
                          <div className="text-zinc-500">Orders</div>
                          <div className="font-semibold">{metrics.orders}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-2">
                          <div className="text-zinc-500">Paid</div>
                          <div className="font-semibold">{metrics.paidOrders}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-2">
                          <div className="text-zinc-500">Revenue</div>
                          <div className="font-semibold">${metrics.revenue.toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-2">
                          <div className="text-zinc-500">Tables</div>
                          <div className="font-semibold">{metrics.totalTables}</div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-2">
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

        <section className={`${panelClass} p-5 w-full`}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-indigo-300" />
            <h2 className="font-bold text-lg">Owner Directory</h2>
          </div>

          {ownerDirectory.length === 0 ? (
            <p className="text-sm text-zinc-400">No owner emails are set yet. Add owner email while creating/updating tenants.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ownerDirectory.map((owner) => (
                <div key={owner.email} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{owner.email}</p>
                  <p className="text-xs text-zinc-400 mt-1">Tenants: {owner.tenantCount}</p>
                  <p className="text-xs text-zinc-500">Active: {owner.activeCount}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {activeRestaurant && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
            <div className="w-full max-w-6xl max-h-[92vh] overflow-auto rounded-3xl border border-zinc-700 bg-zinc-950 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950/95 z-10 backdrop-blur-sm">
                <div>
                  <p className="text-sm text-zinc-400">Tenant Details</p>
                  <h3 className="text-xl font-bold text-zinc-100">{activeRestaurant.name}</h3>
                </div>
                <button
                  onClick={closeDetailsModal}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-700 hover:bg-zinc-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
                <div className="lg:col-span-2 space-y-5">
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                    <p className="text-sm font-semibold text-zinc-100 mb-3">Restaurant Profile</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Name</label>
                        <input
                          value={detailForm.name}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, name: event.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Slug</label>
                        <input
                          value={detailForm.slug}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, slug: normalizeRestaurantSlug(event.target.value) }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Owner Email</label>
                        <input
                          value={detailForm.ownerEmail}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, ownerEmail: event.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Owner Phone</label>
                        <input
                          value={detailForm.ownerPhone}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, ownerPhone: event.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                    <p className="text-sm font-semibold text-zinc-100 mb-3">Staff Credentials</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-wide text-zinc-400">Manager</p>
                        <input
                          value={detailForm.managerUsername}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, managerUsername: event.target.value }))}
                          className={inputClass}
                          placeholder="Username"
                        />
                        <input
                          value={detailForm.managerPassword}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, managerPassword: event.target.value }))}
                          className={inputClass}
                          placeholder="Password"
                        />
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-wide text-zinc-400">Chef</p>
                        <input
                          value={detailForm.chefUsername}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, chefUsername: event.target.value }))}
                          className={inputClass}
                          placeholder="Username"
                        />
                        <input
                          value={detailForm.chefPassword}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, chefPassword: event.target.value }))}
                          className={inputClass}
                          placeholder="Password"
                        />
                      </div>
                    </div>

                    {activeDetails?.credentials.legacyAdmin && (
                      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                        Legacy Restaurant Admin still exists for backward compatibility: {activeDetails.credentials.legacyAdmin.username} / {activeDetails.credentials.legacyAdmin.password}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                    <p className="text-sm font-semibold text-zinc-100 mb-3">Chatbot + Branding</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Chatbot Name</label>
                        <input
                          value={detailForm.chatbotName}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, chatbotName: event.target.value }))}
                          className={inputClass}
                          placeholder="SIA"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Logo URL</label>
                        <input
                          value={detailForm.logoUrl}
                          onChange={(event) => setDetailForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                          className={inputClass}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg border border-zinc-700 bg-zinc-950 p-1 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={detailForm.logoUrl || DEFAULT_LOGO_URL} alt="Tenant logo" className="max-h-full max-w-full rounded" />
                      </div>
                      <p className="text-xs text-zinc-500">This logo and chatbot name will be used by the tenant-facing UI.</p>
                    </div>
                  </section>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSaveTenantDetails}
                      disabled={savingDetails || Boolean(detailsLoadingId)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-zinc-950 font-semibold hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {savingDetails ? 'Saving...' : 'Save Updates'}
                    </button>
                    <button
                      onClick={() => openTenantDetails(activeRestaurant)}
                      disabled={Boolean(detailsLoadingId)}
                      className={`${subtleButtonClass} px-4 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Reload Details
                    </button>
                  </div>

                  <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
                    <p className="text-sm font-semibold text-rose-200 mb-2 inline-flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Delete Tenant
                    </p>
                    <p className="text-xs text-rose-200/80 mb-3">
                      Deleting will permanently remove this restaurant and all related tenant data. Use your passcode to confirm.
                    </p>
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-rose-200/80 mb-1">Delete passcode</label>
                        <input
                          type="password"
                          value={deletePasscode}
                          onChange={(event) => setDeletePasscode(event.target.value)}
                          className="w-full rounded-xl border border-rose-500/40 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20"
                          placeholder="Enter delete passcode"
                        />
                      </div>
                      <button
                        onClick={handleDeleteRestaurant}
                        disabled={deletingTenantId === activeRestaurant.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 mt-5 md:mt-6 text-white font-semibold hover:bg-rose-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <KeyRound className="w-4 h-4" />
                        {deletingTenantId === activeRestaurant.id ? 'Deleting...' : 'Delete Restaurant'}
                      </button>
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                    <p className="text-sm font-semibold text-zinc-100 mb-3 inline-flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-300" />
                      Credential QR
                    </p>

                    {activeDetails ? (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={buildQrImageUrl(buildTenantPrivateQrPayload(activeDetails), 260)}
                          alt={`Credential QR for ${activeRestaurant.name}`}
                          className="w-full rounded bg-white"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-500 text-center">
                        Load tenant details to generate credential QR.
                      </div>
                    )}

                    <p className="text-xs text-zinc-500 mt-3">Scan this QR to view encoded tenant info, credentials, and URLs.</p>
                  </section>

                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 text-sm">
                    <p className="font-semibold text-zinc-100 mb-2">Quick Access</p>
                    <div className="space-y-1 text-zinc-300">
                      <p>ID: {activeRestaurant.id}</p>
                      <p>Slug: {activeRestaurant.slug}</p>
                      <p>
                        Tenant URL:{' '}
                        <Link href={buildTenantUrls(activeRestaurant.slug, origin).base} className="underline hover:text-white">
                          {buildTenantUrls(activeRestaurant.slug, origin).base}
                        </Link>
                      </p>
                      <p>
                        Admin Login:{' '}
                        <Link href={buildTenantUrls(activeRestaurant.slug, origin).adminLogin} className="underline hover:text-white">
                          {buildTenantUrls(activeRestaurant.slug, origin).adminLogin}
                        </Link>
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
