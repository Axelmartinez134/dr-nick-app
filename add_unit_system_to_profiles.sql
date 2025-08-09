-- Add unit_system to profiles table with default and check constraint, and backfill existing rows

-- 1) Add column with default 'imperial'
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS unit_system TEXT NOT NULL DEFAULT 'imperial';

-- 2) Constrain values to 'imperial' or 'metric'
ALTER TABLE profiles
ADD CONSTRAINT profiles_unit_system_check
CHECK (unit_system IN ('imperial', 'metric'));

-- 3) Backfill existing rows to 'imperial'
UPDATE profiles SET unit_system = 'imperial' WHERE unit_system IS NULL;

-- 4) Optional: index for filtering by unit_system
CREATE INDEX IF NOT EXISTS idx_profiles_unit_system ON profiles (unit_system);


