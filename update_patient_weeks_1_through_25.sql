-- UPDATE Patient Data: Weeks 1-25
-- Patient ID: 495205f7-fc9b-423e-8062-783e73e28ce0
-- Source: Screenshot data table with proper column mapping

-- Week 1: 1/27/25
UPDATE health_data 
SET 
  date = '2025-01-27',
  weight = 325.8,
  waist = 54.000,
  nutrition_compliance_days = 0,
  purposeful_exercise_days = 0,
  sleep_consistency_score = 70,
  poor_recovery_days = 1,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 1;

-- Week 2: 2/3/25
UPDATE health_data 
SET 
  date = '2025-02-03',
  weight = 330,
  waist = 54.000,
  nutrition_compliance_days = 3,
  purposeful_exercise_days = 6,
  sleep_consistency_score = 74,
  poor_recovery_days = 0,
  hunger_days = 2, -- Parsed from "2/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 2;

-- Week 3: 2/10/25
UPDATE health_data 
SET 
  date = '2025-02-10',
  weight = 323.4,
  waist = 54.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 4,
  sleep_consistency_score = 85,
  poor_recovery_days = 1,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 3;

-- Week 4: 2/17/25
UPDATE health_data 
SET 
  date = '2025-02-17',
  weight = 326.2,
  waist = 53.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 7,
  sleep_consistency_score = 70,
  poor_recovery_days = 1,
  hunger_days = 2, -- Parsed from "2/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 4;

-- Week 5: 2/24/25
UPDATE health_data 
SET 
  date = '2025-02-24',
  weight = 327.4,
  waist = 53.000,
  nutrition_compliance_days = 5,
  purposeful_exercise_days = 7,
  sleep_consistency_score = 70,
  poor_recovery_days = 0,
  hunger_days = 1, -- Parsed from "1/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 5;

-- Week 6: 3/3/25
UPDATE health_data 
SET 
  date = '2025-03-03',
  weight = 325.4,
  waist = 52.750,
  nutrition_compliance_days = 6,
  purposeful_exercise_days = 7,
  sleep_consistency_score = 69,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 6;

-- Week 7: 3/10/25
UPDATE health_data 
SET 
  date = '2025-03-10',
  weight = 323.6,
  waist = 53.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 3,
  sleep_consistency_score = 72,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 7;

-- Week 8: 3/17/25
UPDATE health_data 
SET 
  date = '2025-03-17',
  weight = 322.4,
  waist = 51.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 45,
  sleep_consistency_score = 59,
  poor_recovery_days = 0,
  hunger_days = 2, -- Parsed from "2/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 8;

-- Week 9: 3/24/25
UPDATE health_data 
SET 
  date = '2025-03-24',
  weight = NULL, -- No weight data in screenshot
  waist = NULL, -- No waist data in screenshot
  nutrition_compliance_days = 0,
  purposeful_exercise_days = 0,
  sleep_consistency_score = 48,
  poor_recovery_days = 0,
  hunger_days = NULL, -- No notes data in screenshot
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 9;

-- Week 10: 3/31/25
UPDATE health_data 
SET 
  date = '2025-03-31',
  weight = 329,
  waist = 50.000,
  nutrition_compliance_days = 4,
  purposeful_exercise_days = 2,
  sleep_consistency_score = 64,
  poor_recovery_days = 3,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 10;

-- Week 11: 4/7/25
UPDATE health_data 
SET 
  date = '2025-04-07',
  weight = 322.8,
  waist = 50.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 7,
  sleep_consistency_score = 61,
  poor_recovery_days = 2,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 11;

-- Week 12: 4/14/25
UPDATE health_data 
SET 
  date = '2025-04-14',
  weight = 321.6,
  waist = 50.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 7,
  sleep_consistency_score = 76,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 12;

-- Week 13: 4/21/25
UPDATE health_data 
SET 
  date = '2025-04-21',
  weight = 321,
  waist = 50.000,
  nutrition_compliance_days = 6,
  purposeful_exercise_days = 7,
  sleep_consistency_score = 73,
  poor_recovery_days = 1,
  hunger_days = 1, -- Parsed from "1/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 13;

-- Week 14: 4/28/25
UPDATE health_data 
SET 
  date = '2025-04-28',
  weight = 320.6,
  waist = 50.000,
  nutrition_compliance_days = 3,
  purposeful_exercise_days = 3,
  sleep_consistency_score = 67,
  poor_recovery_days = 1,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 14;

-- Week 15: 5/5/25
UPDATE health_data 
SET 
  date = '2025-05-05',
  weight = 323.4,
  waist = 50.000,
  nutrition_compliance_days = 0,
  purposeful_exercise_days = 0,
  sleep_consistency_score = 72,
  poor_recovery_days = 1,
  hunger_days = 1, -- Parsed from "1/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 15;

-- Week 16: 5/12/25
UPDATE health_data 
SET 
  date = '2025-05-12',
  weight = 317.4,
  waist = 50.000,
  nutrition_compliance_days = 6,
  purposeful_exercise_days = 3,
  sleep_consistency_score = 78,
  poor_recovery_days = 0,
  hunger_days = 1, -- Parsed from "1/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 16;

-- Week 17: 5/19/25
UPDATE health_data 
SET 
  date = '2025-05-19',
  weight = 314.2,
  waist = 50.000,
  nutrition_compliance_days = 1,
  purposeful_exercise_days = 2,
  sleep_consistency_score = 76,
  poor_recovery_days = 0,
  hunger_days = 1, -- Parsed from "1/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 17;

-- Week 18: 5/26/25
UPDATE health_data 
SET 
  date = '2025-05-26',
  weight = 308.8,
  waist = 40.000,
  nutrition_compliance_days = 2,
  purposeful_exercise_days = 3,
  sleep_consistency_score = 71,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 18;

-- Week 19: 6/2/25
UPDATE health_data 
SET 
  date = '2025-06-02',
  weight = 311.2,
  waist = 49.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 4,
  sleep_consistency_score = 42,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 19;

-- Week 20: 6/9/25
UPDATE health_data 
SET 
  date = '2025-06-09',
  weight = 311.8,
  waist = 48.500,
  nutrition_compliance_days = 5,
  purposeful_exercise_days = 3,
  sleep_consistency_score = 66,
  poor_recovery_days = 1,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 20;

-- Week 21: 6/16/25
UPDATE health_data 
SET 
  date = '2025-06-16',
  weight = 308.2,
  waist = 48.500,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 1,
  sleep_consistency_score = 50,
  poor_recovery_days = 4,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 21;

-- Week 22: 6/23/25
UPDATE health_data 
SET 
  date = '2025-06-23',
  weight = 310,
  waist = 48.000,
  nutrition_compliance_days = 7,
  purposeful_exercise_days = 0,
  sleep_consistency_score = 35,
  poor_recovery_days = 0,
  hunger_days = 1, -- Parsed from "1/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 22;

-- Week 23: 6/30/25
UPDATE health_data 
SET 
  date = '2025-06-30',
  weight = 301.6,
  waist = 48.000,
  nutrition_compliance_days = 6,
  purposeful_exercise_days = 5,
  sleep_consistency_score = 59,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 23;

-- Week 24: 7/7/25
UPDATE health_data 
SET 
  date = '2025-07-07',
  weight = 302.8,
  waist = 48.500,
  nutrition_compliance_days = 6,
  purposeful_exercise_days = 4,
  sleep_consistency_score = 78,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 24;

-- Week 25: 7/14/25
UPDATE health_data 
SET 
  date = '2025-07-14',
  weight = 303.8,
  waist = 48.000,
  nutrition_compliance_days = 3,
  purposeful_exercise_days = 5,
  sleep_consistency_score = 78,
  poor_recovery_days = 0,
  hunger_days = 0, -- Parsed from "0/7 Days Hunger"
  notes = NULL,
  symptom_tracking_days = NULL,
  detailed_symptom_notes = NULL,
  energetic_constraints_reduction_ok = NULL,
  morning_fat_burn_percent = NULL,
  body_fat_percentage = NULL,
  currently_not_in_use = NULL,
  data_entered_by = 'dr_nick',
  needs_review = FALSE,
  updated_at = NOW()
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' AND week_number = 25;

-- Verify the updates
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
  updated_at
FROM health_data 
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0' 
  AND week_number BETWEEN 1 AND 25
ORDER BY week_number; 