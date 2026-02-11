-- =============================================
-- CLEANUP SCRIPT - Run this in Supabase SQL Editor
-- =============================================

-- 1. Add rating column to orders table (if not exists)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- 2. Delete ALL old orders (clean slate for real-time data only)
DELETE FROM orders;

-- 3. Reset restaurant_tables to available
UPDATE restaurant_tables SET status = 'available', current_order_id = NULL;

-- 4. Delete all menu items
DELETE FROM menu_items;

-- 5. Insert ONLY the 10 menu items you specified
INSERT INTO menu_items (name, price, category, available) VALUES ('Long Island Iced Tea', 11.00, 'Cocktails', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Mojito', 9.00, 'Cocktails', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Margarita', 10.00, 'Cocktails', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Patron Tequila', 12.00, 'Premium', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Hennessy Cognac', 14.00, 'Premium', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Corona Extra', 5.00, 'Beer', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Bud Light', 4.00, 'Beer', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Heineken', 5.00, 'Beer', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Jack Daniels', 8.00, 'Whiskey', true);
INSERT INTO menu_items (name, price, category, available) VALUES ('Crown Royal', 9.00, 'Whiskey', true);

SELECT 'Cleanup complete! Old data removed, menu reset.' as status;
