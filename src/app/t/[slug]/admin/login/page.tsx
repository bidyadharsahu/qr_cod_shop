import AdminLoginPage from '@/app/admin/login/page';

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAdminLoginPage({ params }: RouteProps) {
  const { slug } = await params;

  return <AdminLoginPage forcedTenantSlug={slug} />;
}
