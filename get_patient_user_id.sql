-- Helper script to find patient user_id for bulk insert
-- Run this first to get the user_id, then use it in the bulk_insert_14_weeks.sql script

-- Method 1: Find by email address
SELECT 
    profiles.id as user_id,
    profiles.email,
    profiles.full_name,
    profiles.created_at
FROM profiles 
WHERE profiles.email = 'PATIENT_EMAIL_HERE';

-- Method 2: List all patients (if you need to see all options)
SELECT 
    profiles.id as user_id,
    profiles.email,
    profiles.full_name,
    profiles.created_at,
    -- Count existing health data entries
    (SELECT COUNT(*) FROM health_data WHERE health_data.user_id = profiles.id) as existing_entries
FROM profiles 
ORDER BY profiles.created_at DESC;

-- Method 3: Find patient with existing Week 0 data (baseline)
SELECT 
    profiles.id as user_id,
    profiles.email,
    profiles.full_name,
    health_data.week_number,
    health_data.weight as baseline_weight,
    health_data.waist as baseline_waist,
    health_data.date as baseline_date
FROM profiles 
JOIN health_data ON profiles.id = health_data.user_id
WHERE health_data.week_number = 0
ORDER BY health_data.created_at DESC;

-- Method 4: Check if patient already has data for weeks 1-14 (to avoid duplicates)
SELECT 
    profiles.full_name,
    health_data.week_number,
    health_data.weight,
    health_data.waist,
    health_data.date
FROM profiles 
JOIN health_data ON profiles.id = health_data.user_id
WHERE profiles.id = 'PATIENT_USER_ID_HERE' 
AND health_data.week_number BETWEEN 1 AND 14
ORDER BY health_data.week_number;

-- INSTRUCTIONS:
-- 1. Replace 'PATIENT_EMAIL_HERE' in Method 1 with the actual patient email
-- 2. Use Method 2 to see all patients if you're unsure
-- 3. Use Method 3 to find patients with Week 0 baseline data
-- 4. Use Method 4 to check for existing data before running the bulk insert
-- 5. Copy the user_id from the results and use it in bulk_insert_14_weeks.sql 