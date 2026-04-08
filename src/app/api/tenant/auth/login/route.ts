import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '@/lib/server-supabase';
import { normalizeTenantSlug } from '@/lib/tenant-server';

type StaffRole = 'manager' | 'chef';

interface TenantLoginBody {
  restaurantSlug?: string;
  username?: string;
  password?: string;
  role?: StaffRole | 'restaurant_admin';
}

const FALLBACK_STAFF_CREDENTIALS: Record<StaffRole, { username: string; password: string }> = {
  manager: { username: 'hello', password: '789456' },
  chef: { username: 'chef', password: 'chef123' },
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
  const role: StaffRole = body.role === 'chef' ? 'chef' : 'manager';

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

  const roleCandidates = role === 'manager' ? ['manager', 'restaurant_admin'] : ['chef'];

  const { data: staffMatch, error: staffError } = await supabase
    .from('restaurant_staff')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .in('role', roleCandidates)
    .eq('username', username)
    .eq('password', password)
    .eq('is_active', true)
    .maybeSingle();

  const fallbackCandidates = role === 'manager'
    ? [
      FALLBACK_STAFF_CREDENTIALS.manager,
      { username: 'admin', password: 'admin123' },
    ]
    : [FALLBACK_STAFF_CREDENTIALS.chef];

  const fallbackAllowed =
    Boolean(restaurant.is_default)
    && fallbackCandidates.some((credential) => (
      username === credential.username
      && password === credential.password
    ));

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
