-- ============================================
-- COASIS RESTAURANT BAR & SUITES - MENU ITEMS
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Clear existing menu items (optional - comment out if you want to keep old items)
DELETE FROM menu_items;

-- ======== APPETIZERS ========
INSERT INTO menu_items (name, price, category, available) VALUES
  ('Chargrilled Oysters', 18.00, 'Appetizers', true),
  ('Crab Fried Rice', 15.00, 'Appetizers', true),
  ('Blue Cheese Buffalo Wings', 14.00, 'Appetizers', true),
  ('Crispy Chilli Garlic Shrimp', 14.00, 'Appetizers', true),
  ('Fried Lobster Bites', 32.00, 'Appetizers', true),
  ('Steak & Cheese Egg Rolls', 14.00, 'Appetizers', true),
  ('Cajun Seafood Dip', 18.00, 'Appetizers', true)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  available = EXCLUDED.available;

-- ======== SALADS ========
INSERT INTO menu_items (name, price, category, available) VALUES
  ('Grilled Caesar Salad', 14.00, 'Salads', true),
  ('Coasis House Salad', 14.00, 'Salads', true)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  available = EXCLUDED.available;

-- ======== MAIN DISHES ========
INSERT INTO menu_items (name, price, category, available) VALUES
  ('Strip Steak', 30.00, 'Mains', true),
  ('Marinated Lambchops', 42.00, 'Mains', true),
  ('Airline Chicken Breast', 26.00, 'Mains', true),
  ('Southern Fried Chicken', 28.00, 'Mains', true),
  ('Grilled or Fried Branzino', 34.00, 'Mains', true),
  ('Salmon & Crab Fried Rice', 38.00, 'Mains', true),
  ('Lobster & Crab Fried Rice', 42.00, 'Mains', true),
  ('Seafood Trio', 42.00, 'Mains', true),
  ('Garlic Alfredo Pasta', 22.00, 'Mains', true)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  available = EXCLUDED.available;

-- ======== SANDWICHES ========
INSERT INTO menu_items (name, price, category, available) VALUES
  ('Salmon Sandwich', 22.00, 'Sandwiches', true),
  ('Coasis Burger', 18.00, 'Sandwiches', true)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  available = EXCLUDED.available;

-- ======== DESSERTS ========
INSERT INTO menu_items (name, price, category, available) VALUES
  ('Dessert Special', 10.00, 'Desserts', true)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  available = EXCLUDED.available;

-- Verify inserted items
SELECT * FROM menu_items ORDER BY category, name;
