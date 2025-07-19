-- INSERT Patient Data: Weeks 1-3 for Radka Mikulova
-- Patient ID: 047caf3d-1ca4-4a2c-9fd7-33a172ccf933
-- Email: radka.mikulova@gmail.com
-- Source: Screenshot data table with same column mapping

-- Week 1: 6/30/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '047caf3d-1ca4-4a2c-9fd7-33a172ccf933', 1, '2025-06-30', 75.4, 89.100,
  2, 7, NULL, 0, 1, -- hunger_days = 1 from "Days of hunger: 1/7 days"
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
  '047caf3d-1ca4-4a2c-9fd7-33a172ccf933', 2, '2025-07-07', 74.7, 87.400,
  5, 7, NULL, 0, 0, -- hunger_days = 0 from "Days of hunger: 0/7 days"
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
  '047caf3d-1ca4-4a2c-9fd7-33a172ccf933', 3, '2025-07-14', 74.2, 86.300,
  6, 7, NULL, 0, 2, -- hunger_days = 2 from "Days of hunger: 2/7 days"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Verify the insertions for Radka
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
WHERE user_id = '047caf3d-1ca4-4a2c-9fd7-33a172ccf933' 
  AND week_number BETWEEN 1 AND 3
ORDER BY week_number; 