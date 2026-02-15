-- ============================================
-- FIX RLS POLICIES FOR CUSTOM AUTH
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard → SQL Editor
-- ============================================
-- Your app uses custom auth (not Supabase Auth)
-- So we need permissive policies for all operations
-- ============================================

-- Drop ALL existing policies for menu_items
DROP POLICY IF EXISTS "Public can read menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can insert menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can update menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can delete menu" ON menu_items;
DROP POLICY IF EXISTS "menu_select" ON menu_items;
DROP POLICY IF EXISTS "menu_insert" ON menu_items;
DROP POLICY IF EXISTS "menu_update" ON menu_items;
DROP POLICY IF EXISTS "menu_delete" ON menu_items;
DROP POLICY IF EXISTS "allow_all_menu" ON menu_items;

-- Drop ALL existing policies for restaurant_tables
DROP POLICY IF EXISTS "Public can read tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can insert tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can update tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can delete tables" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_select" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_insert" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_update" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_delete" ON restaurant_tables;
DROP POLICY IF EXISTS "allow_all_tables" ON restaurant_tables;

-- Drop ALL existing policies for orders
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON orders;
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "orders_delete" ON orders;
DROP POLICY IF EXISTS "allow_all_orders" ON orders;

-- ===========================================
-- PERMISSIVE POLICIES FOR ALL TABLES
-- ===========================================

-- MENU ITEMS - Allow all operations
CREATE POLICY "allow_all_menu" ON menu_items
FOR ALL
USING (true)
WITH CHECK (true);

-- RESTAURANT TABLES - Allow all operations
CREATE POLICY "allow_all_tables" ON restaurant_tables
FOR ALL
USING (true)
WITH CHECK (true);

-- ORDERS - Allow all operations
CREATE POLICY "allow_all_orders" ON orders
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- Verify policies were created
-- ============================================
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
