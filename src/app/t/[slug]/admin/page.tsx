import AdminDashboard from '@/app/admin/page';

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAdminDashboardPage({ params }: RouteProps) {
  const { slug } = await params;

  return <AdminDashboard forcedTenantSlug={slug} />;
}
