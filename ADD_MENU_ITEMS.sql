-- Menu Items for netrikxr.shop
-- Run this SQL in your Supabase SQL Editor

-- First, clear existing menu items (optional - comment out if you want to keep existing items)
-- DELETE FROM menu_items;

-- Insert new menu items
INSERT INTO menu_items (name, description, price, category, available) VALUES
  ('Long Island', 'Classic Long Island Iced Tea cocktail', 11.00, 'Cocktails', true),
  ('Lemon Drop', 'Sweet and sour lemon martini', 8.00, 'Cocktails', true),
  ('Patron', 'Premium Patron tequila shot', 12.00, 'Spirits', true),
  ('Hennessy', 'Hennessy VS cognac', 12.00, 'Spirits', true),
  ('Corona', 'Corona Extra beer', 5.00, 'Beer', true),
  ('Bud Light', 'Bud Light lager', 5.00, 'Beer', true),
  ('Crown Apple', 'Crown Royal Apple whisky', 9.00, 'Spirits', true),
  ('Smirnoff', 'Smirnoff vodka', 6.00, 'Spirits', true),
  ('Budweiser', 'Budweiser lager beer', 6.00, 'Beer', true)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  available = EXCLUDED.available;

-- Verify inserted items
SELECT * FROM menu_items ORDER BY category, name;
