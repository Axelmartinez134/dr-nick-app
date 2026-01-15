-- Per-user template-type overrides (phase 2)
-- - Add per-user emphasis prompt + image-gen system prompt overrides
-- - Lock template visibility to owner-only (templates are user-private)

-- ================================
-- 1) Create/extend per-user overrides table
-- ================================
-- Some Supabase projects may not have this table yet (older schema).
-- We create it if missing, then add any new columns idempotently.

CREATE TABLE IF NOT EXISTS public.carousel_template_type_overrides (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type_id TEXT NOT NULL REFERENCES public.carousel_template_types(id) ON DELETE CASCADE,
  prompt_override TEXT,
  emphasis_prompt_override TEXT,
  image_gen_prompt_override TEXT,
  slide1_template_id_override UUID REFERENCES public.carousel_templates(id) ON DELETE SET NULL,
  slide2_5_template_id_override UUID REFERENCES public.carousel_templates(id) ON DELETE SET NULL,
  slide6_template_id_override UUID REFERENCES public.carousel_templates(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, template_type_id)
);

ALTER TABLE public.carousel_template_type_overrides ENABLE ROW LEVEL SECURITY;

-- Editor users can read/write their own overrides only.
DROP POLICY IF EXISTS "Template type overrides: select self only" ON public.carousel_template_type_overrides;
CREATE POLICY "Template type overrides: select self only"
  ON public.carousel_template_type_overrides
  FOR SELECT
  TO public
  USING (is_editor_user() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Template type overrides: insert self only" ON public.carousel_template_type_overrides;
CREATE POLICY "Template type overrides: insert self only"
  ON public.carousel_template_type_overrides
  FOR INSERT
  TO public
  WITH CHECK (is_editor_user() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Template type overrides: update self only" ON public.carousel_template_type_overrides;
CREATE POLICY "Template type overrides: update self only"
  ON public.carousel_template_type_overrides
  FOR UPDATE
  TO public
  USING (is_editor_user() AND auth.uid() = user_id)
  WITH CHECK (is_editor_user() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Template type overrides: delete self only" ON public.carousel_template_type_overrides;
CREATE POLICY "Template type overrides: delete self only"
  ON public.carousel_template_type_overrides
  FOR DELETE
  TO public
  USING (is_editor_user() AND auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_carousel_template_type_overrides_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_carousel_template_type_overrides_updated_at ON public.carousel_template_type_overrides;
CREATE TRIGGER trigger_update_carousel_template_type_overrides_updated_at
  BEFORE UPDATE ON public.carousel_template_type_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_carousel_template_type_overrides_updated_at();

GRANT ALL ON public.carousel_template_type_overrides TO authenticated;
GRANT ALL ON public.carousel_template_type_overrides TO anon;

ALTER TABLE IF EXISTS public.carousel_template_type_overrides
  ADD COLUMN IF NOT EXISTS emphasis_prompt_override TEXT,
  ADD COLUMN IF NOT EXISTS image_gen_prompt_override TEXT;

COMMENT ON COLUMN public.carousel_template_type_overrides.emphasis_prompt_override IS
  'Per-user override for the text styling/emphasis prompt (bold/italic/underline ranges).';

COMMENT ON COLUMN public.carousel_template_type_overrides.image_gen_prompt_override IS
  'Per-user override for the image generation system prompt (used to generate per-slide image prompts).';

-- =========================================
-- 2) Make templates visible only to their owner
-- =========================================
-- Previously: all authenticated users could read all templates.
-- Now: only editor users can read templates they own.

ALTER TABLE public.carousel_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Carousel templates: read for authenticated" ON public.carousel_templates;
DROP POLICY IF EXISTS "Carousel templates: read own" ON public.carousel_templates;

CREATE POLICY "Carousel templates: read own"
  ON public.carousel_templates
  FOR SELECT
  TO public
  USING (is_editor_user() AND auth.uid() = owner_user_id);

