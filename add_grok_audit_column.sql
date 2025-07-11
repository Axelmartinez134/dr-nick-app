-- Add Grok audit trail column to health_data table
-- This will store the complete prompt + data package sent to Grok for debugging

ALTER TABLE health_data 
ADD COLUMN grok_audit_payload TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN health_data.grok_audit_payload IS 'Complete audit trail of data sent to Grok API - includes prompt at top and data package at bottom for debugging purposes'; 