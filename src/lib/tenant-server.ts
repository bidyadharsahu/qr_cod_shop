import { NextRequest } from 'next/server';

export const DEFAULT_TENANT_ID = 1;

export const parseTenantId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }

  return null;
};

export const getTenantIdFromRequest = (req: NextRequest): number | null => {
  const headerTenantId = parseTenantId(req.headers.get('x-restaurant-id'));
  if (headerTenantId) return headerTenantId;

  const queryTenantId = parseTenantId(req.nextUrl.searchParams.get('restaurantId'));
  if (queryTenantId) return queryTenantId;

  return null;
};

export const resolveTenantIdFromRequest = (req: NextRequest): number => {
  return getTenantIdFromRequest(req) ?? DEFAULT_TENANT_ID;
};
