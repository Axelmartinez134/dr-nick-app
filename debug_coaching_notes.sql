-- Debug script to check if coaching notes are being saved
-- Run this after creating a new patient to verify the notes field

-- Check if the dr_nick_coaching_notes column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'dr_nick_coaching_notes';

-- Check recent profiles and their coaching notes
SELECT 
    id,
    email,
    full_name,
    dr_nick_coaching_notes,
    created_at,
    CASE 
        WHEN dr_nick_coaching_notes IS NULL THEN 'NULL'
        WHEN dr_nick_coaching_notes = '' THEN 'EMPTY STRING'
        ELSE 'HAS CONTENT'
    END as notes_status
FROM profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- Count profiles with and without coaching notes
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN dr_nick_coaching_notes IS NOT NULL AND dr_nick_coaching_notes != '' THEN 1 END) as profiles_with_notes,
    COUNT(CASE WHEN dr_nick_coaching_notes IS NULL OR dr_nick_coaching_notes = '' THEN 1 END) as profiles_without_notes
FROM profiles; 