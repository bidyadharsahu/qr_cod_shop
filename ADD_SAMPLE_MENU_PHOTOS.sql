-- Populate free stock photos for existing menu items (safe: only fills empty image_url)
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE menu_items
SET image_url = CASE
  WHEN lower(name) LIKE '%oyster%' THEN 'https://images.unsplash.com/photo-1625943553852-781c6dd46faa?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%shrimp%' THEN 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%lobster%' THEN 'https://images.unsplash.com/photo-1625944525533-473f1b7d8ff9?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%steak%' THEN 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%lamb%' THEN 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%salmon%' THEN 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%chicken%' THEN 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%salad%' THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80'
  WHEN lower(name) LIKE '%burger%' THEN 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80'
  WHEN lower(category) LIKE '%appetizer%' THEN 'https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=900&q=80'
  WHEN lower(category) LIKE '%salad%' THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80'
  WHEN lower(category) LIKE '%main%' THEN 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80'
  WHEN lower(category) LIKE '%sandwich%' THEN 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=900&q=80'
  WHEN lower(category) LIKE '%dessert%' THEN 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80'
  ELSE 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80'
END
WHERE image_url IS NULL OR trim(image_url) = '';
