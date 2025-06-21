-- Dr. Nick App: Simple Image Upload + Queue System - Add Columns to health_data Table
-- Run this script in your Supabase SQL Editor

-- Add image URL columns to existing health_data table
-- Lumen images (required) - 7 columns for days 1-7
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS lumen_day1_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS lumen_day2_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS lumen_day3_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS lumen_day4_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS lumen_day5_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS lumen_day6_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS lumen_day7_image TEXT;

-- Food log images (optional) - 7 columns for days 1-7
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS food_log_day1_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS food_log_day2_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS food_log_day3_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS food_log_day4_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS food_log_day5_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS food_log_day6_image TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS food_log_day7_image TEXT;

-- Queue System: Weekly Analysis Fields (4 fields)
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS weekly_whoop_pdf_url TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS weekly_whoop_analysis TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS weekly_ai_analysis TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS weekly_whoop_pdf TEXT;

-- Queue System: Monthly Analysis Fields (4 fields)
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS monthly_whoop_pdf_url TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS monthly_whoop_analysis TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS monthly_ai_analysis TEXT;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS monthly_whoop_pdf TEXT;

-- Queue System: Review Flag
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT TRUE;

-- Add helpful comments
COMMENT ON COLUMN health_data.lumen_day1_image IS 'URL to Lumen screenshot for day 1 of the week';
COMMENT ON COLUMN health_data.lumen_day2_image IS 'URL to Lumen screenshot for day 2 of the week';
COMMENT ON COLUMN health_data.lumen_day3_image IS 'URL to Lumen screenshot for day 3 of the week';
COMMENT ON COLUMN health_data.lumen_day4_image IS 'URL to Lumen screenshot for day 4 of the week';
COMMENT ON COLUMN health_data.lumen_day5_image IS 'URL to Lumen screenshot for day 5 of the week';
COMMENT ON COLUMN health_data.lumen_day6_image IS 'URL to Lumen screenshot for day 6 of the week';
COMMENT ON COLUMN health_data.lumen_day7_image IS 'URL to Lumen screenshot for day 7 of the week';

COMMENT ON COLUMN health_data.food_log_day1_image IS 'URL to food log screenshot for day 1 of the week (optional)';
COMMENT ON COLUMN health_data.food_log_day2_image IS 'URL to food log screenshot for day 2 of the week (optional)';
COMMENT ON COLUMN health_data.food_log_day3_image IS 'URL to food log screenshot for day 3 of the week (optional)';
COMMENT ON COLUMN health_data.food_log_day4_image IS 'URL to food log screenshot for day 4 of the week (optional)';
COMMENT ON COLUMN health_data.food_log_day5_image IS 'URL to food log screenshot for day 5 of the week (optional)';
COMMENT ON COLUMN health_data.food_log_day6_image IS 'URL to food log screenshot for day 6 of the week (optional)';
COMMENT ON COLUMN health_data.food_log_day7_image IS 'URL to food log screenshot for day 7 of the week (optional)';

COMMENT ON COLUMN health_data.weekly_whoop_pdf_url IS 'URL to weekly Whoop PDF uploaded by Dr. Nick (up to 3000 characters)';
COMMENT ON COLUMN health_data.weekly_whoop_analysis IS 'Dr. Nick''s custom weekly analysis text';
COMMENT ON COLUMN health_data.weekly_ai_analysis IS 'AI-generated weekly analysis (placeholder for future use)';
COMMENT ON COLUMN health_data.weekly_whoop_pdf IS 'Direct PDF upload field for weekly Whoop data (up to 3000 characters)';

COMMENT ON COLUMN health_data.monthly_whoop_pdf_url IS 'URL to monthly Whoop PDF uploaded by Dr. Nick (up to 3000 characters)';
COMMENT ON COLUMN health_data.monthly_whoop_analysis IS 'Dr. Nick''s custom monthly analysis text';
COMMENT ON COLUMN health_data.monthly_ai_analysis IS 'AI-generated monthly analysis (placeholder for future use)';
COMMENT ON COLUMN health_data.monthly_whoop_pdf IS 'Direct PDF upload field for monthly Whoop data (up to 3000 characters)';

COMMENT ON COLUMN health_data.needs_review IS 'Flag indicating if this submission needs Dr. Nick''s review (queue system)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Image columns and queue system fields added to health_data table! Now create the storage bucket.';
END $$; 