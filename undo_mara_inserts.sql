-- UNDO: Delete Mara's records that were just inserted
-- Patient ID: 431d73e9-90e2-4bba-b772-02ad1705f9a5
-- This will remove weeks 4, 8, 12, 16, 20, 21, 22 that were just added

-- First, let's see what we're about to delete (optional - run this first to verify)
SELECT 
  week_number,
  date,
  weight,
  waist,
  nutrition_compliance_days,
  purposeful_exercise_days,
  sleep_consistency_score,
  poor_recovery_days,
  hunger_days,
  created_at,
  data_entered_by
FROM health_data 
WHERE user_id = '431d73e9-90e2-4bba-b772-02ad1705f9a5' 
  AND week_number IN (4, 8, 12, 16, 20, 21, 22)
  AND data_entered_by = 'dr_nick'
ORDER BY week_number;

-- Now delete the records we just inserted
DELETE FROM health_data 
WHERE user_id = '431d73e9-90e2-4bba-b772-02ad1705f9a5' 
  AND week_number IN (4, 8, 12, 16, 20, 21, 22)
  AND data_entered_by = 'dr_nick';

-- Verify they're gone
SELECT 
  week_number,
  date,
  weight,
  created_at
FROM health_data 
WHERE user_id = '431d73e9-90e2-4bba-b772-02ad1705f9a5' 
ORDER BY week_number; 