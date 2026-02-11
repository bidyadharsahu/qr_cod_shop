-- ============================================
-- FIX RLS POLICIES - Run this in Supabase SQL Editor
-- ============================================
-- This fixes the issue where anon users can't insert/update data

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin can insert menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can update menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can delete menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can insert tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can update tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can delete tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON orders;

-- Create permissive policies for menu_items
CREATE POLICY "Anyone can insert menu" ON menu_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update menu" ON menu_items
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete menu" ON menu_items
  FOR DELETE USING (true);

-- Create permissive policies for restaurant_tables
CREATE POLICY "Anyone can insert tables" ON restaurant_tables
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update tables" ON restaurant_tables
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete tables" ON restaurant_tables
  FOR DELETE USING (true);

-- Create permissive policies for orders
CREATE POLICY "Anyone can update orders" ON orders
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete orders" ON orders
  FOR DELETE USING (true);
