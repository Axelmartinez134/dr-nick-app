-- Create ai_carousels table for storing AI-generated carousel designs
CREATE TABLE IF NOT EXISTS ai_carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Carousel',
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  layout_json JSONB NOT NULL, -- Stores all text lines with positions, sizes, styles
  image_base64 TEXT NOT NULL, -- Base64 encoded image
  image_position JSONB NOT NULL, -- {x, y, width, height}
  background_color TEXT NOT NULL DEFAULT '#ffffff',
  text_color TEXT NOT NULL DEFAULT '#000000',
  custom_image_prompt TEXT, -- Optional custom prompt
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_carousels_user_id ON ai_carousels(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_ai_carousels_created_at ON ai_carousels(created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_carousels ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own carousels
CREATE POLICY "Users can view their own carousels"
  ON ai_carousels
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own carousels
CREATE POLICY "Users can create their own carousels"
  ON ai_carousels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own carousels
CREATE POLICY "Users can update their own carousels"
  ON ai_carousels
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own carousels
CREATE POLICY "Users can delete their own carousels"
  ON ai_carousels
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_carousels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
CREATE TRIGGER trigger_update_ai_carousels_updated_at
  BEFORE UPDATE ON ai_carousels
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_carousels_updated_at();

-- Grant permissions
GRANT ALL ON ai_carousels TO authenticated;

