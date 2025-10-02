-- INSERT Patient Data from data/axel.csv (Weeks 1+)
-- User ID: 06da3c46-a8a2-4712-bfbd-c1e980f45e0d
-- Rules applied:
-- - nutrition_compliance_days = round(csv_value * 7) clamp 0–7
-- - purposeful_exercise_days = round((hrt_fraction * 80) / 60) clamp 0–7 (NULL if blank)
-- - poor_recovery_days = round(recovery_fraction * 7) or parse 'X/7'
-- - hunger_days parsed from Notes: 'Hunger: X/7' or 'X/7 Days Hunger'
-- - resistance_training_days kept NULL
-- - sleep_consistency_score left NULL (not available directly)
-- - notes left NULL
-- - data_entered_by = 'dr_nick', needs_review = FALSE

-- Week 1: 2023-05-22
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 1, '2023-05-22', 185.4, 35.700,
  0, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 2: 2023-05-29
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 2, '2023-05-29', 182, 35.600,
  3, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 3: 2023-06-05
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 3, '2023-06-05', 179.5, 35.600,
  4, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 4: 2023-06-12
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 4, '2023-06-12', 179, 34.700,
  2, NULL,
  NULL, NULL,
  18.75, NULL,
  'dr_nick', FALSE
);

-- Week 5: 2023-06-19
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 5, '2023-06-19', 180.1, 34.600,
  4, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 6: 2023-06-26
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 6, '2023-06-26', 176, 34.300,
  4, NULL,
  3, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 7: 2023-07-03
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 7, '2023-07-03', 175.1, 33.800,
  0, NULL,
  1, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 8: 2023-07-10
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 8, '2023-07-10', 173.8, 33.800,
  0, NULL,
  1, NULL,
  26.67, NULL,
  'dr_nick', FALSE
);

-- Week 9: 2023-07-17
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 9, '2023-07-17', 173.8, 33.100,
  0, NULL,
  1, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 10: 2023-07-24
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 10, '2023-07-24', 173.8, 33.300,
  0, NULL,
  2, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 11: 2023-07-31
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 11, '2023-07-31', 174, 33.500,
  0, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 12: 2023-08-07
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 12, '2023-08-07', 170.3, 32.900,
  1, NULL,
  1, NULL,
  23.08, 19.15,
  'dr_nick', FALSE
);

-- Week 13: 2023-08-14
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 13, '2023-08-14', 170, 32.500,
  1, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 14: 2023-08-21
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 14, '2023-08-21', 169.5, 32.450,
  0, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 15: 2023-08-28
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 15, '2023-08-28', 171.8, 33.100,
  0, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 16: 2023-09-04
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 16, '2023-09-04', 169, 33.180,
  1, NULL,
  0, 2,
  53.13, NULL,
  'dr_nick', FALSE
);

-- Week 17: 2023-09-11
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 17, '2023-09-11', 172, 32.500,
  1, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 18: 2023-09-18
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 18, '2023-09-18', 170.5, 33.600,
  1, NULL,
  0, 3,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 19: 2023-09-25
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 19, '2023-09-25', 170.6, 33.400,
  0, NULL,
  1, 0,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 20: 2023-10-02
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 20, '2023-10-02', 170, 33.400,
  2, NULL,
  2, 0,
  34.38, NULL,
  'dr_nick', FALSE
);

-- Week 21: 2023-10-09
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 21, '2023-10-09', 169.4, 33.400,
  5, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 22: 2023-10-16
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 22, '2023-10-16', 167.9, 33.350,
  3, NULL,
  0, NULL,
  34.38, NULL,
  'dr_nick', FALSE
);

-- Week 23: 2023-10-23
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 23, '2023-10-23', 167, 33.000,
  3, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 24: 2023-10-30
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 24, '2023-10-30', 169, 32.900,
  3, NULL,
  1, NULL,
  57.58, NULL,
  'dr_nick', FALSE
);

-- Week 25: 2023-11-06
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 25, '2023-11-06', 170, NULL,
  0, NULL,
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 26: 2023-11-13
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 26, '2023-11-13', 170, 32.840,
  4, NULL,
  0, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 27: 2023-11-20
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 27, '2023-11-20', 170, 32.830,
  1, NULL,
  0, NULL,
  57.58, 18.31,
  'dr_nick', FALSE
);

-- Week 28: 2023-11-27
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 28, '2023-11-27', 172.000, 33.050,
  0, NULL,
  1, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 29: 2023-12-05
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 29, '2023-12-05', 169.000, 32.770,
  4, NULL,
  1, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 30: 2023-12-11
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 30, '2023-12-11', 168.500, 32.700,
  2, NULL,
  1, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 31: 2023-12-18
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent, body_fat_percentage,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 31, '2023-12-18', 167, 32.130,
  1, 0,
  1, NULL,
  40.63, NULL,
  'dr_nick', FALSE
);

-- Week 32: 2023-12-25 (limited data)
INSERT INTO health_data (
  user_id, week_number, date,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 32, '2023-12-25',
  NULL, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);

-- Week 33: 2024-01-01
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 33, '2024-01-01', 169, 33.000,
  1, 3,
  0, 0,
  'dr_nick', FALSE
);

-- Week 34: 2024-01-08
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 34, '2024-01-08', 165.5, 33.000,
  2, 2,
  0, NULL,
  'dr_nick', FALSE
);

-- Week 35: 2024-01-15
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 35, '2024-01-15', 165, 32.350,
  NULL, NULL,
  0, NULL,
  'dr_nick', FALSE
);

-- Week 36: 2024-01-22
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 36, '2024-01-22', 162, 31.950,
  1, 1,
  1, NULL,
  45.16,
  'dr_nick', FALSE
);

-- Week 37: 2024-01-29
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 37, '2024-01-29', 160, 30.720,
  4, 1,
  1, 0,
  'dr_nick', FALSE
);

-- Week 38: 2024-02-05 (limited data)
INSERT INTO health_data (
  user_id, week_number, date,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 38, '2024-02-05',
  'dr_nick', FALSE
);

-- Week 39: 2024-02-12
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 39, '2024-02-12', 162.5, 31.520,
  0, 0,
  1, 0,
  'dr_nick', FALSE
);

-- Week 40: 2024-02-19
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  morning_fat_burn_percent,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 40, '2024-02-19', 160.9, 31.200,
  1, 2,
  1, 0,
  70.59,
  'dr_nick', FALSE
);

-- Week 41: 2024-02-26
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  '06da3c46-a8a2-4712-bfbd-c1e980f45e0d', 41, '2024-02-26', 162, 31.200,
  2, 0,
  0, 0,
  'dr_nick', FALSE
);

-- Verify rows inserted for this user
SELECT week_number, date, weight, waist, nutrition_compliance_days, purposeful_exercise_days, poor_recovery_days, hunger_days, morning_fat_burn_percent
FROM health_data
WHERE user_id = '06da3c46-a8a2-4712-bfbd-c1e980f45e0d'
ORDER BY week_number;
