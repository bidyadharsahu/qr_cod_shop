-- Add optional image URL support for menu cards (safe for existing deployments)
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS image_url TEXT;
