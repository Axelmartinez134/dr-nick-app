-- INSERT Patient Data from Data/Meredith.csv (Weeks 1+)
-- User ID: 2e94ac88-d018-4ee0-8d62-6a0ff958ded2
-- Rules applied:
-- - nutrition_compliance_days = round(csv_value * 7) clamp 0–7
-- - purposeful_exercise_days = round((hrt_fraction * 105) / 60) clamp 0–7 (NULL if blank)
-- - poor_recovery_days = round(recovery_fraction * 7) or parse 'X/7'
-- - hunger_days parsed from Notes: handles 'Hunger: X/7', 'Hungry X/7 days', 'X/7 Days Hunger'
-- - resistance_training_days kept NULL
-- - sleep_consistency_score left NULL (not available directly)
-- - notes left NULL
-- - data_entered_by = 'dr_nick', needs_review = FALSE

-- Week 1: 2024-04-01
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 1, '2024-04-01', 181.5, 40.750,
  3, 2,
  0, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 2: 2024-04-08
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 2, '2024-04-08', 179, 40.438,
  0, 2,
  0, 2,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 3: 2024-04-15
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 3, '2024-04-15', 179, 38.220,
  3, 2,
  0, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 4: 2024-04-22
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 4, '2024-04-22', 175.5, 38.260,
  4, 2,
  0, 1,
  25.93, 31.13,
  'dr_nick', FALSE
);

-- Week 5: 2024-04-29
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 5, '2024-04-29', 174, 38.140,
  1, 2,
  1, 1,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 6: 2024-05-06
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 6, '2024-05-06', 173, 37.870,
  3, 2,
  2, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 7: 2024-05-13
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 7, '2024-05-13', 172.5, 37.750,
  7, 3,
  1, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 8: 2024-05-20
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 8, '2024-05-20', 171.5, 37.630,
  4, 2,
  0, 0,
  12.50, 30.14,
  'dr_nick', FALSE
);

-- Week 9: 2024-05-27
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 9, '2024-05-27', 170, 36.850,
  5, 2,
  0, 1,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 10: 2024-06-03
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 10, '2024-06-03', 168.5, 37.120,
  7, 2,
  0, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 11: 2024-06-10
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 11, '2024-06-10', 166.5, 36.450,
  4, 2,
  0, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 12: 2024-06-17
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 12, '2024-06-17', 164, 36.720,
  5, 2,
  3, 2,
  88.46, NULL,
  'dr_nick', FALSE
);

-- Week 13: 2024-06-24
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 13, '2024-06-24', 162.5, 35.820,
  3, 2,
  1, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 14: 2024-07-01
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 14, '2024-07-01', 161, 35.350,
  6, 2,
  0, 1,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 15: 2024-07-08
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 15, '2024-07-08', 162.5, 35.620,
  5, 2,
  0, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 16: 2024-07-15
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '2e94ac88-d018-4ee0-8d62-6a0ff958ded2', 16, '2024-07-15', 160, 35.110,
  6, 2,
  0, 4,
  82.14, NULL,
  'dr_nick', FALSE
);

-- Verify rows inserted for this user
SELECT week_number, date, weight, waist, nutrition_compliance_days, purposeful_exercise_days, poor_recovery_days, hunger_days, morning_fat_burn_percent, body_fat_percentage
FROM health_data
WHERE user_id = '2e94ac88-d018-4ee0-8d62-6a0ff958ded2'
ORDER BY week_number;





