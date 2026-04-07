import { NextRequest, NextResponse } from 'next/server';
import { readCentralAdminSession } from '@/lib/central-auth';
import { getServiceRoleSupabase } from '@/lib/server-supabase';

interface RestaurantPatchBody {
  plan?: 'basic' | 'premium';
  status?: 'active' | 'disabled';
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = readCentralAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = getServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for central admin APIs.',
    }, { status: 503 });
  }

  const params = await context.params;
  const restaurantId = Number(params.id);

  if (!Number.isFinite(restaurantId) || restaurantId <= 0) {
    return NextResponse.json({ error: 'Invalid restaurant id.' }, { status: 400 });
  }

  let body: RestaurantPatchBody;
  try {
    body = await req.json() as RestaurantPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const updates: {
    plan?: 'basic' | 'premium';
    status?: 'active' | 'disabled';
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (body.plan !== undefined) {
    updates.plan = body.plan === 'premium' ? 'premium' : 'basic';
  }

  if (body.status !== undefined) {
    updates.status = body.status === 'disabled' ? 'disabled' : 'active';
  }

  if (updates.plan === undefined && updates.status === undefined) {
    return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('restaurants')
    .update(updates)
    .eq('id', restaurantId)
    .select('id, slug, name, owner_email, plan, status, is_default, created_at, updated_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  return NextResponse.json({ restaurant: data });
}
