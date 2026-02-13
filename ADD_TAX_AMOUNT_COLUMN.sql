-- ============================================
-- ADD TAX_AMOUNT COLUMN TO ORDERS TABLE
-- ============================================
-- Run this SQL in your Supabase SQL Editor to fix the database error
-- This adds the missing tax_amount column that's causing order insertion failures
-- ============================================

-- Add tax_amount column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add rating column if it doesn't exist (for customer feedback)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- Update existing orders to calculate tax_amount (3% of subtotal + tip)
UPDATE orders 
SET tax_amount = ROUND((subtotal + tip_amount) * 0.03, 2)
WHERE tax_amount = 0 OR tax_amount IS NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('tax_amount', 'rating', 'subtotal', 'tip_amount', 'total')
ORDER BY column_name;
