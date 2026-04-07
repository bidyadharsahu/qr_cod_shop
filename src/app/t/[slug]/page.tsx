import { redirect } from 'next/navigation';
import { normalizeRestaurantSlug } from '@/lib/tenant';

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantRootPage({ params }: RouteProps) {
  const { slug } = await params;
  const normalizedSlug = normalizeRestaurantSlug(slug || '');

  if (!normalizedSlug) {
    redirect('/');
  }

  redirect(`/t/${normalizedSlug}/order`);
}
