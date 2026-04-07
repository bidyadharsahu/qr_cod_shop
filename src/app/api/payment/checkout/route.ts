import { NextRequest, NextResponse } from 'next/server';
import { getPayPalAccessToken, getRestaurantSubscription, getTenantOrder, logPaymentEvent, PAYPAL_BASE } from '@/lib/payment-server';
import { resolveTenantIdFromRequest } from '@/lib/tenant-server';

type PaymentProvider = 'card' | 'paypal';

interface CheckoutRequest {
  provider: PaymentProvider;
  orderId: number;
  receiptId: string;
  amount: number;
  tableNumber: string;
  restaurantId?: number;
}

function getBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
}

async function createStripeCheckout(req: NextRequest, body: CheckoutRequest, restaurantId: number): Promise<NextResponse> {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    await logPaymentEvent({
      restaurantId,
      orderId: body.orderId,
      receiptId: body.receiptId,
      provider: 'stripe',
      eventType: 'checkout_unavailable',
      status: 'failed',
      amount: body.amount,
      source: 'checkout-route',
    });
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const baseUrl = getBaseUrl(req);
  const amountCents = Math.max(50, Math.round(body.amount * 100));

  const payload = new URLSearchParams();
  payload.append('mode', 'payment');
  payload.append('success_url', `${baseUrl}/order?table=${encodeURIComponent(body.tableNumber)}&restaurant=${restaurantId}&payment=success&provider=stripe&session_id={CHECKOUT_SESSION_ID}&order=${body.orderId}`);
  payload.append('cancel_url', `${baseUrl}/order?table=${encodeURIComponent(body.tableNumber)}&restaurant=${restaurantId}&payment=cancel&provider=stripe&order=${body.orderId}`);
  payload.append('line_items[0][quantity]', '1');
  payload.append('line_items[0][price_data][currency]', 'usd');
  payload.append('line_items[0][price_data][product_data][name]', `Order ${body.receiptId}`);
  payload.append('line_items[0][price_data][unit_amount]', amountCents.toString());
  payload.append('metadata[order_id]', body.orderId.toString());
  payload.append('metadata[receipt_id]', body.receiptId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    await logPaymentEvent({
      restaurantId,
      orderId: body.orderId,
      receiptId: body.receiptId,
      provider: 'stripe',
      eventType: 'checkout_create_failed',
      status: 'failed',
      amount: body.amount,
      source: 'checkout-route',
      rawPayload: errText,
    });
    return NextResponse.json({ error: `Stripe checkout failed: ${errText}` }, { status: 502 });
  }

  const data = await response.json() as { url?: string; id?: string };
  if (!data.url) {
    await logPaymentEvent({
      restaurantId,
      orderId: body.orderId,
      receiptId: body.receiptId,
      provider: 'stripe',
      eventType: 'checkout_create_failed_missing_url',
      status: 'failed',
      amount: body.amount,
      source: 'checkout-route',
      rawPayload: data,
    });
    return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
  }

  await logPaymentEvent({
    restaurantId,
    orderId: body.orderId,
    receiptId: body.receiptId,
    provider: 'stripe',
    eventType: 'checkout_session_created',
    status: 'success',
    amount: body.amount,
    transactionId: data.id,
    source: 'checkout-route',
  });

  return NextResponse.json({ url: data.url, provider: 'stripe' });
}

async function createPayPalCheckout(req: NextRequest, body: CheckoutRequest, restaurantId: number): Promise<NextResponse> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) {
    await logPaymentEvent({
      restaurantId,
      orderId: body.orderId,
      receiptId: body.receiptId,
      provider: 'paypal',
      eventType: 'checkout_unavailable',
      status: 'failed',
      amount: body.amount,
      source: 'checkout-route',
    });
    return NextResponse.json({ error: 'PayPal is not configured.' }, { status: 503 });
  }

  const baseUrl = getBaseUrl(req);
  const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: body.receiptId,
          custom_id: String(body.orderId),
          amount: {
            currency_code: 'USD',
            value: body.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${baseUrl}/order?table=${encodeURIComponent(body.tableNumber)}&restaurant=${restaurantId}&payment=success&provider=paypal&order=${body.orderId}`,
        cancel_url: `${baseUrl}/order?table=${encodeURIComponent(body.tableNumber)}&restaurant=${restaurantId}&payment=cancel&provider=paypal&order=${body.orderId}`,
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text();
    await logPaymentEvent({
      restaurantId,
      orderId: body.orderId,
      receiptId: body.receiptId,
      provider: 'paypal',
      eventType: 'checkout_create_failed',
      status: 'failed',
      amount: body.amount,
      source: 'checkout-route',
      rawPayload: errText,
    });
    return NextResponse.json({ error: `PayPal checkout failed: ${errText}` }, { status: 502 });
  }

  const orderData = await orderRes.json() as { id?: string; links?: Array<{ rel: string; href: string }> };
  const approvalLink = orderData.links?.find(link => link.rel === 'approve')?.href;

  if (!approvalLink) {
    await logPaymentEvent({
      restaurantId,
      orderId: body.orderId,
      receiptId: body.receiptId,
      provider: 'paypal',
      eventType: 'checkout_create_failed_missing_url',
      status: 'failed',
      amount: body.amount,
      source: 'checkout-route',
      rawPayload: orderData,
    });
    return NextResponse.json({ error: 'PayPal did not return approval URL.' }, { status: 502 });
  }

  await logPaymentEvent({
    restaurantId,
    orderId: body.orderId,
    receiptId: body.receiptId,
    provider: 'paypal',
    eventType: 'checkout_session_created',
    status: 'success',
    amount: body.amount,
    transactionId: orderData.id,
    source: 'checkout-route',
  });

  return NextResponse.json({ url: approvalLink, provider: 'paypal' });
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const body = await req.json() as CheckoutRequest;

    if (!body || !body.provider || !body.orderId || !body.receiptId || !body.tableNumber) {
      return NextResponse.json({ error: 'Missing required checkout fields.' }, { status: 400 });
    }

    if (body.restaurantId && body.restaurantId !== tenantId) {
      return NextResponse.json({ error: 'Tenant mismatch in checkout request.' }, { status: 400 });
    }

    if (body.amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
    }

    const subscription = await getRestaurantSubscription(tenantId);
    if (!subscription) {
      return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
    }

    if (subscription?.status === 'disabled') {
      return NextResponse.json({ error: 'Restaurant account is disabled.' }, { status: 403 });
    }

    if (subscription?.plan === 'basic') {
      return NextResponse.json({ error: 'Online payment is available on premium plan only.' }, { status: 403 });
    }

    const order = await getTenantOrder(body.orderId, tenantId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found for this restaurant.' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Order is already paid.' }, { status: 409 });
    }

    const canonicalBody: CheckoutRequest = {
      ...body,
      restaurantId: tenantId,
      receiptId: order.receipt_id,
      tableNumber: String(order.table_number),
      amount: Number(order.total),
    };

    if (body.provider === 'card') {
      return createStripeCheckout(req, canonicalBody, tenantId);
    }

    if (body.provider === 'paypal') {
      return createPayPalCheckout(req, canonicalBody, tenantId);
    }

    return NextResponse.json({ error: 'Unsupported payment provider.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Unable to create checkout session.' }, { status: 500 });
  }
}
