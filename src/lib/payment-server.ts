import { createClient } from '@supabase/supabase-js';
import { normalizeTenantSlug } from '@/lib/tenant-server';

export const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const DEFAULT_RESTAURANT_SLUG = 'coasis';
const LEGACY_DEFAULT_RESTAURANT_SLUG = 'default';

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

interface RestaurantIdentityRow {
  id: number;
  slug: string;
  plan: string | null;
  status: string | null;
  is_default: boolean | null;
}

export interface ResolvedRestaurantIdentity {
  id: number;
  slug: string;
  plan: 'basic' | 'premium';
  status: 'active' | 'disabled';
  isDefault: boolean;
}

const normalizeTenantAliasSlug = (value: string): string => {
  return normalizeTenantSlug(value || '');
};

function isDefaultSlug(slug: string): boolean {
  return slug === DEFAULT_RESTAURANT_SLUG || slug === LEGACY_DEFAULT_RESTAURANT_SLUG;
}

export async function resolveRestaurantIdentity(
  restaurantId: number,
  tenantSlug?: string | null,
): Promise<ResolvedRestaurantIdentity | null> {
  if (!Number.isFinite(restaurantId) || restaurantId <= 0) {
    return null;
  }

  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('restaurants')
    .select('id, slug, plan, status, is_default')
    .eq('id', Math.trunc(restaurantId))
    .maybeSingle();

  if (!data) return null;

  const row = data as RestaurantIdentityRow;
  const isDefault = Boolean(row.is_default);
  const canonicalDbSlug = normalizeTenantAliasSlug(row.slug || '');
  const canonicalSlug = isDefault ? DEFAULT_RESTAURANT_SLUG : canonicalDbSlug;

  if (!canonicalSlug) {
    return null;
  }

  const requestedSlug = normalizeTenantAliasSlug(tenantSlug || '');
  if (requestedSlug) {
    const slugMatches = isDefault
      ? isDefaultSlug(requestedSlug) && isDefaultSlug(canonicalSlug)
      : requestedSlug === canonicalSlug;

    if (!slugMatches) {
      return null;
    }
  }

  return {
    id: row.id,
    slug: canonicalSlug,
    plan: row.plan === 'premium' ? 'premium' : 'basic',
    status: row.status === 'disabled' ? 'disabled' : 'active',
    isDefault,
  };
}

export interface TenantOrderSnapshot {
  id: number;
  restaurant_id: number;
  receipt_id: string;
  table_number: number;
  total: number;
  status: string;
  payment_status: string;
}

export async function getTenantOrder(orderId: number, restaurantId: number): Promise<TenantOrderSnapshot | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('orders')
    .select('id, restaurant_id, receipt_id, table_number, total, status, payment_status')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  return (data as TenantOrderSnapshot | null) ?? null;
}

export async function getRestaurantSubscription(restaurantId: number): Promise<{ plan: 'basic' | 'premium'; status: 'active' | 'disabled' } | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('restaurants')
    .select('plan, status')
    .eq('id', restaurantId)
    .maybeSingle();

  if (!data) return null;

  const plan = data.plan === 'premium' ? 'premium' : 'basic';
  const status = data.status === 'disabled' ? 'disabled' : 'active';
  return { plan, status };
}

export interface PaymentAuditLogInput {
  restaurantId?: number;
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

async function resolveRestaurantIdForOrder(orderId: number): Promise<number | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('orders')
    .select('restaurant_id')
    .eq('id', orderId)
    .maybeSingle();

  const candidate = (data as { restaurant_id?: number } | null)?.restaurant_id;
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
    ? Math.trunc(candidate)
    : null;
}

export async function logPaymentEvent(input: PaymentAuditLogInput): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  const resolvedRestaurantId = input.restaurantId
    || (input.orderId ? await resolveRestaurantIdForOrder(input.orderId) : null);

  if (!resolvedRestaurantId) {
    return;
  }

  const payload = {
    restaurant_id: resolvedRestaurantId,
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
  source: 'verify-route' | 'stripe-webhook' | 'paypal-webhook',
  restaurantId?: number,
): Promise<boolean> {
  const supabase = getServerSupabase();
  if (!supabase) return false;

  let existingOrderQuery = supabase
    .from('orders')
    .select('id, restaurant_id, table_number, payment_status, receipt_id, total')
    .eq('id', orderId);

  if (restaurantId) {
    existingOrderQuery = existingOrderQuery.eq('restaurant_id', restaurantId);
  }

  const { data: existingOrder, error: existingError } = await existingOrderQuery.maybeSingle();

  const resolvedRestaurantId = (existingOrder as { restaurant_id?: number } | null)?.restaurant_id || restaurantId || null;

  if (existingError || !existingOrder) {
    await logPaymentEvent({
      restaurantId: resolvedRestaurantId || undefined,
      orderId,
      provider: paymentMethod === 'card' ? 'stripe' : 'paypal',
      eventType: 'payment_mark_failed_order_lookup',
      status: 'failed',
      transactionId,
      source,
    });
    return false;
  }

  if (!resolvedRestaurantId) {
    return false;
  }

  if (existingOrder.payment_status === 'paid') {
    await logPaymentEvent({
      restaurantId: resolvedRestaurantId,
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
    .eq('id', orderId)
    .eq('restaurant_id', resolvedRestaurantId);

  if (orderError) {
    await logPaymentEvent({
      restaurantId: resolvedRestaurantId,
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
      .eq('table_number', existingOrder.table_number)
      .eq('restaurant_id', resolvedRestaurantId);
  }

  await logPaymentEvent({
    restaurantId: resolvedRestaurantId,
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
