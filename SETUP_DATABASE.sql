-- ============================================
-- NETRIKXR.SHOP - COMPLETE DATABASE SETUP
-- ============================================
-- Run this ENTIRE script in Supabase SQL Editor
-- This will reset and configure everything properly
-- ============================================

-- Step 1: Drop existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Public can read menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can insert menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can update menu" ON menu_items;
DROP POLICY IF EXISTS "Admin can delete menu" ON menu_items;
DROP POLICY IF EXISTS "Anyone can insert menu" ON menu_items;
DROP POLICY IF EXISTS "Anyone can update menu" ON menu_items;
DROP POLICY IF EXISTS "Anyone can delete menu" ON menu_items;

DROP POLICY IF EXISTS "Public can read tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can insert tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can update tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin can delete tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Anyone can insert tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Anyone can update tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Anyone can delete tables" ON restaurant_tables;

DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can delete orders" ON orders;

-- Step 2: Create tables if they don't exist
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  table_number INTEGER UNIQUE NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'booked', 'occupied')),
  current_order_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  receipt_id TEXT UNIQUE NOT NULL,
  table_number INTEGER NOT NULL,
  items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'served', 'paid', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('card', 'cash', 'online') OR payment_method IS NULL),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  payment_type TEXT CHECK (payment_type IN ('direct_cash', 'chatbot_payment') OR payment_type IS NULL),
  transaction_id TEXT,
  customer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Step 4: Create FULLY PERMISSIVE policies (allow everything)
-- Menu Items
CREATE POLICY "menu_select" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_insert" ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "menu_update" ON menu_items FOR UPDATE USING (true);
CREATE POLICY "menu_delete" ON menu_items FOR DELETE USING (true);

-- Restaurant Tables
CREATE POLICY "tables_select" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "tables_insert" ON restaurant_tables FOR INSERT WITH CHECK (true);
CREATE POLICY "tables_update" ON restaurant_tables FOR UPDATE USING (true);
CREATE POLICY "tables_delete" ON restaurant_tables FOR DELETE USING (true);

-- Orders
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (true);
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (true);

-- Step 5: Enable Realtime (ignore errors if already enabled)
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

-- Step 6: Insert default data (only if tables are empty)
INSERT INTO restaurant_tables (table_number) 
SELECT gs FROM generate_series(1, 10) AS gs
WHERE NOT EXISTS (SELECT 1 FROM restaurant_tables LIMIT 1);

INSERT INTO menu_items (name, price, category) 
SELECT * FROM (VALUES
  ('Long Island Iced Tea', 11.00::DECIMAL, 'Cocktails'),
  ('Mojito', 9.00::DECIMAL, 'Cocktails'),
  ('Margarita', 10.00::DECIMAL, 'Cocktails'),
  ('Patron Tequila', 12.00::DECIMAL, 'Premium'),
  ('Hennessy Cognac', 14.00::DECIMAL, 'Premium'),
  ('Corona Extra', 5.00::DECIMAL, 'Beer'),
  ('Bud Light', 4.00::DECIMAL, 'Beer'),
  ('Heineken', 5.00::DECIMAL, 'Beer'),
  ('Jack Daniels', 8.00::DECIMAL, 'Whiskey'),
  ('Crown Royal', 9.00::DECIMAL, 'Whiskey')
) AS v(name, price, category)
WHERE NOT EXISTS (SELECT 1 FROM menu_items LIMIT 1);

-- Done! Your database is now ready.
SELECT 'Database setup complete!' as status;
