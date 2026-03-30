import { createClient } from '@supabase/supabase-js';

export const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!serviceRole && !anon)) return null;

  return createClient(
    supabaseUrl,
    serviceRole || anon || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface PaymentAuditLogInput {
  orderId?: number;
  receiptId?: string;
  provider?: 'stripe' | 'paypal' | 'system';
  eventType: string;
  status: 'received' | 'success' | 'failed' | 'skipped';
  amount?: number;
  currency?: string;
  transactionId?: string;
  source: string;
  rawPayload?: unknown;
}

export async function logPaymentEvent(input: PaymentAuditLogInput): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  const payload = {
    order_id: input.orderId ?? null,
    receipt_id: input.receiptId ?? null,
    provider: input.provider ?? 'system',
    event_type: input.eventType,
    status: input.status,
    amount: typeof input.amount === 'number' ? Number(input.amount.toFixed(2)) : null,
    currency: input.currency || 'USD',
    transaction_id: input.transactionId ?? null,
    source: input.source,
    event_time: new Date().toISOString(),
    raw_payload: input.rawPayload ?? null,
  };

  await supabase.from('payment_event_audit').insert(payload);
}

export async function markOrderAsPaid(
  orderId: number,
  paymentMethod: 'card' | 'online',
  paymentType: 'chatbot_payment' | 'direct_cash',
  transactionId: string,
  source: 'verify-route' | 'stripe-webhook' | 'paypal-webhook'
): Promise<boolean> {
  const supabase = getServerSupabase();
  if (!supabase) return false;

  const { data: existingOrder, error: existingError } = await supabase
    .from('orders')
    .select('id, table_number, payment_status, receipt_id, total')
    .eq('id', orderId)
    .single();

  if (existingError || !existingOrder) {
    await logPaymentEvent({
      orderId,
      provider: paymentMethod === 'card' ? 'stripe' : 'paypal',
      eventType: 'payment_mark_failed_order_lookup',
      status: 'failed',
      transactionId,
      source,
    });
    return false;
  }

  if (existingOrder.payment_status === 'paid') {
    await logPaymentEvent({
      orderId,
      receiptId: existingOrder.receipt_id,
      provider: paymentMethod === 'card' ? 'stripe' : 'paypal',
      eventType: 'payment_duplicate_confirmation',
      status: 'skipped',
      amount: existingOrder.total,
      transactionId,
      source,
    });
    return true;
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      payment_status: 'paid',
      payment_method: paymentMethod,
      payment_type: paymentType,
      transaction_id: transactionId,
      customer_note: `${source} | payment confirmed`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (orderError) {
    await logPaymentEvent({
      orderId,
      receiptId: existingOrder.receipt_id,
      provider: paymentMethod === 'card' ? 'stripe' : 'paypal',
      eventType: 'payment_mark_update_failed',
      status: 'failed',
      amount: existingOrder.total,
      transactionId,
      source,
      rawPayload: orderError,
    });
    return false;
  }

  if (existingOrder.table_number) {
    await supabase
      .from('restaurant_tables')
      .update({ status: 'available', current_order_id: null })
      .eq('table_number', existingOrder.table_number);
  }

  await logPaymentEvent({
    orderId,
    receiptId: existingOrder.receipt_id,
    provider: paymentMethod === 'card' ? 'stripe' : 'paypal',
    eventType: 'payment_marked_paid',
    status: 'success',
    amount: existingOrder.total,
    transactionId,
    source,
  });

  return true;
}

export async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) return null;

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) return null;

  const tokenData = await tokenRes.json() as { access_token?: string };
  return tokenData.access_token || null;
}
