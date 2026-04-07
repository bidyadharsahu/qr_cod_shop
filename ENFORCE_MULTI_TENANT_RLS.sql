-- ============================================
-- STRICT MULTI-TENANT RLS (Header-Scoped Tenant)
-- ============================================
-- Run this after MIGRATE_MULTI_TENANT.sql.
--
-- Security goals:
-- 1) Every tenant query is scoped by x-restaurant-id
-- 2) Legacy permissive policies are removed
-- 3) Disabled tenants are blocked from business tables
-- 4) Central admin access is handled server-side via service role key
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.request_restaurant_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.headers', true)::json ->> 'x-restaurant-id'), '')::bigint
$$;

DROP FUNCTION IF EXISTS public.is_central_admin_request();

CREATE OR REPLACE FUNCTION public.tenant_matches(target_restaurant_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.request_restaurant_id() IS NOT NULL
    AND target_restaurant_id = public.request_restaurant_id()
$$;

CREATE OR REPLACE FUNCTION public.tenant_is_active(target_restaurant_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = target_restaurant_id
      AND r.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_access(target_restaurant_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.tenant_matches(target_restaurant_id)
    AND public.tenant_is_active(target_restaurant_id)
$$;

ALTER TABLE IF EXISTS public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_event_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies on tenant tables to avoid permissive OR-leakage.
DO $$
DECLARE
  _table_name text;
  _policy record;
BEGIN
  FOR _table_name IN
    SELECT unnest(ARRAY[
      'restaurants',
      'restaurant_staff',
      'menu_items',
      'restaurant_tables',
      'orders',
      'payment_event_audit',
      'app_settings'
    ])
  LOOP
    FOR _policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = _table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', _policy.policyname, _table_name);
    END LOOP;
  END LOOP;
END $$;

-- Restaurants: allow tenant to read own tenant metadata (including disabled status).
CREATE POLICY restaurants_tenant_select
ON public.restaurants
FOR SELECT
USING (public.tenant_matches(id));

-- Staff credentials are readable only for active tenant.
CREATE POLICY restaurant_staff_tenant_select
ON public.restaurant_staff
FOR SELECT
USING (public.tenant_has_access(restaurant_id));

CREATE POLICY menu_items_tenant_rw
ON public.menu_items
FOR ALL
USING (public.tenant_has_access(restaurant_id))
WITH CHECK (public.tenant_has_access(restaurant_id));

CREATE POLICY restaurant_tables_tenant_rw
ON public.restaurant_tables
FOR ALL
USING (public.tenant_has_access(restaurant_id))
WITH CHECK (public.tenant_has_access(restaurant_id));

CREATE POLICY orders_tenant_rw
ON public.orders
FOR ALL
USING (public.tenant_has_access(restaurant_id))
WITH CHECK (public.tenant_has_access(restaurant_id));

CREATE POLICY payment_event_audit_tenant_rw
ON public.payment_event_audit
FOR ALL
USING (public.tenant_has_access(restaurant_id))
WITH CHECK (public.tenant_has_access(restaurant_id));

CREATE POLICY app_settings_tenant_rw
ON public.app_settings
FOR ALL
USING (public.tenant_has_access(restaurant_id))
WITH CHECK (public.tenant_has_access(restaurant_id));

-- Basic-plan hard limit: max 10 tables per tenant.
CREATE OR REPLACE FUNCTION public.enforce_basic_plan_table_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_restaurant_id BIGINT;
  target_plan TEXT;
  table_count INTEGER;
BEGIN
  target_restaurant_id := NEW.restaurant_id;

  IF target_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id is required for restaurant_tables';
  END IF;

  SELECT r.plan
  INTO target_plan
  FROM public.restaurants r
  WHERE r.id = target_restaurant_id;

  IF target_plan IS NULL THEN
    RAISE EXCEPTION 'Restaurant % does not exist', target_restaurant_id;
  END IF;

  IF target_plan = 'basic' THEN
    SELECT COUNT(*)
    INTO table_count
    FROM public.restaurant_tables t
    WHERE t.restaurant_id = target_restaurant_id
      AND (TG_OP = 'INSERT' OR t.id <> COALESCE(NEW.id, -1));

    IF table_count >= 10 THEN
      RAISE EXCEPTION 'Basic plan supports up to 10 tables. Upgrade to premium for more.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_basic_plan_table_limit ON public.restaurant_tables;

CREATE TRIGGER trg_enforce_basic_plan_table_limit
BEFORE INSERT OR UPDATE OF restaurant_id
ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.enforce_basic_plan_table_limit();

COMMIT;

SELECT 'Strict tenant RLS enabled (tenant-scoped + active-tenant guarded)' AS status;
