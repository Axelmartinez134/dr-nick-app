-- 1. Check health_data table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'health_data'
ORDER BY ordinal_position;

-- 2. Check what data currently exists for this patient
SELECT 
    week_number,
    date,
    weight,
    waist,
    data_entered_by,
    created_at
FROM health_data 
WHERE user_id = '495205f7-fc9b-423e-8062-783e73e28ce0'
ORDER BY week_number;

-- 3. Check if this user_id exists in profiles table
SELECT 
    id,
    email,
    full_name,
    created_at
FROM profiles 
WHERE id = '495205f7-fc9b-423e-8062-783e73e28ce0';

-- 4. Check if any health_data exists for any users (to see if table has any data)
SELECT 
    COUNT(*) as total_health_records,
    COUNT(DISTINCT user_id) as unique_users
FROM health_data;

-- 5. Show sample health_data records (if any exist)
SELECT 
    user_id,
    week_number,
    date,
    weight,
    data_entered_by
FROM health_data 
LIMIT 5; 