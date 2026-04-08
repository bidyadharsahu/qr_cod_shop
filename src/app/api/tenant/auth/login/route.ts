import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '@/lib/server-supabase';
import { normalizeTenantSlug } from '@/lib/tenant-server';

type StaffRole = 'manager' | 'chef' | 'restaurant_admin';

interface TenantLoginBody {
  restaurantSlug?: string;
  username?: string;
  password?: string;
  role?: StaffRole;
}

const FALLBACK_STAFF_CREDENTIALS: Record<StaffRole, { username: string; password: string }> = {
  manager: { username: 'hello', password: '789456' },
  chef: { username: 'chef', password: 'chef123' },
  restaurant_admin: { username: 'admin', password: 'admin123' },
};

const DEFAULT_RESTAURANT_SLUG = 'coasis';
const LEGACY_DEFAULT_RESTAURANT_SLUG = 'default';

export async function POST(req: NextRequest) {
  const supabase = getServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for tenant auth APIs.',
    }, { status: 503 });
  }

  let body: TenantLoginBody;
  try {
    body = await req.json() as TenantLoginBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const restaurantSlug = normalizeTenantSlug(body.restaurantSlug || '');
  const username = (body.username || '').trim();
  const password = body.password || '';
  const role: StaffRole = body.role === 'chef' || body.role === 'restaurant_admin' ? body.role : 'manager';

  if (!restaurantSlug || !username || !password) {
    return NextResponse.json({ error: 'Restaurant slug, username, and password are required.' }, { status: 400 });
  }

  const slugCandidates = restaurantSlug === DEFAULT_RESTAURANT_SLUG
    ? [DEFAULT_RESTAURANT_SLUG, LEGACY_DEFAULT_RESTAURANT_SLUG]
    : restaurantSlug === LEGACY_DEFAULT_RESTAURANT_SLUG
      ? [LEGACY_DEFAULT_RESTAURANT_SLUG, DEFAULT_RESTAURANT_SLUG]
      : [restaurantSlug];

  const { data: restaurantRows, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, slug, name, plan, status, is_default')
    .in('slug', slugCandidates)
    .order('is_default', { ascending: false })
    .order('id', { ascending: true })
    .limit(2);

  const restaurant = (restaurantRows || []).find((row) => row.slug === restaurantSlug)
    || (restaurantRows || [])[0]
    || null;

  if (restaurantError) {
    return NextResponse.json({ error: restaurantError.message }, { status: 500 });
  }

  if (!restaurant) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  if (restaurant.status !== 'active') {
    return NextResponse.json({ error: 'Restaurant account is disabled. Contact support.' }, { status: 403 });
  }

  const { data: staffMatch, error: staffError } = await supabase
    .from('restaurant_staff')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('role', role)
    .eq('username', username)
    .eq('password', password)
    .eq('is_active', true)
    .maybeSingle();

  const fallback = FALLBACK_STAFF_CREDENTIALS[role];
  const fallbackAllowed =
    Boolean(restaurant.is_default)
    && username === fallback.username
    && password === fallback.password;

  const isAuthenticated = Boolean(staffMatch) || (!staffError && fallbackAllowed) || (staffError && fallbackAllowed);

  if (!isAuthenticated) {
    return NextResponse.json({ error: `Invalid ${role} credentials for ${restaurant.name}` }, { status: 401 });
  }

  const canonicalSlug = restaurant.is_default ? DEFAULT_RESTAURANT_SLUG : restaurant.slug;

  return NextResponse.json({
    authenticated: true,
    staffRole: role,
    staffUser: username,
    restaurant: {
      id: restaurant.id,
      slug: canonicalSlug,
      name: restaurant.name,
      plan: restaurant.plan === 'premium' ? 'premium' : 'basic',
      status: restaurant.status === 'disabled' ? 'disabled' : 'active',
    },
  });
}
