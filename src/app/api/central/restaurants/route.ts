import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Restaurant } from '@/lib/types';
import { normalizeRestaurantSlug } from '@/lib/tenant';
import { readCentralAdminSession } from '@/lib/central-auth';
import { getServiceRoleSupabase } from '@/lib/server-supabase';

interface RestaurantOrderRow {
  restaurant_id: number;
  payment_status: 'paid' | 'unpaid';
  total: number;
}

interface RestaurantTableRow {
  restaurant_id: number;
  status: 'available' | 'booked' | 'occupied';
}

interface TenantMetrics {
  orders: number;
  paidOrders: number;
  revenue: number;
  totalTables: number;
  activeTables: number;
}

interface SchemaHealthCheck {
  key: string;
  status: 'ok' | 'missing';
  message: string;
}

interface SchemaHealthReport {
  ok: boolean;
  warnings: string[];
  checks: SchemaHealthCheck[];
  checkedAt: string;
}

const APP_SETTINGS_OPTIONAL_COLUMNS = ['business_name', 'admin_subtitle', 'logo_url', 'logo_hint'] as const;

interface CreateRestaurantBody {
  name?: string;
  slug?: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  plan?: 'basic' | 'premium';
}

function buildTenantUrls(origin: string, slug: string) {
  const tenantBase = `${origin}/t/${slug}`;

  return {
    base: tenantBase,
    order: `${tenantBase}/order`,
    adminLogin: `${tenantBase}/admin/login`,
    adminDashboard: `${tenantBase}/admin`,
  };
}

function generateTenantPassword(slug: string): string {
  const seed = normalizeRestaurantSlug(slug).slice(0, 6) || 'tenant';
  const random = crypto
    .randomBytes(6)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8);

  return `${seed}@${random}`;
}

function emptyMetrics(): TenantMetrics {
  return {
    orders: 0,
    paidOrders: 0,
    revenue: 0,
    totalTables: 0,
    activeTables: 0,
  };
}

function requireCentralSession(req: NextRequest): NextResponse | null {
  const session = readCentralAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  return null;
}

function getRequiredServiceClient(): ReturnType<typeof getServiceRoleSupabase> {
  return getServiceRoleSupabase();
}

function findMissingColumnFromError(message: string, candidates: readonly string[]): string | null {
  const normalized = message.toLowerCase();

  for (const candidate of candidates) {
    if (normalized.includes(candidate.toLowerCase()) && (normalized.includes('column') || normalized.includes('could not find'))) {
      return candidate;
    }
  }

  return null;
}

async function upsertAppSettingsCompat(
  supabase: NonNullable<ReturnType<typeof getServiceRoleSupabase>>,
  payload: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const mutablePayload: Record<string, unknown> = { ...payload };
  const removable = APP_SETTINGS_OPTIONAL_COLUMNS.filter((column) => column in mutablePayload);
  let lastError: { message: string } | null = null;

  for (let attempt = 0; attempt <= removable.length; attempt += 1) {
    const response = await supabase
      .from('app_settings')
      .upsert(mutablePayload, { onConflict: 'restaurant_id' });

    if (!response.error) {
      return { error: null };
    }

    lastError = response.error;
    const missingColumn = findMissingColumnFromError(response.error.message, removable);

    if (!missingColumn || !(missingColumn in mutablePayload)) {
      return { error: lastError };
    }

    delete mutablePayload[missingColumn];
  }

  return { error: lastError };
}

async function checkColumn(
  supabase: NonNullable<ReturnType<typeof getServiceRoleSupabase>>,
  table: string,
  column: string,
  warningMessage: string,
): Promise<SchemaHealthCheck> {
  const { error } = await supabase
    .from(table)
    .select(column)
    .limit(1);

  if (!error) {
    return {
      key: `${table}.${column}`,
      status: 'ok',
      message: `${table}.${column} is available.`,
    };
  }

  const normalized = error.message.toLowerCase();
  const isMissingColumn = normalized.includes(column.toLowerCase())
    && (normalized.includes('could not find') || normalized.includes('column') || normalized.includes('does not exist'));
  const isMissingTable = normalized.includes(`relation "${table}"`) && normalized.includes('does not exist');

  if (isMissingColumn || isMissingTable) {
    return {
      key: `${table}.${column}`,
      status: 'missing',
      message: warningMessage,
    };
  }

  return {
    key: `${table}.${column}`,
    status: 'missing',
    message: `Could not validate ${table}.${column}: ${error.message}`,
  };
}

async function getSchemaHealth(supabase: NonNullable<ReturnType<typeof getServiceRoleSupabase>>): Promise<SchemaHealthReport> {
  const checks = await Promise.all([
    checkColumn(
      supabase,
      'menu_items',
      'image_url',
      'menu_items.image_url is missing. Run ADD_MENU_IMAGE_COLUMN.sql to enable menu image storage.',
    ),
    checkColumn(
      supabase,
      'restaurants',
      'owner_phone',
      'restaurants.owner_phone is missing. Owner phone field will not be stored until this column is added.',
    ),
    checkColumn(
      supabase,
      'app_settings',
      'restaurant_id',
      'app_settings.restaurant_id is missing. Run multi-tenant migration SQL before using central tenant settings.',
    ),
    checkColumn(
      supabase,
      'app_settings',
      'logo_hint',
      'app_settings.logo_hint is missing. Tenant chatbot name customization will be unavailable.',
    ),
    checkColumn(
      supabase,
      'app_settings',
      'logo_url',
      'app_settings.logo_url is missing. Tenant logo customization will be unavailable.',
    ),
  ]);

  const warnings = checks
    .filter((check) => check.status === 'missing')
    .map((check) => check.message);

  return {
    ok: warnings.length === 0,
    warnings,
    checks,
    checkedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const authError = requireCentralSession(req);
  if (authError) return authError;

  const supabase = getRequiredServiceClient();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for central admin APIs.',
    }, { status: 503 });
  }

  const schemaHealth = await getSchemaHealth(supabase);

  const { data: restaurantData, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, slug, name, owner_email, plan, status, is_default, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (restaurantError) {
    return NextResponse.json({ error: restaurantError.message }, { status: 500 });
  }

  const restaurants = (restaurantData || []) as Restaurant[];
  if (restaurants.length === 0) {
    return NextResponse.json({
      restaurants: [],
      metricsByRestaurant: {},
      schemaHealth,
    });
  }

  const restaurantIds = restaurants.map((restaurant) => restaurant.id);

  const [{ data: orderRows, error: ordersError }, { data: tableRows, error: tablesError }] = await Promise.all([
    supabase
      .from('orders')
      .select('restaurant_id, payment_status, total')
      .in('restaurant_id', restaurantIds),
    supabase
      .from('restaurant_tables')
      .select('restaurant_id, status')
      .in('restaurant_id', restaurantIds),
  ]);

  if (ordersError || tablesError) {
    return NextResponse.json({
      error: ordersError?.message || tablesError?.message || 'Unable to load tenant metrics.',
    }, { status: 500 });
  }

  const metricsByRestaurant: Record<number, TenantMetrics> = {};
  restaurantIds.forEach((id) => {
    metricsByRestaurant[id] = emptyMetrics();
  });

  (orderRows as RestaurantOrderRow[] | null)?.forEach((row) => {
    const target = metricsByRestaurant[row.restaurant_id] || (metricsByRestaurant[row.restaurant_id] = emptyMetrics());
    target.orders += 1;

    if (row.payment_status === 'paid') {
      target.paidOrders += 1;
      target.revenue += Number(row.total || 0);
    }
  });

  (tableRows as RestaurantTableRow[] | null)?.forEach((row) => {
    const target = metricsByRestaurant[row.restaurant_id] || (metricsByRestaurant[row.restaurant_id] = emptyMetrics());
    target.totalTables += 1;
    if (row.status !== 'available') {
      target.activeTables += 1;
    }
  });

  return NextResponse.json({
    restaurants,
    metricsByRestaurant,
    schemaHealth,
  });
}

export async function POST(req: NextRequest) {
  const authError = requireCentralSession(req);
  if (authError) return authError;

  const supabase = getRequiredServiceClient();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for central admin APIs.',
    }, { status: 503 });
  }

  let body: CreateRestaurantBody;
  try {
    body = await req.json() as CreateRestaurantBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  const normalizedSlug = normalizeRestaurantSlug((body.slug || name || '').trim());
  const ownerEmail = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim() : '';
  const ownerPhone = typeof body.ownerPhone === 'string' ? body.ownerPhone.trim() : '';
  const plan: 'basic' | 'premium' = body.plan === 'premium' ? 'premium' : 'basic';

  if (!name) {
    return NextResponse.json({ error: 'Restaurant name is required.' }, { status: 400 });
  }

  if (!normalizedSlug) {
    return NextResponse.json({ error: 'Restaurant slug is invalid.' }, { status: 400 });
  }

  const restaurantInsertPayload: Record<string, unknown> = {
    name,
    slug: normalizedSlug,
    owner_email: ownerEmail || null,
    plan,
    status: 'active',
    is_default: false,
  };

  if (ownerPhone) {
    restaurantInsertPayload.owner_phone = ownerPhone;
  }

  let insertResponse = await supabase
    .from('restaurants')
    .insert(restaurantInsertPayload)
    .select('id, slug, name, owner_email, plan, status, is_default, created_at, updated_at')
    .single();

  if (insertResponse.error && ownerPhone && insertResponse.error.message.toLowerCase().includes('owner_phone')) {
    delete restaurantInsertPayload.owner_phone;
    insertResponse = await supabase
      .from('restaurants')
      .insert(restaurantInsertPayload)
      .select('id, slug, name, owner_email, plan, status, is_default, created_at, updated_at')
      .single();
  }

  const { data: insertedRestaurant, error: insertError } = insertResponse;

  if (insertError || !insertedRestaurant) {
    const maybeDuplicate = insertError?.code === '23505';
    return NextResponse.json({
      error: maybeDuplicate
        ? 'Restaurant slug already exists. Please choose a different slug.'
        : (insertError?.message || 'Could not create restaurant.'),
    }, { status: maybeDuplicate ? 409 : 500 });
  }

  const tenant = insertedRestaurant as Restaurant;

  const managerCreds = { username: 'manager', password: generateTenantPassword(tenant.slug) };
  const chefCreds = { username: 'chef', password: generateTenantPassword(tenant.slug) };

  const rollbackRestaurant = async () => {
    await supabase
      .from('restaurants')
      .delete()
      .eq('id', tenant.id);
  };

  const { error: staffError } = await supabase
    .from('restaurant_staff')
    .insert([
      {
        restaurant_id: tenant.id,
        username: managerCreds.username,
        password: managerCreds.password,
        role: 'manager',
        is_active: true,
      },
      {
        restaurant_id: tenant.id,
        username: chefCreds.username,
        password: chefCreds.password,
        role: 'chef',
        is_active: true,
      },
    ]);

  if (staffError) {
    await rollbackRestaurant();
    return NextResponse.json({
      error: `Restaurant created but provisioning staff failed: ${staffError.message}`,
    }, { status: 500 });
  }

  const { error: settingsError } = await upsertAppSettingsCompat(supabase, {
    id: tenant.id,
    restaurant_id: tenant.id,
    business_name: tenant.name,
    admin_subtitle: 'Admin Panel',
    logo_url: '/icons/icon-192x192.png',
    logo_hint: 'SIA',
  });

  if (settingsError) {
    await rollbackRestaurant();
    return NextResponse.json({
      error: `Restaurant created but default settings failed: ${settingsError.message}`,
    }, { status: 500 });
  }

  const defaultTables = Array.from({ length: 7 }, (_, index) => ({
    restaurant_id: tenant.id,
    table_number: index + 1,
    status: 'available' as const,
  }));

  const { error: tablesError } = await supabase
    .from('restaurant_tables')
    .insert(defaultTables);

  if (tablesError) {
    await rollbackRestaurant();
    return NextResponse.json({
      error: `Restaurant created but default tables failed: ${tablesError.message}`,
    }, { status: 500 });
  }

  return NextResponse.json({
    restaurant: tenant,
    credentials: {
      manager: managerCreds,
      chef: chefCreds,
    },
    urls: buildTenantUrls(req.nextUrl.origin, tenant.slug),
  }, { status: 201 });
}
