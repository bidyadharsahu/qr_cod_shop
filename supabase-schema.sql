-- ============================================
-- NETRIKXR.SHOP - Supabase Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor
-- ============================================

-- 1. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  table_number INTEGER UNIQUE NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'booked', 'occupied')),
  current_order_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Orders Table
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

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- MENU ITEMS POLICIES
-- ===========================================
-- Anyone can read menu
CREATE POLICY "menu_select" ON menu_items FOR SELECT USING (true);
-- Authenticated users can insert
CREATE POLICY "menu_insert" ON menu_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Authenticated users can update
CREATE POLICY "menu_update" ON menu_items FOR UPDATE USING (auth.role() = 'authenticated');
-- Authenticated users can delete
CREATE POLICY "menu_delete" ON menu_items FOR DELETE USING (auth.role() = 'authenticated');

-- ===========================================
-- RESTAURANT TABLES POLICIES
-- ===========================================
-- Anyone can read tables
CREATE POLICY "tables_select" ON restaurant_tables FOR SELECT USING (true);
-- Authenticated users can insert
CREATE POLICY "tables_insert" ON restaurant_tables FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Authenticated users can update
CREATE POLICY "tables_update" ON restaurant_tables FOR UPDATE USING (auth.role() = 'authenticated');
-- Authenticated users can delete
CREATE POLICY "tables_delete" ON restaurant_tables FOR DELETE USING (auth.role() = 'authenticated');

-- ===========================================
-- ORDERS POLICIES
-- ===========================================
-- Anyone can read orders
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
-- Anyone can create orders (customers placing orders)
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
-- Authenticated users can update orders
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.role() = 'authenticated');
-- Authenticated users can delete orders
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ============================================
-- Default Data (use ON CONFLICT to avoid duplicates)
-- ============================================

-- Default Menu Items
INSERT INTO menu_items (name, price, category) VALUES
  ('Long Island Iced Tea', 11.00, 'Cocktails'),
  ('Lemon Drop Martini', 8.00, 'Cocktails'),
  ('Patron Tequila', 12.00, 'Premium'),
  ('Hennessy Cognac', 12.00, 'Premium'),
  ('Corona Extra', 5.00, 'Beer'),
  ('Bud Light', 5.00, 'Beer'),
  ('Crown Royal Apple', 9.00, 'Whiskey'),
  ('Smirnoff Vodka', 6.00, 'Vodka'),
  ('Budweiser', 6.00, 'Beer')
ON CONFLICT DO NOTHING;

-- Default Tables (1-10)
INSERT INTO restaurant_tables (table_number) VALUES
  (1), (2), (3), (4), (5), (6), (7), (8), (9), (10)
ON CONFLICT (table_number) DO NOTHING;
