import { NextRequest, NextResponse } from 'next/server';
import { getPayPalAccessToken, logPaymentEvent, markOrderAsPaid, PAYPAL_BASE, resolveRestaurantIdentity } from '@/lib/payment-server';
import { getTenantIdFromRequest, getTenantSlugFromRequest, normalizeTenantSlug, parseTenantId } from '@/lib/tenant-server';

const DEFAULT_RESTAURANT_SLUG = 'coasis';
const LEGACY_DEFAULT_RESTAURANT_SLUG = 'default';

function tenantSlugsMatch(left: string, right: string): boolean {
  if (left === right) return true;

  const leftIsDefault = left === DEFAULT_RESTAURANT_SLUG || left === LEGACY_DEFAULT_RESTAURANT_SLUG;
  const rightIsDefault = right === DEFAULT_RESTAURANT_SLUG || right === LEGACY_DEFAULT_RESTAURANT_SLUG;

  return leftIsDefault && rightIsDefault;
}

async function verifyStripePayment(orderId: number, sessionId: string, restaurantId: number): Promise<boolean> {
  await logPaymentEvent({
    restaurantId,
    orderId,
    provider: 'stripe',
    eventType: 'verify_requested',
    status: 'received',
    transactionId: sessionId,
    source: 'verify-route',
  });

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    await logPaymentEvent({
      restaurantId,
      orderId,
      provider: 'stripe',
      eventType: 'verify_unavailable',
      status: 'failed',
      transactionId: sessionId,
      source: 'verify-route',
    });
    return false;
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeSecret}` },
  });

  if (!response.ok) {
    await logPaymentEvent({
      restaurantId,
      orderId,
      provider: 'stripe',
      eventType: 'verify_api_failed',
      status: 'failed',
      transactionId: sessionId,
      source: 'verify-route',
    });
    return false;
  }

  const data = await response.json() as { payment_status?: string };
  if (data.payment_status !== 'paid') {
    await logPaymentEvent({
      restaurantId,
      orderId,
      provider: 'stripe',
      eventType: 'verify_not_paid',
      status: 'failed',
      transactionId: sessionId,
      source: 'verify-route',
      rawPayload: data,
    });
    return false;
  }

  await logPaymentEvent({
    restaurantId,
    orderId,
    provider: 'stripe',
    eventType: 'verify_paid_confirmed',
    status: 'success',
    transactionId: sessionId,
    source: 'verify-route',
  });

  return markOrderAsPaid(orderId, 'card', 'chatbot_payment', sessionId, 'verify-route', restaurantId);
}

async function verifyPayPalPayment(orderId: number, token: string, restaurantId: number): Promise<boolean> {
  await logPaymentEvent({
    restaurantId,
    orderId,
    provider: 'paypal',
    eventType: 'verify_requested',
    status: 'received',
    transactionId: token,
    source: 'verify-route',
  });

  const accessToken = await getPayPalAccessToken();
  if (!accessToken) {
    await logPaymentEvent({
      restaurantId,
      orderId,
      provider: 'paypal',
      eventType: 'verify_unavailable',
      status: 'failed',
      transactionId: token,
      source: 'verify-route',
    });
    return false;
  }

  const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(token)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!captureRes.ok) {
    await logPaymentEvent({
      restaurantId,
      orderId,
      provider: 'paypal',
      eventType: 'verify_api_failed',
      status: 'failed',
      transactionId: token,
      source: 'verify-route',
    });
    return false;
  }

  const captureData = await captureRes.json() as {
    status?: string;
    id?: string;
  };

  if (captureData.status !== 'COMPLETED') {
    await logPaymentEvent({
      restaurantId,
      orderId,
      provider: 'paypal',
      eventType: 'verify_not_paid',
      status: 'failed',
      transactionId: captureData.id || token,
      source: 'verify-route',
      rawPayload: captureData,
    });
    return false;
  }

  await logPaymentEvent({
    restaurantId,
    orderId,
    provider: 'paypal',
    eventType: 'verify_paid_confirmed',
    status: 'success',
    transactionId: captureData.id || token,
    source: 'verify-route',
  });

  return markOrderAsPaid(orderId, 'online', 'chatbot_payment', captureData.id || token, 'verify-route', restaurantId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      provider?: 'stripe' | 'paypal';
      orderId?: number;
      restaurantId?: number;
      restaurantSlug?: string;
      sessionId?: string;
      paypalToken?: string;
    };

    const headerTenantId = getTenantIdFromRequest(req);
    const bodyTenantId = parseTenantId(body?.restaurantId);
    const headerTenantSlug = getTenantSlugFromRequest(req);
    const bodyTenantSlug = normalizeTenantSlug(body?.restaurantSlug || '');
    const tenantId = headerTenantId || bodyTenantId;
    const tenantSlug = headerTenantSlug || bodyTenantSlug || null;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant id is required for verification.' }, { status: 400 });
    }

    if (headerTenantId && bodyTenantId && headerTenantId !== bodyTenantId) {
      return NextResponse.json({ success: false, error: 'Tenant mismatch between header and request body.' }, { status: 400 });
    }

    if (headerTenantSlug && bodyTenantSlug && !tenantSlugsMatch(headerTenantSlug, bodyTenantSlug)) {
      return NextResponse.json({ success: false, error: 'Tenant slug mismatch between header and request body.' }, { status: 400 });
    }

    if (!body.provider || !body.orderId) {
      return NextResponse.json({ success: false, error: 'Missing verification fields.' }, { status: 400 });
    }

    if (body.restaurantId && body.restaurantId !== tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant mismatch in verification request.' }, { status: 400 });
    }

    const tenant = await resolveRestaurantIdentity(tenantId, tenantSlug);
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found or slug does not match.' }, { status: 404 });
    }

    if (tenant.status === 'disabled') {
      return NextResponse.json({ success: false, error: 'Restaurant account is disabled.' }, { status: 403 });
    }

    if (body.provider === 'stripe') {
      if (!body.sessionId) {
        return NextResponse.json({ success: false, error: 'Missing Stripe session id.' }, { status: 400 });
      }
      const success = await verifyStripePayment(body.orderId, body.sessionId, tenant.id);
      return NextResponse.json({ success });
    }

    if (body.provider === 'paypal') {
      if (!body.paypalToken) {
        return NextResponse.json({ success: false, error: 'Missing PayPal token.' }, { status: 400 });
      }
      const success = await verifyPayPalPayment(body.orderId, body.paypalToken, tenant.id);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ success: false, error: 'Unsupported provider.' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: 'Verification failed.' }, { status: 500 });
  }
}
