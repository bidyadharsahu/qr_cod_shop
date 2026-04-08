-- Add optional image URL support for menu cards (safe for existing deployments)
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add optional owner phone support for tenant profiles
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS owner_phone TEXT;
