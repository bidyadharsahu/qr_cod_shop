-- Add optional owner phone support for tenant profiles (safe for existing deployments)
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS owner_phone TEXT;
