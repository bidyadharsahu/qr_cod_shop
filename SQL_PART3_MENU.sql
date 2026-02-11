-- PART 3: Add Menu Items (Run this THIRD)
-- =============================================

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

SELECT 'Part 3 complete - Menu items added!' as status;
