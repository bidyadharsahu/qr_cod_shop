import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { resolveRestaurantIdentity } from '@/lib/payment-server';
import { getTenantIdFromRequest, getTenantSlugFromRequest } from '@/lib/tenant-server';

export async function GET(req: NextRequest) {
  const tenantId = getTenantIdFromRequest(req);
  const tenantSlug = getTenantSlugFromRequest(req);

  if (!tenantId) {
    return NextResponse.json({
      error: 'Tenant id is required via x-restaurant-id header or restaurantId query param.',
    }, { status: 400 });
  }

  const tenant = await resolveRestaurantIdentity(tenantId, tenantSlug);
  if (!tenant) {
    return NextResponse.json({
      error: tenantSlug ? 'Tenant id and slug do not match.' : 'Tenant not found.',
    }, { status: 404 });
  }

  const accountActive = tenant.status !== 'disabled';
  const onlineAllowedByPlan = tenant.plan !== 'basic';

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';

  const stripeEnabled = accountActive && onlineAllowedByPlan && stripeConfigured;
  const paypalEnabled = accountActive && onlineAllowedByPlan && paypalConfigured;

  return NextResponse.json({
    stripeConfigured: stripeEnabled,
    paypalConfigured: paypalEnabled,
    mode,
    anyProviderConfigured: stripeEnabled || paypalEnabled,
    accountActive,
    plan: tenant.plan,
    restaurantSlug: tenant.slug,
  });
}
