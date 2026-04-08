import { NextRequest, NextResponse } from 'next/server';
import { getPayPalAccessToken, logPaymentEvent, markOrderAsPaid, PAYPAL_BASE } from '@/lib/payment-server';
import { parseTenantId } from '@/lib/tenant-server';

export const runtime = 'nodejs';

interface PayPalWebhookEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
    purchase_units?: Array<{
      custom_id?: string;
    }>;
  };
}

interface TenantWebhookReference {
  orderId: number;
  restaurantId: number | null;
}

async function verifyPayPalWebhookSignature(req: NextRequest, event: PayPalWebhookEvent): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return false;

  const transmissionId = req.headers.get('paypal-transmission-id');
  const transmissionTime = req.headers.get('paypal-transmission-time');
  const transmissionSig = req.headers.get('paypal-transmission-sig');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });

  if (!verifyRes.ok) return false;

  const verifyData = await verifyRes.json() as { verification_status?: string };
  return verifyData.verification_status === 'SUCCESS';
}

function getTenantReferenceFromEvent(event: PayPalWebhookEvent): TenantWebhookReference {
  const customIdRaw = event.resource?.custom_id
    || event.resource?.purchase_units?.[0]?.custom_id
    || '';

  const normalized = String(customIdRaw || '').trim();
  if (normalized) {
    const [orderPart, restaurantPart] = normalized.split(':', 2);
    const orderId = Number(orderPart);
    const restaurantId = parseTenantId(restaurantPart);

    if (Number.isFinite(orderId) && orderId > 0) {
      return {
        orderId: Math.trunc(orderId),
        restaurantId,
      };
    }
  }

  const fallbackRaw = event.resource?.supplementary_data?.related_ids?.order_id || '';
  const fallbackOrderId = Number(fallbackRaw);
  if (Number.isFinite(fallbackOrderId) && fallbackOrderId > 0) {
    return {
      orderId: Math.trunc(fallbackOrderId),
      restaurantId: null,
    };
  }

  return {
    orderId: 0,
    restaurantId: null,
  };
}

export async function POST(req: NextRequest) {
  let event: PayPalWebhookEvent;
  try {
    event = await req.json() as PayPalWebhookEvent;
  } catch {
    await logPaymentEvent({
      provider: 'paypal',
      eventType: 'webhook_invalid_payload',
      status: 'failed',
      source: 'paypal-webhook',
    });
    return NextResponse.json({ received: false, error: 'Invalid payload.' }, { status: 400 });
  }

  const signatureValid = await verifyPayPalWebhookSignature(req, event);
  if (!signatureValid) {
    await logPaymentEvent({
      provider: 'paypal',
      eventType: 'webhook_signature_invalid',
      status: 'failed',
      source: 'paypal-webhook',
      rawPayload: event,
    });
    return NextResponse.json({ received: false, error: 'Invalid PayPal webhook signature.' }, { status: 400 });
  }

  const eventType = event.event_type || '';
  const tenantRef = getTenantReferenceFromEvent(event);
  const orderId = tenantRef.orderId;
  const restaurantId = tenantRef.restaurantId;

  await logPaymentEvent({
    restaurantId: restaurantId || undefined,
    orderId: orderId || undefined,
    provider: 'paypal',
    eventType,
    status: 'received',
    transactionId: event.resource?.id || event.id,
    source: 'paypal-webhook',
    rawPayload: event,
  });

  if (!['PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.COMPLETED'].includes(eventType)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  if (!orderId) {
    await logPaymentEvent({
      restaurantId: restaurantId || undefined,
      provider: 'paypal',
      eventType: 'webhook_missing_order_id',
      status: 'skipped',
      transactionId: event.resource?.id || event.id,
      source: 'paypal-webhook',
      rawPayload: event,
    });
    return NextResponse.json({ received: true, skipped: true, reason: 'No order id metadata' });
  }

  const transactionId = event.resource?.id || event.id || `paypal-${Date.now()}`;
  const success = await markOrderAsPaid(orderId, 'online', 'chatbot_payment', transactionId, 'paypal-webhook', restaurantId || undefined);

  await logPaymentEvent({
    restaurantId: restaurantId || undefined,
    orderId,
    provider: 'paypal',
    eventType: 'webhook_processed',
    status: success ? 'success' : 'failed',
    transactionId,
    source: 'paypal-webhook',
  });

  return NextResponse.json({ received: true, success });
}
