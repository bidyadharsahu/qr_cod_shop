import { NextRequest, NextResponse } from 'next/server';
import { getPayPalAccessToken, logPaymentEvent, markOrderAsPaid, PAYPAL_BASE } from '@/lib/payment-server';

async function verifyStripePayment(orderId: number, sessionId: string): Promise<boolean> {
  await logPaymentEvent({
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
    orderId,
    provider: 'stripe',
    eventType: 'verify_paid_confirmed',
    status: 'success',
    transactionId: sessionId,
    source: 'verify-route',
  });

  return markOrderAsPaid(orderId, 'card', 'chatbot_payment', sessionId, 'verify-route');
}

async function verifyPayPalPayment(orderId: number, token: string): Promise<boolean> {
  await logPaymentEvent({
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
    orderId,
    provider: 'paypal',
    eventType: 'verify_paid_confirmed',
    status: 'success',
    transactionId: captureData.id || token,
    source: 'verify-route',
  });

  return markOrderAsPaid(orderId, 'online', 'chatbot_payment', captureData.id || token, 'verify-route');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      provider?: 'stripe' | 'paypal';
      orderId?: number;
      sessionId?: string;
      paypalToken?: string;
    };

    if (!body.provider || !body.orderId) {
      return NextResponse.json({ success: false, error: 'Missing verification fields.' }, { status: 400 });
    }

    if (body.provider === 'stripe') {
      if (!body.sessionId) {
        return NextResponse.json({ success: false, error: 'Missing Stripe session id.' }, { status: 400 });
      }
      const success = await verifyStripePayment(body.orderId, body.sessionId);
      return NextResponse.json({ success });
    }

    if (body.provider === 'paypal') {
      if (!body.paypalToken) {
        return NextResponse.json({ success: false, error: 'Missing PayPal token.' }, { status: 400 });
      }
      const success = await verifyPayPalPayment(body.orderId, body.paypalToken);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ success: false, error: 'Unsupported provider.' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: 'Verification failed.' }, { status: 500 });
  }
}
