-- PART 1: Fix RLS Policies (Run this FIRST)
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public can read menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can insert menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can update menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can delete menu" ON menu_items;
DROP POLICY IF EXISTS "Anyone can insert menu" ON menu_items;
DROP POLICY IF EXISTS "Anyone can update menu" ON menu_items;
DROP POLICY IF EXISTS "Anyone can delete menu" ON menu_items;
DROP POLICY IF EXISTS "menu_select" ON menu_items;
DROP POLICY IF EXISTS "menu_insert" ON menu_items;
DROP POLICY IF EXISTS "menu_update" ON menu_items;
DROP POLICY IF EXISTS "menu_delete" ON menu_items;

DROP POLICY IF EXISTS "Public can read tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can insert tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can update tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can delete tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Anyone can insert tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Anyone can update tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Anyone can delete tables" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_select" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_insert" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_update" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_delete" ON restaurant_tables;

DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can delete orders" ON orders;
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "orders_delete" ON orders;

-- Create new permissive policies
CREATE POLICY "allow_all_select" ON menu_items FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON menu_items FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON menu_items FOR DELETE USING (true);

CREATE POLICY "allow_all_select" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON restaurant_tables FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON restaurant_tables FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON restaurant_tables FOR DELETE USING (true);

CREATE POLICY "allow_all_select" ON orders FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON orders FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON orders FOR DELETE USING (true);

SELECT 'Part 1 complete - RLS policies fixed!' as status;
