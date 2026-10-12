-- Migration 005: Allow quantity_ml = 0 for "No Milk Taken (0 L)" entries
-- Drop old check constraint that enforced quantity_ml > 0
ALTER TABLE milk_entries DROP CONSTRAINT IF EXISTS milk_entries_quantity_ml_check;

-- Re-create check constraint allowing quantity_ml >= 0
ALTER TABLE milk_entries ADD CONSTRAINT milk_entries_quantity_ml_check CHECK (quantity_ml >= 0);
