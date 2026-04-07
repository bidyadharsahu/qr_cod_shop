export type StaffRole = 'manager' | 'chef' | 'restaurant_admin' | 'super_admin';

export interface RestaurantContext {
  restaurantId: number;
  restaurantSlug: string;
  restaurantName: string;
}

export interface StaffSession {
  authenticated: boolean;
  staffRole: StaffRole;
  staffUser: string;
  restaurantId: number;
  restaurantSlug: string;
  restaurantName: string;
}

export const DEFAULT_RESTAURANT_CONTEXT: RestaurantContext = {
  restaurantId: 1,
  restaurantSlug: 'default',
  restaurantName: 'Default Restaurant',
};

export const TENANT_STORAGE_KEYS = {
  restaurantId: 'netrikxr_restaurant_id',
  restaurantSlug: 'netrikxr_restaurant_slug',
  restaurantName: 'netrikxr_restaurant_name',
} as const;

export const ADMIN_SESSION_KEYS = {
  authenticated: 'admin_authenticated',
  staffRole: 'staff_role',
  staffUser: 'staff_username',
  restaurantId: 'staff_restaurant_id',
  restaurantSlug: 'staff_restaurant_slug',
  restaurantName: 'staff_restaurant_name',
  centralAdminAuthenticated: 'central_admin_authenticated',
  centralAdminUser: 'central_admin_user',
} as const;

export const normalizeRestaurantSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || DEFAULT_RESTAURANT_CONTEXT.restaurantSlug;
};

export const parseRestaurantId = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const readStorageValue = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  const fromSession = window.sessionStorage.getItem(key);
  if (fromSession) return fromSession;
  return window.localStorage.getItem(key);
};

const writeStorageValue = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem(key, value);
};

export const readRestaurantContext = (): RestaurantContext => {
  const storedId = parseRestaurantId(readStorageValue(TENANT_STORAGE_KEYS.restaurantId));
  const storedSlug = readStorageValue(TENANT_STORAGE_KEYS.restaurantSlug);
  const storedName = readStorageValue(TENANT_STORAGE_KEYS.restaurantName);

  return {
    restaurantId: storedId ?? DEFAULT_RESTAURANT_CONTEXT.restaurantId,
    restaurantSlug: normalizeRestaurantSlug(storedSlug || DEFAULT_RESTAURANT_CONTEXT.restaurantSlug),
    restaurantName: (storedName || DEFAULT_RESTAURANT_CONTEXT.restaurantName).trim() || DEFAULT_RESTAURANT_CONTEXT.restaurantName,
  };
};

export const persistRestaurantContext = (context: Partial<RestaurantContext>) => {
  if (typeof window === 'undefined') return;

  if (context.restaurantId && Number.isFinite(context.restaurantId) && context.restaurantId > 0) {
    writeStorageValue(TENANT_STORAGE_KEYS.restaurantId, String(context.restaurantId));
  }

  if (context.restaurantSlug && context.restaurantSlug.trim().length > 0) {
    writeStorageValue(TENANT_STORAGE_KEYS.restaurantSlug, normalizeRestaurantSlug(context.restaurantSlug));
  }

  if (context.restaurantName && context.restaurantName.trim().length > 0) {
    writeStorageValue(TENANT_STORAGE_KEYS.restaurantName, context.restaurantName.trim());
  }
};

export const clearRestaurantContext = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TENANT_STORAGE_KEYS.restaurantId);
  window.localStorage.removeItem(TENANT_STORAGE_KEYS.restaurantSlug);
  window.localStorage.removeItem(TENANT_STORAGE_KEYS.restaurantName);
  window.sessionStorage.removeItem(TENANT_STORAGE_KEYS.restaurantId);
  window.sessionStorage.removeItem(TENANT_STORAGE_KEYS.restaurantSlug);
  window.sessionStorage.removeItem(TENANT_STORAGE_KEYS.restaurantName);
};

export const readAdminSession = (): StaffSession => {
  if (typeof window === 'undefined') {
    return {
      authenticated: false,
      staffRole: 'manager',
      staffUser: '',
      restaurantId: DEFAULT_RESTAURANT_CONTEXT.restaurantId,
      restaurantSlug: DEFAULT_RESTAURANT_CONTEXT.restaurantSlug,
      restaurantName: DEFAULT_RESTAURANT_CONTEXT.restaurantName,
    };
  }

  const authenticated = window.sessionStorage.getItem(ADMIN_SESSION_KEYS.authenticated) === 'true';
  const roleRaw = window.sessionStorage.getItem(ADMIN_SESSION_KEYS.staffRole) || 'manager';
  const role: StaffRole = roleRaw === 'chef' || roleRaw === 'restaurant_admin' || roleRaw === 'super_admin'
    ? roleRaw
    : 'manager';

  const restaurantId = parseRestaurantId(window.sessionStorage.getItem(ADMIN_SESSION_KEYS.restaurantId))
    ?? readRestaurantContext().restaurantId;

  const restaurantSlug = normalizeRestaurantSlug(
    window.sessionStorage.getItem(ADMIN_SESSION_KEYS.restaurantSlug)
    || readRestaurantContext().restaurantSlug
  );

  const restaurantName = (window.sessionStorage.getItem(ADMIN_SESSION_KEYS.restaurantName)
    || readRestaurantContext().restaurantName)
    .trim() || DEFAULT_RESTAURANT_CONTEXT.restaurantName;

  return {
    authenticated,
    staffRole: role,
    staffUser: window.sessionStorage.getItem(ADMIN_SESSION_KEYS.staffUser) || '',
    restaurantId,
    restaurantSlug,
    restaurantName,
  };
};

export const persistAdminSession = (session: Omit<StaffSession, 'authenticated'>) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ADMIN_SESSION_KEYS.authenticated, 'true');
  window.sessionStorage.setItem(ADMIN_SESSION_KEYS.staffRole, session.staffRole);
  window.sessionStorage.setItem(ADMIN_SESSION_KEYS.staffUser, session.staffUser);
  window.sessionStorage.setItem(ADMIN_SESSION_KEYS.restaurantId, String(session.restaurantId));
  window.sessionStorage.setItem(ADMIN_SESSION_KEYS.restaurantSlug, normalizeRestaurantSlug(session.restaurantSlug));
  window.sessionStorage.setItem(ADMIN_SESSION_KEYS.restaurantName, session.restaurantName);

  persistRestaurantContext({
    restaurantId: session.restaurantId,
    restaurantSlug: session.restaurantSlug,
    restaurantName: session.restaurantName,
  });
};

export const clearAdminSession = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_SESSION_KEYS.authenticated);
  window.sessionStorage.removeItem(ADMIN_SESSION_KEYS.staffRole);
  window.sessionStorage.removeItem(ADMIN_SESSION_KEYS.staffUser);
  window.sessionStorage.removeItem(ADMIN_SESSION_KEYS.restaurantId);
  window.sessionStorage.removeItem(ADMIN_SESSION_KEYS.restaurantSlug);
  window.sessionStorage.removeItem(ADMIN_SESSION_KEYS.restaurantName);
};
