import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getRestaurantSubscription } from '@/lib/payment-server';
import { resolveTenantIdFromRequest } from '@/lib/tenant-server';

export async function GET(req: NextRequest) {
  const tenantId = resolveTenantIdFromRequest(req);
  const subscription = await getRestaurantSubscription(tenantId);

  const accountActive = subscription ? subscription.status !== 'disabled' : false;
  const onlineAllowedByPlan = subscription ? subscription.plan !== 'basic' : false;

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
    plan: subscription?.plan || 'basic',
  });
}
