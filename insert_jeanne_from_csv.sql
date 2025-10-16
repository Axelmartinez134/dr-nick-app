-- INSERT Patient Data from data/Jeanne.csv (Weeks 1+)
-- User ID: d4d63f0e-fb44-4f09-bdb2-53011c411533
-- Rules applied:
-- - nutrition_compliance_days = round(csv_value * 7) clamp 0–7
-- - purposeful_exercise_days = NULL (no column provided)
-- - poor_recovery_days = NULL (no column provided)
-- - hunger_days parsed from Notes: handles 'Hunger: X/7', 'Hungry X/7 days', 'X/7 Days Hunger' (none present in this CSV)
-- - resistance_training_days kept NULL
-- - sleep_consistency_score left NULL (not available directly)
-- - notes left NULL
-- - data_entered_by = 'dr_nick', needs_review = FALSE
-- - 'N/A' or blank treated as NULL

-- Week 1: 2022-09-26
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 1, '2022-09-26', 150.6, 35.000,
  4, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 2: 2022-10-03
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 2, '2022-10-03', 149.4, 35.000,
  1, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 3: 2022-10-10
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 3, '2022-10-10', 149.6, 34.000,
  2, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 4: 2022-10-17
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 4, '2022-10-17', 148.6, 33.500,
  7, NULL,
  NULL, NULL,
  25.00, NULL,
  'dr_nick', FALSE
);

-- Week 5: 2022-10-24
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 5, '2022-10-24', 147.6, 33.250,
  1, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 6: 2022-10-31
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 6, '2022-10-31', 146.8, 32.940,
  6, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 7: 2022-11-07
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 7, '2022-11-07', 146.4, 33.380,
  4, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 8: 2022-11-14
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 8, '2022-11-14', 146.8, 33.140,
  7, NULL,
  NULL, NULL,
  41.86, 34.80,
  'dr_nick', FALSE
);

-- Week 9: 2022-11-21
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 9, '2022-11-21', 145.6, 33.320,
  0, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 10: 2022-11-28
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 10, '2022-11-28', 144.8, 32.920,
  0, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 11: 2022-12-05
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 11, '2022-12-05', 146.6, 32.770,
  1, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 12: 2022-12-12 (limited data)
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 12, '2022-12-12', NULL, NULL,
  NULL, NULL,
  NULL, NULL,
  80.63, NULL,
  'dr_nick', FALSE
);

-- Week 13: 2022-12-19
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 13, '2022-12-19', 145.2, 32.550,
  0, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 14: 2022-12-26
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 14, '2022-12-26', 145, 32.750,
  0, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 15: 2023-01-02
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 15, '2023-01-02', 144, 32.650,
  2, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 16: 2023-01-09
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 16, '2023-01-09', 142.8, 32.330,
  2, NULL,
  NULL, NULL,
  75.00, NULL,
  'dr_nick', FALSE
);

-- Week 17: 2023-01-16
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 17, '2023-01-16', 142.8, 32.070,
  2, NULL,
  NULL, NULL,
  NULL, 33.50,
  'dr_nick', FALSE
);

-- Week 18: 2023-01-23
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 18, '2023-01-23', 142, 31.780,
  1, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 19: 2023-01-30
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 19, '2023-01-30', 142.8, 31.240,
  0, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 20: 2023-02-06
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 20, '2023-02-06', 142.4, 31.800,
  2, NULL,
  NULL, NULL,
  96.88, 33.50,
  'dr_nick', FALSE
);

-- Week 21: 2023-02-13
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 21, '2023-02-13', 141.8, 30.720,
  1, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 22: 2023-02-20
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 22, '2023-02-20', 142.8, 30.780,
  1, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 23: 2023-02-27
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 23, '2023-02-27', 141.6, 30.860,
  2, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 24: 2023-03-07 (limited data)
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  'd4d63f0e-fb44-4f09-bdb2-53011c411533', 24, '2023-03-07', NULL, NULL,
  NULL, NULL,
  NULL, NULL,
  NULL, 33.20,
  'dr_nick', FALSE
);

-- Verify rows inserted for this user
SELECT week_number, date, weight, waist, nutrition_compliance_days, purposeful_exercise_days, poor_recovery_days, hunger_days, morning_fat_burn_percent, body_fat_percentage
FROM health_data
WHERE user_id = 'd4d63f0e-fb44-4f09-bdb2-53011c411533'
ORDER BY week_number;


