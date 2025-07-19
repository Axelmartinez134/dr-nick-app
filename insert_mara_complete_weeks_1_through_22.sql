-- INSERT Patient Data: Weeks 1-22 for Mara Jones (COMPLETE DATA)
-- Patient ID: 431d73e9-90e2-4bba-b772-02ad1705f9a5
-- Email: mara.healthyways@gmail.com
-- Source: Complete screenshot data table with same column mapping

-- Week 1: 2/10/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 1, '2025-02-10', 79.8, 88.800,
  2, 7, 78.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 2: 2/17/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 2, '2025-02-17', 79.3, 87.900,
  5, 6, 69.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 3: 2/24/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 3, '2025-02-24', 78.8, 87.000,
  6, 6, 80.00, 0, 2, -- hunger_days = 2 from "2/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 4: 3/3/25
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
  0, 0, 77.00, NULL, NULL, -- No clear data for this week
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 5: 3/10/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 5, '2025-03-10', 78.2, 87.300,
  2, 4, 68.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 6: 3/17/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 6, '2025-03-17', 77.9, 87.200,
  6, 7, 81.00, 0, 3, -- hunger_days = 3 from "3/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 7: 3/24/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 7, '2025-03-24', 77.1, 85.000,
  5, 6, 82.00, 0, 3, -- hunger_days = 3 from "3/7 Days Of Hunger"
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

-- Week 9: 4/7/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 9, '2025-04-07', 78.8, 86.000,
  2, 7, 74.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 10: 4/14/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 10, '2025-04-14', 77, 85.000,
  6, 6, 86.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 11: 4/21/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 11, '2025-04-21', 76.1, 82.800,
  5, 5, 72.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
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

-- Week 13: 5/5/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 13, '2025-05-05', 75.4, 83.300,
  6, 5, 71.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 14: 5/12/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 14, '2025-05-12', 74.7, 83.300,
  5, 6, 83.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 15: 5/19/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 15, '2025-05-19', 75.6, 85.300,
  2, 3, 70.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
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

-- Week 17: 6/2/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 17, '2025-06-02', 74.6, 84.600,
  6, 6, 72.00, 0, 2, -- hunger_days = 2 from "2/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 18: 6/9/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 18, '2025-06-09', 74, 84.000,
  2, 4, 78.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'dr_nick', FALSE
);

-- Week 19: 6/16/25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days, 
  sleep_consistency_score, poor_recovery_days, hunger_days,
  notes, symptom_tracking_days, detailed_symptom_notes,
  energetic_constraints_reduction_ok, morning_fat_burn_percent, 
  body_fat_percentage, currently_not_in_use,
  data_entered_by, needs_review
) VALUES (
  '431d73e9-90e2-4bba-b772-02ad1705f9a5', 19, '2025-06-16', 76, 85.300,
  2, 2, 73.00, 0, 0, -- hunger_days = 0 from "0/7 Days Of Hunger"
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

-- Verify the insertions for Mara (Complete Dataset)
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
  AND week_number BETWEEN 1 AND 22
ORDER BY week_number; 