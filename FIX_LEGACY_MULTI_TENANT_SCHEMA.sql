-- ============================================================
-- LEGACY MULTI-TENANT COMPATIBILITY FIX
-- Run this once in Supabase SQL Editor (safe to re-run)
-- Fixes:
-- 1) Default tenant renamed/canonicalized to `coasis`
-- 2) app_settings converted from old single-row schema to per-tenant schema
-- 3) Default tenant fallback staff accounts ensured
-- ============================================================

BEGIN;

-- Canonical default tenant: coasis (keep id stable if legacy slug is `default`)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE slug = 'default')
     AND NOT EXISTS (SELECT 1 FROM public.restaurants WHERE slug = 'coasis') THEN
    UPDATE public.restaurants
    SET
      slug = 'coasis',
      name = CASE
        WHEN trim(coalesce(name, '')) = '' OR name = 'Default Restaurant' THEN 'Coasis Restaurant and Cafe'
        ELSE name
      END,
      owner_email = COALESCE(owner_email, 'owner@coasis.local'),
      is_default = true,
      updated_at = NOW()
    WHERE slug = 'default';
  END IF;

  INSERT INTO public.restaurants (slug, name, owner_email, plan, status, is_default)
  VALUES ('coasis', 'Coasis Restaurant and Cafe', 'owner@coasis.local', 'premium', 'active', true)
  ON CONFLICT (slug) DO UPDATE
  SET
    is_default = true,
    updated_at = NOW();

  UPDATE public.restaurants
  SET is_default = CASE
    WHEN id = (
      SELECT id
      FROM public.restaurants
      WHERE slug = 'coasis'
      ORDER BY id
      LIMIT 1
    ) THEN true
    ELSE false
  END;
END $$;

-- app_settings legacy single-row compatibility
ALTER TABLE IF EXISTS public.app_settings ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;
ALTER TABLE IF EXISTS public.app_settings DROP CONSTRAINT IF EXISTS app_settings_single_row;
ALTER TABLE IF EXISTS public.app_settings DROP CONSTRAINT IF EXISTS app_settings_id_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_settings'
      AND column_name = 'id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS app_settings_id_seq;

    PERFORM setval(
      'app_settings_id_seq',
      COALESCE((SELECT MAX(id) FROM public.app_settings), 0) + 1,
      false
    );

    ALTER TABLE public.app_settings
      ALTER COLUMN id SET DEFAULT nextval('app_settings_id_seq');

    ALTER SEQUENCE app_settings_id_seq OWNED BY public.app_settings.id;
  END IF;
END $$;

WITH default_restaurant AS (
  SELECT id
  FROM public.restaurants
  WHERE is_default = true
  ORDER BY id
  LIMIT 1
)
UPDATE public.app_settings
SET restaurant_id = (SELECT id FROM default_restaurant)
WHERE restaurant_id IS NULL;

ALTER TABLE IF EXISTS public.app_settings ALTER COLUMN restaurant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_restaurant_id_fkey'
  ) THEN
    ALTER TABLE public.app_settings
      ADD CONSTRAINT app_settings_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES public.restaurants(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_settings_restaurant_id
  ON public.app_settings(restaurant_id);

-- Ensure fallback default tenant staff accounts exist
INSERT INTO public.restaurant_staff (restaurant_id, username, password, role, is_active)
SELECT r.id, 'hello', '789456', 'manager', true
FROM public.restaurants r
WHERE r.is_default = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.restaurant_staff s
    WHERE s.restaurant_id = r.id
      AND s.username = 'hello'
      AND s.role = 'manager'
  );

INSERT INTO public.restaurant_staff (restaurant_id, username, password, role, is_active)
SELECT r.id, 'chef', 'chef123', 'chef', true
FROM public.restaurants r
WHERE r.is_default = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.restaurant_staff s
    WHERE s.restaurant_id = r.id
      AND s.username = 'chef'
      AND s.role = 'chef'
  );

INSERT INTO public.restaurant_staff (restaurant_id, username, password, role, is_active)
SELECT r.id, 'admin', 'admin123', 'restaurant_admin', true
FROM public.restaurants r
WHERE r.is_default = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.restaurant_staff s
    WHERE s.restaurant_id = r.id
      AND s.username = 'admin'
      AND s.role = 'restaurant_admin'
  );

COMMIT;

SELECT 'Legacy multi-tenant compatibility fix applied.' AS status;
