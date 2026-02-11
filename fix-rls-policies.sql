-- ============================================
-- FIX RLS POLICIES - Run this in Supabase SQL Editor
-- This fixes the "violates row-level security policy" error
-- ============================================

-- Drop existing policies for menu_items
DROP POLICY IF EXISTS "Public can read menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can insert menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can update menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can delete menu" ON menu_items;
DROP POLICY IF EXISTS "menu_select" ON menu_items;
DROP POLICY IF EXISTS "menu_insert" ON menu_items;
DROP POLICY IF EXISTS "menu_update" ON menu_items;
DROP POLICY IF EXISTS "menu_delete" ON menu_items;

-- Drop existing policies for restaurant_tables
DROP POLICY IF EXISTS "Public can read tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can insert tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can update tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can delete tables" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_select" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_insert" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_update" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_delete" ON restaurant_tables;

-- Drop existing policies for orders
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON orders;
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "orders_delete" ON orders;

-- ===========================================
-- NEW MENU ITEMS POLICIES
-- ===========================================
CREATE POLICY "menu_select" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_insert" ON menu_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "menu_update" ON menu_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "menu_delete" ON menu_items FOR DELETE USING (auth.role() = 'authenticated');

-- ===========================================
-- NEW RESTAURANT TABLES POLICIES
-- ===========================================
CREATE POLICY "tables_select" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "tables_insert" ON restaurant_tables FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tables_update" ON restaurant_tables FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "tables_delete" ON restaurant_tables FOR DELETE USING (auth.role() = 'authenticated');

-- ===========================================
-- NEW ORDERS POLICIES
-- ===========================================
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- Verify policies were created
-- ============================================
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
