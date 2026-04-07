-- ============================================
-- MULTI-TENANT UPGRADE (Single app -> Multi restaurant SaaS)
-- ============================================
-- Safe to run multiple times.
--
-- What this migration does:
-- 1) Creates restaurants + restaurant_staff tables
-- 2) Adds restaurant_id to tenant data tables
-- 3) Backfills existing rows to a default restaurant
-- 4) Adds composite unique constraints for tenant-safe keys
-- 5) Adds helpful indexes and realtime publication entries
-- ============================================

BEGIN;

-- -----------------------------
-- 1) Core tenant tables
-- -----------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_email TEXT,
  plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_staff (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'chef', 'restaurant_admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_restaurants_status_plan ON restaurants(status, plan);
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_restaurant_role ON restaurant_staff(restaurant_id, role);

-- Make sure exactly one default tenant exists.
INSERT INTO restaurants (slug, name, owner_email, plan, status, is_default)
VALUES ('default', 'Default Restaurant', 'owner@default.local', 'premium', 'active', true)
ON CONFLICT (slug) DO UPDATE
SET
  is_default = true,
  updated_at = NOW();

-- Normalize potential multiple defaults.
WITH picked AS (
  SELECT id
  FROM restaurants
  WHERE slug = 'default'
  ORDER BY id
  LIMIT 1
)
UPDATE restaurants
SET is_default = CASE WHEN id = (SELECT id FROM picked) THEN true ELSE false END;

-- Seed backward-compatible staff credentials for default restaurant if none exist.
INSERT INTO restaurant_staff (restaurant_id, username, password, role, is_active)
SELECT r.id, 'hello', '789456', 'manager', true
FROM restaurants r
WHERE r.slug = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM restaurant_staff s
    WHERE s.restaurant_id = r.id
      AND s.username = 'hello'
  );

INSERT INTO restaurant_staff (restaurant_id, username, password, role, is_active)
SELECT r.id, 'chef', 'chef123', 'chef', true
FROM restaurants r
WHERE r.slug = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM restaurant_staff s
    WHERE s.restaurant_id = r.id
      AND s.username = 'chef'
  );

-- -----------------------------
-- 2) Add restaurant_id columns
-- -----------------------------
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;
ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;
ALTER TABLE IF EXISTS payment_event_audit ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;
ALTER TABLE IF EXISTS app_settings ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;

-- Backfill existing rows to default restaurant.
WITH default_restaurant AS (
  SELECT id FROM restaurants WHERE is_default = true ORDER BY id LIMIT 1
)
UPDATE menu_items
SET restaurant_id = (SELECT id FROM default_restaurant)
WHERE restaurant_id IS NULL;

WITH default_restaurant AS (
  SELECT id FROM restaurants WHERE is_default = true ORDER BY id LIMIT 1
)
UPDATE restaurant_tables
SET restaurant_id = (SELECT id FROM default_restaurant)
WHERE restaurant_id IS NULL;

WITH default_restaurant AS (
  SELECT id FROM restaurants WHERE is_default = true ORDER BY id LIMIT 1
)
UPDATE orders
SET restaurant_id = (SELECT id FROM default_restaurant)
WHERE restaurant_id IS NULL;

WITH default_restaurant AS (
  SELECT id FROM restaurants WHERE is_default = true ORDER BY id LIMIT 1
)
UPDATE payment_event_audit
SET restaurant_id = COALESCE(
  payment_event_audit.restaurant_id,
  (SELECT o.restaurant_id FROM orders o WHERE o.id = payment_event_audit.order_id LIMIT 1),
  (SELECT id FROM default_restaurant)
)
WHERE restaurant_id IS NULL;

WITH default_restaurant AS (
  SELECT id FROM restaurants WHERE is_default = true ORDER BY id LIMIT 1
)
UPDATE app_settings
SET restaurant_id = (SELECT id FROM default_restaurant)
WHERE restaurant_id IS NULL;

-- Enforce not-null where appropriate.
ALTER TABLE IF EXISTS menu_items ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE IF EXISTS restaurant_tables ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE IF EXISTS orders ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE IF EXISTS payment_event_audit ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE IF EXISTS app_settings ALTER COLUMN restaurant_id SET NOT NULL;

-- Foreign keys (idempotent via DO block checks).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_restaurant_id_fkey'
  ) THEN
    ALTER TABLE menu_items
      ADD CONSTRAINT menu_items_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_tables_restaurant_id_fkey'
  ) THEN
    ALTER TABLE restaurant_tables
      ADD CONSTRAINT restaurant_tables_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_restaurant_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_event_audit_restaurant_id_fkey'
  ) THEN
    ALTER TABLE payment_event_audit
      ADD CONSTRAINT payment_event_audit_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_restaurant_id_fkey'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- -----------------------------
-- 3) Tenant-safe unique keys
-- -----------------------------
ALTER TABLE IF EXISTS restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_table_number_key;
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_receipt_id_key;
ALTER TABLE IF EXISTS app_settings DROP CONSTRAINT IF EXISTS app_settings_single_row;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_tables_restaurant_id_table_number_key'
  ) THEN
    ALTER TABLE restaurant_tables
      ADD CONSTRAINT restaurant_tables_restaurant_id_table_number_key
      UNIQUE (restaurant_id, table_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_restaurant_id_receipt_id_key'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_restaurant_id_receipt_id_key
      UNIQUE (restaurant_id, receipt_id);
  END IF;
END $$;

-- One branding row per restaurant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_settings_restaurant_id ON app_settings(restaurant_id);

-- Helpful tenant indexes.
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id_created_at ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id_status ON orders(restaurant_id, status, payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_event_audit_restaurant_time ON payment_event_audit(restaurant_id, event_time DESC);

-- Ensure payment_event_audit references a same-tenant order when linked.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_event_audit_order_tenant_fk'
  ) THEN
    ALTER TABLE payment_event_audit
      ADD CONSTRAINT payment_event_audit_order_tenant_fk
      FOREIGN KEY (restaurant_id, order_id)
      REFERENCES orders(restaurant_id, id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN invalid_foreign_key THEN
    -- If orders PK shape prevents composite FK in older installs, ignore.
    NULL;
END $$;

-- -----------------------------
-- 4) Realtime publication
-- -----------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_staff;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payment_event_audit;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- ============================================
-- NEXT STEP (manual):
-- Run strict tenant RLS once Supabase Auth/JWT includes restaurant_id claim.
-- ============================================
SELECT 'Multi-tenant migration completed' AS status;
