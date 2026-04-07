import OrderPage from '@/app/order/page';

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantOrderPage({ params }: RouteProps) {
  const { slug } = await params;

  return <OrderPage forcedTenantSlug={slug} />;
}
