-- Add final_monday_checkin_analysis column to health_data table
-- This field will store Dr. Nick's final compiled analysis for Monday check-ins

ALTER TABLE health_data 
ADD COLUMN final_monday_checkin_analysis TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN health_data.final_monday_checkin_analysis IS 'Dr. Nick''s final compiled analysis combining Monday message, weekly analysis, monthly analysis, and Grok response for client communication'; 