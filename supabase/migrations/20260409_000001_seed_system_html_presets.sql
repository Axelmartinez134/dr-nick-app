-- Seed the 5 code-defined system presets into html_design_presets.
-- These IDs match SYSTEM_HTML_PRESETS in src/features/html-editor/lib/presets.ts
-- so that carousel_projects.html_preset_id (FK) can reference them.

insert into public.html_design_presets (id, account_id, name, description, aspect_ratio, templates, style_guide, is_system, is_featured, category)
values
  (
    'c9a7f790-7dd6-4e50-bc9f-8de3c1f90001',
    null,
    'Executive Contrast',
    'Dark editorial business layouts with strong contrast and bold callouts.',
    '3:4',
    '[{"id":"executive-contrast-cover","name":"Executive Contrast Cover","role":"cover"},{"id":"executive-contrast-content","name":"Executive Contrast Content","role":"content"}]'::jsonb,
    '{"fontFamily":"Inter","headingFontFamily":"Inter","bodyFontFamily":"Inter","primaryColor":"#0F172A","secondaryColor":"#E2E8F0","accentColor":"#38BDF8","backgroundColor":"#020617","designPatterns":["editorial contrast","bold labels","high-density typography"]}'::jsonb,
    true,
    true,
    'business'
  ),
  (
    'c9a7f790-7dd6-4e50-bc9f-8de3c1f90002',
    null,
    'Soft Authority',
    'Warm, airy educational slides with rounded cards and calm backgrounds.',
    '3:4',
    '[{"id":"soft-authority-cover","name":"Soft Authority Cover","role":"cover"},{"id":"soft-authority-content","name":"Soft Authority Content","role":"content"}]'::jsonb,
    '{"fontFamily":"DM Sans","headingFontFamily":"DM Sans","bodyFontFamily":"DM Sans","primaryColor":"#1F2937","secondaryColor":"#FFF7ED","accentColor":"#F97316","backgroundColor":"#FFFBEB","designPatterns":["soft cards","friendly education","warm accent chips"]}'::jsonb,
    true,
    true,
    'education'
  ),
  (
    'c9a7f790-7dd6-4e50-bc9f-8de3c1f90003',
    null,
    'Neon Strategy',
    'High-energy tech slides with dark gradients and vibrant accent blocks.',
    '3:4',
    '[{"id":"neon-strategy-cover","name":"Neon Strategy Cover","role":"cover"},{"id":"neon-strategy-content","name":"Neon Strategy Content","role":"content"}]'::jsonb,
    '{"fontFamily":"Space Grotesk","headingFontFamily":"Space Grotesk","bodyFontFamily":"Inter","primaryColor":"#020617","secondaryColor":"#F8FAFC","accentColor":"#A855F7","backgroundColor":"#0F172A","designPatterns":["neon gradient","grid overlays","tech punch cards"]}'::jsonb,
    true,
    false,
    'tech'
  ),
  (
    'c9a7f790-7dd6-4e50-bc9f-8de3c1f90004',
    null,
    'Minimal Ledger',
    'Minimal monochrome layouts with clean alignment and subtle structure.',
    '3:4',
    '[{"id":"minimal-ledger-cover","name":"Minimal Ledger Cover","role":"cover"},{"id":"minimal-ledger-content","name":"Minimal Ledger Content","role":"content"}]'::jsonb,
    '{"fontFamily":"IBM Plex Sans","headingFontFamily":"IBM Plex Sans","bodyFontFamily":"IBM Plex Sans","primaryColor":"#111827","secondaryColor":"#F9FAFB","accentColor":"#111827","backgroundColor":"#FFFFFF","designPatterns":["minimal rules","mono labels","precise spacing"]}'::jsonb,
    true,
    false,
    'marketing'
  ),
  (
    'c9a7f790-7dd6-4e50-bc9f-8de3c1f90005',
    null,
    'Playbook Grid',
    'Structured playbook slides with modular panels and strong call-to-action endings.',
    '3:4',
    '[{"id":"playbook-grid-cover","name":"Playbook Grid Cover","role":"cover"},{"id":"playbook-grid-cta","name":"Playbook Grid CTA","role":"cta"}]'::jsonb,
    '{"fontFamily":"Manrope","headingFontFamily":"Manrope","bodyFontFamily":"Manrope","primaryColor":"#111827","secondaryColor":"#ECFEFF","accentColor":"#14B8A6","backgroundColor":"#F0FDFA","designPatterns":["structured grid","teal accent blocks","playbook sequencing"]}'::jsonb,
    true,
    true,
    'marketing'
  )
on conflict (id) do nothing;
