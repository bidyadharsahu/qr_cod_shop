import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Restaurant } from '@/lib/types';
import { readCentralAdminSession } from '@/lib/central-auth';
import { getServiceRoleSupabase } from '@/lib/server-supabase';
import { normalizeRestaurantSlug } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type StaffRole = 'manager' | 'chef' | 'restaurant_admin';

interface StaffCredentialRow {
  role: StaffRole;
  username: string;
  password: string;
  is_active: boolean;
}

interface AppSettingsRow {
  id?: number | null;
  business_name: string | null;
  admin_subtitle: string | null;
  logo_url: string | null;
  logo_hint: string | null;
}

interface CredentialPatch {
  username?: string;
  password?: string;
}

interface RestaurantPatchBody {
  name?: string;
  slug?: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  plan?: 'basic' | 'premium';
  status?: 'active' | 'disabled';
  credentials?: {
    manager?: CredentialPatch;
    chef?: CredentialPatch;
  };
  branding?: {
    businessName?: string;
    adminSubtitle?: string;
    logoUrl?: string;
    chatbotName?: string;
  };
}

interface RestaurantDeleteBody {
  passcode?: string;
}

const DEFAULT_RESTAURANT_SLUG = 'coasis';
const LEGACY_DEFAULT_RESTAURANT_SLUG = 'default';
const DEFAULT_DELETE_PASSPHRASE = 'bidyadhar';
const DEFAULT_ADMIN_SUBTITLE = 'Admin Panel';
const DEFAULT_LOGO_URL = '/icons/icon-192x192.png';
const DEFAULT_CHATBOT_NAME = 'SIA';
const APP_SETTINGS_OPTIONAL_COLUMNS = ['business_name', 'admin_subtitle', 'logo_url', 'logo_hint'] as const;

function buildTenantUrls(origin: string, slug: string) {
  const normalizedSlug = normalizeRestaurantSlug(slug);
  const tenantBase = `${origin}/t/${normalizedSlug}`;

  return {
    base: tenantBase,
    order: `${tenantBase}/order`,
    adminLogin: `${tenantBase}/admin/login`,
    adminDashboard: `${tenantBase}/admin`,
  };
}

function safeTextCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCredentialPatch(input: CredentialPatch | undefined): CredentialPatch | null {
  if (!input) return null;

  const normalized: CredentialPatch = {};
  if (input.username !== undefined) {
    normalized.username = (input.username || '').trim();
  }
  if (input.password !== undefined) {
    normalized.password = input.password || '';
  }

  if (normalized.username === undefined && normalized.password === undefined) {
    return null;
  }

  return normalized;
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

function requireCentralSession(req: NextRequest): NextResponse | null {
  const session = readCentralAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  return null;
}

function parseRestaurantId(idRaw: string): number | null {
  const parsed = Number(idRaw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function mapRestaurantRow(row: Record<string, unknown>): Restaurant & { owner_phone?: string | null } {
  const isDefault = row.is_default === true;
  const rawSlug = typeof row.slug === 'string' ? row.slug : DEFAULT_RESTAURANT_SLUG;
  const normalizedSlug = normalizeRestaurantSlug(rawSlug);
  const canonicalSlug = isDefault
    ? (normalizedSlug === LEGACY_DEFAULT_RESTAURANT_SLUG ? DEFAULT_RESTAURANT_SLUG : normalizedSlug)
    : normalizedSlug;

  const mapped: Restaurant & { owner_phone?: string | null } = {
    id: Number(row.id),
    slug: canonicalSlug,
    name: typeof row.name === 'string' ? row.name : 'Unnamed Restaurant',
    owner_email: normalizeNullableText(row.owner_email),
    plan: row.plan === 'premium' ? 'premium' : 'basic',
    status: row.status === 'disabled' ? 'disabled' : 'active',
    is_default: isDefault,
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };

  if ('owner_phone' in row) {
    mapped.owner_phone = normalizeNullableText(row.owner_phone);
  }

  return mapped;
}

async function loadRestaurantBundle(supabase: NonNullable<ReturnType<typeof getServiceRoleSupabase>>, restaurantId: number) {
  const { data: restaurantData, error: restaurantError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) return { error: restaurantError.message };
  if (!restaurantData) return { notFound: true as const };

  const [{ data: staffData, error: staffError }, { data: settingsData, error: settingsError }] = await Promise.all([
    supabase
      .from('restaurant_staff')
      .select('role, username, password, is_active')
      .eq('restaurant_id', restaurantId)
      .in('role', ['manager', 'chef', 'restaurant_admin']),
    supabase
      .from('app_settings')
      .select('id, business_name, admin_subtitle, logo_url, logo_hint')
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
  ]);

  if (staffError || settingsError) {
    return {
      error: staffError?.message || settingsError?.message || 'Could not load tenant details.',
    };
  }

  return {
    restaurant: mapRestaurantRow(restaurantData as Record<string, unknown>),
    staff: (staffData || []) as StaffCredentialRow[],
    settings: (settingsData || null) as AppSettingsRow | null,
  };
}

function mapBundleToResponse(origin: string, bundle: {
  restaurant: Restaurant & { owner_phone?: string | null };
  staff: StaffCredentialRow[];
  settings: AppSettingsRow | null;
}) {
  const manager = bundle.staff.find((row) => row.role === 'manager' && row.is_active);
  const chef = bundle.staff.find((row) => row.role === 'chef' && row.is_active);
  const legacyAdmin = bundle.staff.find((row) => row.role === 'restaurant_admin' && row.is_active);

  return {
    restaurant: bundle.restaurant,
    credentials: {
      manager: manager ? { username: manager.username, password: manager.password } : null,
      chef: chef ? { username: chef.username, password: chef.password } : null,
      legacyAdmin: legacyAdmin ? { username: legacyAdmin.username, password: legacyAdmin.password } : null,
    },
    branding: {
      businessName: bundle.settings?.business_name || bundle.restaurant.name,
      adminSubtitle: bundle.settings?.admin_subtitle || DEFAULT_ADMIN_SUBTITLE,
      logoUrl: bundle.settings?.logo_url || DEFAULT_LOGO_URL,
      chatbotName: bundle.settings?.logo_hint || DEFAULT_CHATBOT_NAME,
    },
    urls: buildTenantUrls(origin, bundle.restaurant.slug),
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authError = requireCentralSession(req);
  if (authError) return authError;

  const supabase = getServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for central admin APIs.',
    }, { status: 503 });
  }

  const params = await context.params;
  const restaurantId = parseRestaurantId(params.id);

  if (!restaurantId) {
    return NextResponse.json({ error: 'Invalid restaurant id.' }, { status: 400 });
  }

  const bundle = await loadRestaurantBundle(supabase, restaurantId);

  if ('error' in bundle) {
    return NextResponse.json({ error: bundle.error }, { status: 500 });
  }

  if ('notFound' in bundle) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  return NextResponse.json(mapBundleToResponse(req.nextUrl.origin, bundle));
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const authError = requireCentralSession(req);
  if (authError) return authError;

  const supabase = getServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for central admin APIs.',
    }, { status: 503 });
  }

  const params = await context.params;
  const restaurantId = parseRestaurantId(params.id);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Invalid restaurant id.' }, { status: 400 });
  }

  let body: RestaurantPatchBody;
  try {
    body = await req.json() as RestaurantPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const currentBundle = await loadRestaurantBundle(supabase, restaurantId);
  if ('error' in currentBundle) {
    return NextResponse.json({ error: currentBundle.error }, { status: 500 });
  }
  if ('notFound' in currentBundle) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  const restaurantUpdates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const nextName = (body.name || '').trim();
    if (!nextName) {
      return NextResponse.json({ error: 'Restaurant name cannot be empty.' }, { status: 400 });
    }
    restaurantUpdates.name = nextName;
  }

  if (body.slug !== undefined) {
    const nextSlug = normalizeRestaurantSlug(body.slug || '');
    if (!nextSlug) {
      return NextResponse.json({ error: 'Restaurant slug is invalid.' }, { status: 400 });
    }
    restaurantUpdates.slug = nextSlug;
  }

  if (body.ownerEmail !== undefined) {
    restaurantUpdates.owner_email = normalizeNullableText(body.ownerEmail);
  }

  if (body.ownerPhone !== undefined) {
    restaurantUpdates.owner_phone = normalizeNullableText(body.ownerPhone);
  }

  if (body.plan !== undefined) {
    restaurantUpdates.plan = body.plan === 'premium' ? 'premium' : 'basic';
  }

  if (body.status !== undefined) {
    restaurantUpdates.status = body.status === 'disabled' ? 'disabled' : 'active';
  }

  if (Object.keys(restaurantUpdates).length > 0) {
    const updatePayload = {
      ...restaurantUpdates,
      updated_at: new Date().toISOString(),
    };

    const updateResponse = await supabase
      .from('restaurants')
      .update(updatePayload)
      .eq('id', restaurantId)
      .select('id')
      .maybeSingle();

    let updateError = updateResponse.error;

    if (updateError && 'owner_phone' in updatePayload && updateError.message.toLowerCase().includes('owner_phone')) {
      delete updatePayload.owner_phone;

      if (Object.keys(updatePayload).length > 1) {
        const retryResponse = await supabase
          .from('restaurants')
          .update(updatePayload)
          .eq('id', restaurantId)
          .select('id')
          .maybeSingle();
        updateError = retryResponse.error;
      } else {
        updateError = null;
      }
    }

    if (updateError) {
      const maybeDuplicate = updateError.code === '23505';
      return NextResponse.json({
        error: maybeDuplicate
          ? 'Restaurant slug already exists. Please choose a different slug.'
          : updateError.message,
      }, { status: maybeDuplicate ? 409 : 500 });
    }
  }

  const managerPatch = normalizeCredentialPatch(body.credentials?.manager);
  const chefPatch = normalizeCredentialPatch(body.credentials?.chef);
  const credentialPatches = [
    { role: 'manager' as const, patch: managerPatch },
    { role: 'chef' as const, patch: chefPatch },
  ].filter((entry) => Boolean(entry.patch));

  if (credentialPatches.length > 0) {
    const { data: currentStaffRows, error: currentStaffError } = await supabase
      .from('restaurant_staff')
      .select('id, role, username, password')
      .eq('restaurant_id', restaurantId)
      .in('role', ['manager', 'chef']);

    if (currentStaffError) {
      return NextResponse.json({ error: currentStaffError.message }, { status: 500 });
    }

    for (const entry of credentialPatches) {
      const patch = entry.patch!;
      const existing = (currentStaffRows || []).find((row) => row.role === entry.role);

      const nextUsername = (patch.username !== undefined ? patch.username : (existing?.username || entry.role)).trim();
      const nextPassword = patch.password !== undefined ? patch.password : (existing?.password || '');

      if (!nextUsername || !nextPassword) {
        return NextResponse.json({
          error: `${entry.role} username and password are required.`,
        }, { status: 400 });
      }

      if (existing) {
        const { error: updateStaffError } = await supabase
          .from('restaurant_staff')
          .update({
            username: nextUsername,
            password: nextPassword,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateStaffError) {
          return NextResponse.json({ error: updateStaffError.message }, { status: 500 });
        }
      } else {
        const { error: insertStaffError } = await supabase
          .from('restaurant_staff')
          .insert({
            restaurant_id: restaurantId,
            role: entry.role,
            username: nextUsername,
            password: nextPassword,
            is_active: true,
          });

        if (insertStaffError) {
          return NextResponse.json({ error: insertStaffError.message }, { status: 500 });
        }
      }
    }
  }

  if (body.branding !== undefined) {
    const { data: currentSettings, error: currentSettingsError } = await supabase
      .from('app_settings')
      .select('id, business_name, admin_subtitle, logo_url, logo_hint')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (currentSettingsError) {
      return NextResponse.json({ error: currentSettingsError.message }, { status: 500 });
    }

    const settingsPayload = {
      id: currentSettings?.id || restaurantId,
      restaurant_id: restaurantId,
      business_name: normalizeNullableText(body.branding.businessName)
        || currentSettings?.business_name
        || currentBundle.restaurant.name,
      admin_subtitle: normalizeNullableText(body.branding.adminSubtitle)
        || currentSettings?.admin_subtitle
        || DEFAULT_ADMIN_SUBTITLE,
      logo_url: normalizeNullableText(body.branding.logoUrl)
        || currentSettings?.logo_url
        || DEFAULT_LOGO_URL,
      logo_hint: normalizeNullableText(body.branding.chatbotName)
        || currentSettings?.logo_hint
        || DEFAULT_CHATBOT_NAME,
    };

    const { error: settingsError } = await upsertAppSettingsCompat(supabase, settingsPayload);

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }
  }

  const nextBundle = await loadRestaurantBundle(supabase, restaurantId);
  if ('error' in nextBundle) {
    return NextResponse.json({ error: nextBundle.error }, { status: 500 });
  }
  if ('notFound' in nextBundle) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  return NextResponse.json(mapBundleToResponse(req.nextUrl.origin, nextBundle));
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authError = requireCentralSession(req);
  if (authError) return authError;

  const supabase = getServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for central admin APIs.',
    }, { status: 503 });
  }

  const params = await context.params;
  const restaurantId = parseRestaurantId(params.id);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Invalid restaurant id.' }, { status: 400 });
  }

  let body: RestaurantDeleteBody;
  try {
    body = await req.json() as RestaurantDeleteBody;
  } catch {
    body = {};
  }

  const expectedPasscode = process.env.CENTRAL_DELETE_PASSPHRASE || DEFAULT_DELETE_PASSPHRASE;
  const providedPasscode = body.passcode || '';

  if (!providedPasscode || !safeTextCompare(providedPasscode, expectedPasscode)) {
    return NextResponse.json({ error: 'Invalid delete passcode.' }, { status: 403 });
  }

  const { data: currentRestaurant, error: readError } = await supabase
    .from('restaurants')
    .select('id, name, is_default')
    .eq('id', restaurantId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  if (!currentRestaurant) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  if (currentRestaurant.is_default) {
    return NextResponse.json({
      error: 'Default tenant cannot be deleted.',
    }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from('restaurants')
    .delete()
    .eq('id', restaurantId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    deleted: true,
    restaurantId,
    message: `Restaurant ${currentRestaurant.name} deleted successfully.`,
  });
}
