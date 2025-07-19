-- INSERT Patient Data: Weeks 1-3 for Teneshya Miller
-- Patient ID: decd8f7b-a2c1-4de9-a608-ed07be8a1146
-- Email: teneshya@icloud.com
-- Source: New screenshot data table with same column mapping as Areg

-- Week 1: 8/30/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  'decd8f7b-a2c1-4de9-a608-ed07be8a1146', 1, '2025-08-30', 287.5, 42.000,
  0, 0, NULL, 0, 0, -- hunger_days = 0 from "Days of hunger: 0/7 days"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 2: 7/7/25  
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  'decd8f7b-a2c1-4de9-a608-ed07be8a1146', 2, '2025-07-07', 291, 42.950,
  0, 0, NULL, 0, 0, -- hunger_days = 0 from "Days of hunger: 0/7 days"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 3: 7/14/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  'decd8f7b-a2c1-4de9-a608-ed07be8a1146', 3, '2025-07-14', 290, 42.540,
  5, 5, NULL, 0, 0, -- hunger_days = 0 from "Days of hunger: 0/7 days"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Verify the insertions for Teneshya
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
  created_at
FROM health_data 
WHERE user_id = 'decd8f7b-a2c1-4de9-a608-ed07be8a1146' 
  AND week_number BETWEEN 1 AND 3
ORDER BY week_number; 