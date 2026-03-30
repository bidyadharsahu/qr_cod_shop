-- ============================================
-- ADD APP SETTINGS TABLE FOR BRANDING
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY,
  business_name TEXT NOT NULL DEFAULT 'NETRIKXR.SHOP',
  admin_subtitle TEXT NOT NULL DEFAULT 'Admin Dashboard',
  logo_url TEXT NOT NULL DEFAULT '/icons/icon-192x192.png',
  logo_hint TEXT NOT NULL DEFAULT 'NET',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_app_settings" ON app_settings;

CREATE POLICY "allow_all_app_settings" ON app_settings
FOR ALL
USING (true)
WITH CHECK (true);

INSERT INTO app_settings (id, business_name, admin_subtitle, logo_url, logo_hint)
VALUES (1, 'NETRIKXR.SHOP', 'Admin Dashboard', '/icons/icon-192x192.png', 'NET')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

SELECT 'app_settings table ready' AS status;
