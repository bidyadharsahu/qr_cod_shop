import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '@/lib/server-supabase';
import { normalizeTenantSlug } from '@/lib/tenant-server';

const DEFAULT_RESTAURANT_SLUG = 'coasis';
const LEGACY_DEFAULT_RESTAURANT_SLUG = 'default';

function buildTenantUrls(origin: string, slug: string) {
  const tenantBase = `${origin}/t/${slug}`;
  return {
    base: tenantBase,
    order: `${tenantBase}/order`,
    adminLogin: `${tenantBase}/admin/login`,
    adminDashboard: `${tenantBase}/admin`,
  };
}

export async function GET(req: NextRequest) {
  const slugRaw = req.nextUrl.searchParams.get('slug') || req.nextUrl.searchParams.get('restaurantSlug') || '';
  const slug = normalizeTenantSlug(slugRaw);

  if (!slug) {
    return NextResponse.json({ error: 'Tenant slug is required.' }, { status: 400 });
  }

  const supabase = getServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for tenant resolve API.',
    }, { status: 503 });
  }

  const slugCandidates = slug === DEFAULT_RESTAURANT_SLUG
    ? [DEFAULT_RESTAURANT_SLUG, LEGACY_DEFAULT_RESTAURANT_SLUG]
    : slug === LEGACY_DEFAULT_RESTAURANT_SLUG
      ? [LEGACY_DEFAULT_RESTAURANT_SLUG, DEFAULT_RESTAURANT_SLUG]
      : [slug];

  const { data: rows, error } = await supabase
    .from('restaurants')
    .select('id, slug, name, plan, status, is_default')
    .in('slug', slugCandidates)
    .order('is_default', { ascending: false })
    .order('id', { ascending: true })
    .limit(2);

  const data = (rows || []).find((row) => row.slug === slug)
    || (rows || [])[0]
    || null;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
  }

  const canonicalSlug = data.is_default ? DEFAULT_RESTAURANT_SLUG : (data.slug || slug);

  return NextResponse.json({
    restaurant: {
      ...data,
      slug: canonicalSlug,
    },
    urls: buildTenantUrls(req.nextUrl.origin, canonicalSlug),
  });
}
