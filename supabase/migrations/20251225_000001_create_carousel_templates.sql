-- Carousel Templates MVP
-- - Public storage bucket: carousel-templates (configured in Supabase Storage UI)
-- - Postgres tables:
--   - admin_users: controls admin-only write access via RLS
--   - carousel_templates: versioned template definitions (JSONB)
-- - ai_carousels: adds template_id + template_snapshot for reproducible renders

-- =========================
-- 1) Admin users table
-- =========================
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify the admin list (bootstrap by service role / SQL editor).
CREATE POLICY "Admin users: select self only"
  ON admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: only service role can manage this table.

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

-- =========================
-- 2) Carousel templates table
-- =========================
CREATE TABLE IF NOT EXISTS carousel_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carousel_templates_owner_user_id ON carousel_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_carousel_templates_updated_at ON carousel_templates(updated_at DESC);

ALTER TABLE carousel_templates ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users (so templates can be applied by non-admins).
CREATE POLICY "Carousel templates: read for authenticated"
  ON carousel_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Write: admin-only, and only for rows they own.
CREATE POLICY "Carousel templates: insert admin-only"
  ON carousel_templates
  FOR INSERT
  WITH CHECK (is_admin_user() AND auth.uid() = owner_user_id);

CREATE POLICY "Carousel templates: update admin-only"
  ON carousel_templates
  FOR UPDATE
  USING (is_admin_user() AND auth.uid() = owner_user_id)
  WITH CHECK (is_admin_user() AND auth.uid() = owner_user_id);

CREATE POLICY "Carousel templates: delete admin-only"
  ON carousel_templates
  FOR DELETE
  USING (is_admin_user() AND auth.uid() = owner_user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_carousel_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_carousel_templates_updated_at ON carousel_templates;
CREATE TRIGGER trigger_update_carousel_templates_updated_at
  BEFORE UPDATE ON carousel_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_carousel_templates_updated_at();

GRANT ALL ON carousel_templates TO authenticated;
GRANT ALL ON admin_users TO authenticated;

-- =========================
-- 3) ai_carousels extensions
-- =========================
ALTER TABLE IF EXISTS ai_carousels
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES carousel_templates(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS ai_carousels
  ADD COLUMN IF NOT EXISTS template_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_ai_carousels_template_id ON ai_carousels(template_id);



