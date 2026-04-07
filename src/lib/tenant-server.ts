import { NextRequest } from 'next/server';

export const DEFAULT_TENANT_ID = 1;

export const normalizeTenantSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

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

export const parseTenantSlug = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = normalizeTenantSlug(value);
  return normalized || null;
};

export const getTenantIdFromRequest = (req: NextRequest): number | null => {
  const headerTenantId = parseTenantId(req.headers.get('x-restaurant-id'));
  if (headerTenantId) return headerTenantId;

  const queryTenantId = parseTenantId(req.nextUrl.searchParams.get('restaurantId'));
  if (queryTenantId) return queryTenantId;

  return null;
};

export const getTenantSlugFromRequest = (req: NextRequest): string | null => {
  const headerSlug = parseTenantSlug(req.headers.get('x-restaurant-slug'));
  if (headerSlug) return headerSlug;

  const querySlug = parseTenantSlug(
    req.nextUrl.searchParams.get('restaurantSlug')
    || req.nextUrl.searchParams.get('tenant')
    || req.nextUrl.searchParams.get('slug')
  );
  if (querySlug) return querySlug;

  return null;
};

export const resolveTenantIdFromRequest = (req: NextRequest): number => {
  return getTenantIdFromRequest(req) ?? DEFAULT_TENANT_ID;
};
