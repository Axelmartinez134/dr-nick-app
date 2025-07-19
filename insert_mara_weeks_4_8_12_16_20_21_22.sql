-- INSERT Patient Data: Weeks 4, 8, 12, 16, 20, 21, 22 for Mara Jones
-- Patient ID: 431d73e9-90e2-4bba-b772-02ad1705f9a5
-- Email: mara.healthyways@gmail.com
-- Source: Screenshot data table with same column mapping

-- Week 4: 3/3/25 (Limited data - mostly empty row)
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 4, '2025-03-03', NULL, NULL,
  NULL, NULL, 77.00, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 8: 3/31/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 8, '2025-03-31', 77, 84.600,
  3, 7, 77.00, 0, 1, -- hunger_days = 1 from "1/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 12: 4/28/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 12, '2025-04-28', 76.8, 83.700,
  4, 6, 81.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 16: 5/27/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 16, '2025-05-27', 75.1, 85.100,
  3, 6, 75.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 20: 6/23/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 20, '2025-06-23', 74.3, 84.400,
  3, 5, 79.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 21: 6/30/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 21, '2025-06-30', 74.2, 84.200,
  3, 5, 84.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 22: 7/7/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 22, '2025-07-07', 72.5, 83.900,
  5, 6, 75.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Verify the insertions for Mara
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
WHERE user_id = '431d73e9-90e2-4bba-b772-02ad1705f9a5' 
  AND week_number IN (4, 8, 12, 16, 20, 21, 22)
ORDER BY week_number; 