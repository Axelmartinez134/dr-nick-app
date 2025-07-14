-- Add Resistance Training Goals Feature
-- This migration adds goal tracking for resistance training days

-- 1. Add resistance training goal to profiles table (patient's target)
ALTER TABLE profiles ADD COLUMN resistance_training_days_goal INTEGER DEFAULT 0;
ALTER TABLE profiles ADD CONSTRAINT check_resistance_goal CHECK (resistance_training_days_goal >= 0 AND resistance_training_days_goal <= 7);

-- 2. Ensure resistance_training_days exists in health_data table (for weekly actual data)
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS resistance_training_days INTEGER;
ALTER TABLE health_data ADD CONSTRAINT IF NOT EXISTS check_resistance_days CHECK (resistance_training_days >= 0 AND resistance_training_days <= 7);

-- 3. Add helpful comments
COMMENT ON COLUMN profiles.resistance_training_days_goal IS 'Patient goal for resistance training days per week (0-7) - set by Dr. Nick';
COMMENT ON COLUMN health_data.resistance_training_days IS 'Actual resistance training days completed this week (0-7) - entered by patient';

-- 4. Set default goals for existing patients (optional - can be updated by Dr. Nick)
UPDATE profiles SET resistance_training_days_goal = 0 WHERE resistance_training_days_goal IS NULL; 