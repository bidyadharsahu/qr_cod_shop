import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '@/lib/server-supabase';
import { normalizeTenantSlug } from '@/lib/tenant-server';

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

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, slug, name, plan, status')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
  }

  return NextResponse.json({
    restaurant: data,
    urls: buildTenantUrls(req.nextUrl.origin, data.slug || slug),
  });
}
