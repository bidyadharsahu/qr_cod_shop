import { NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '@/lib/server-supabase';

export async function GET() {
  const supabase = getServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for tenant catalog API.',
    }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, slug, name, plan, status')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ restaurants: data || [] });
}
