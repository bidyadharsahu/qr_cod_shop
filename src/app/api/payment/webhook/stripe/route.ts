import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logPaymentEvent, markOrderAsPaid } from '@/lib/payment-server';

export const runtime = 'nodejs';

interface StripeEvent {
  type?: string;
  data?: {
    object?: {
      id?: string;
      payment_intent?: string;
      payment_status?: string;
      metadata?: {
        order_id?: string;
      };
      client_reference_id?: string;
    };
  };
}

function safeCompareHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;

  const parts = header.split(',').reduce<Record<string, string[]>>((acc, segment) => {
    const [key, value] = segment.split('=');
    if (!key || !value) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(value);
    return acc;
  }, {});

  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return signatures.some(sig => safeCompareHex(expected, sig));
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    await logPaymentEvent({
      provider: 'stripe',
      eventType: 'webhook_unavailable',
      status: 'failed',
      source: 'stripe-webhook',
    });
    return NextResponse.json({ received: false, error: 'Missing STRIPE_WEBHOOK_SECRET.' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  if (!verifyStripeSignature(rawBody, signature, secret)) {
    await logPaymentEvent({
      provider: 'stripe',
      eventType: 'webhook_signature_invalid',
      status: 'failed',
      source: 'stripe-webhook',
    });
    return NextResponse.json({ received: false, error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ received: false, error: 'Invalid payload.' }, { status: 400 });
  }

  const eventType = event.type || '';
  const session = event.data?.object;
  const orderIdRaw = session?.metadata?.order_id || session?.client_reference_id;
  const orderId = Number(orderIdRaw || 0);

  await logPaymentEvent({
    orderId: Number.isFinite(orderId) && orderId > 0 ? orderId : undefined,
    provider: 'stripe',
    eventType,
    status: 'received',
    transactionId: session?.id,
    source: 'stripe-webhook',
    rawPayload: event,
  });

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(eventType)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  if (!Number.isFinite(orderId) || orderId <= 0) {
    await logPaymentEvent({
      provider: 'stripe',
      eventType: 'webhook_missing_order_id',
      status: 'skipped',
      transactionId: session?.id,
      source: 'stripe-webhook',
      rawPayload: event,
    });
    return NextResponse.json({ received: true, skipped: true, reason: 'No order id metadata' });
  }

  if (session?.payment_status && session.payment_status !== 'paid') {
    await logPaymentEvent({
      orderId,
      provider: 'stripe',
      eventType: 'webhook_payment_not_settled',
      status: 'skipped',
      transactionId: session.id,
      source: 'stripe-webhook',
      rawPayload: event,
    });
    return NextResponse.json({ received: true, skipped: true, reason: 'Payment not settled' });
  }

  const transactionId = session?.payment_intent || session?.id || `stripe-${Date.now()}`;
  const success = await markOrderAsPaid(orderId, 'card', 'chatbot_payment', transactionId, 'stripe-webhook');

  await logPaymentEvent({
    orderId,
    provider: 'stripe',
    eventType: 'webhook_processed',
    status: success ? 'success' : 'failed',
    transactionId,
    source: 'stripe-webhook',
  });

  return NextResponse.json({ received: true, success });
}
