-- ============================================
-- HEADER-BASED TENANT RLS (Transitional)
-- ============================================
-- Run this after MIGRATE_MULTI_TENANT.sql.
--
-- This script enforces tenant isolation using request headers:
-- - x-restaurant-id
-- - x-central-admin=true (for central dashboard)
--
-- For production-hard security, migrate to JWT claim-based policies.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.request_restaurant_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.headers', true)::json ->> 'x-restaurant-id'), '')::bigint
$$;

CREATE OR REPLACE FUNCTION public.is_central_admin_request()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((current_setting('request.headers', true)::json ->> 'x-central-admin') = 'true', false)
$$;

ALTER TABLE IF EXISTS public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_event_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurants_select ON public.restaurants;
DROP POLICY IF EXISTS restaurants_insert ON public.restaurants;
DROP POLICY IF EXISTS restaurants_update ON public.restaurants;

CREATE POLICY restaurants_select ON public.restaurants
FOR SELECT
USING (
  public.is_central_admin_request()
  OR id = public.request_restaurant_id()
);

CREATE POLICY restaurants_insert ON public.restaurants
FOR INSERT
WITH CHECK (public.is_central_admin_request());

CREATE POLICY restaurants_update ON public.restaurants
FOR UPDATE
USING (
  public.is_central_admin_request()
  OR id = public.request_restaurant_id()
)
WITH CHECK (
  public.is_central_admin_request()
  OR id = public.request_restaurant_id()
);

DROP POLICY IF EXISTS staff_select ON public.restaurant_staff;
DROP POLICY IF EXISTS staff_insert ON public.restaurant_staff;
DROP POLICY IF EXISTS staff_update ON public.restaurant_staff;

CREATE POLICY staff_select ON public.restaurant_staff
FOR SELECT
USING (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

CREATE POLICY staff_insert ON public.restaurant_staff
FOR INSERT
WITH CHECK (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

CREATE POLICY staff_update ON public.restaurant_staff
FOR UPDATE
USING (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
)
WITH CHECK (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

DROP POLICY IF EXISTS menu_items_tenant_rw ON public.menu_items;
CREATE POLICY menu_items_tenant_rw ON public.menu_items
FOR ALL
USING (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
)
WITH CHECK (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

DROP POLICY IF EXISTS restaurant_tables_tenant_rw ON public.restaurant_tables;
CREATE POLICY restaurant_tables_tenant_rw ON public.restaurant_tables
FOR ALL
USING (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
)
WITH CHECK (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

DROP POLICY IF EXISTS orders_tenant_rw ON public.orders;
CREATE POLICY orders_tenant_rw ON public.orders
FOR ALL
USING (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
)
WITH CHECK (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

DROP POLICY IF EXISTS payment_event_audit_tenant_rw ON public.payment_event_audit;
CREATE POLICY payment_event_audit_tenant_rw ON public.payment_event_audit
FOR ALL
USING (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
)
WITH CHECK (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

DROP POLICY IF EXISTS app_settings_tenant_rw ON public.app_settings;
CREATE POLICY app_settings_tenant_rw ON public.app_settings
FOR ALL
USING (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
)
WITH CHECK (
  public.is_central_admin_request()
  OR restaurant_id = public.request_restaurant_id()
);

COMMIT;

SELECT 'Header-based multi-tenant RLS enabled' AS status;
