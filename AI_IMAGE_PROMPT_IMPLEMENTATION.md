# AI Image Prompt Feature - Implementation Plan

**Created**: January 14, 2026  
**Status**: 🟡 Phase 6 - Testing  
**Last Updated**: January 14, 2026

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Phase Plan Summary](#phase-plan-summary)
3. [Phase 1: Database Schema](#phase-1-database-schema)
4. [Phase 2: Backend API Infrastructure](#phase-2-backend-api-infrastructure)
5. [Phase 3: GPT Image Generator Update](#phase-3-gpt-image-generator-update)
6. [Phase 4: Frontend State & Third Prompt Setting](#phase-4-frontend-state--third-prompt-setting)
7. [Phase 5: AI Image Prompt UI in Sidebar](#phase-5-ai-image-prompt-ui-in-sidebar)
8. [Phase 6: Generate Image Flow](#phase-6-generate-image-flow)
9. [Technical Reference](#technical-reference)

---

## Feature Overview

### What We're Building

An AI-powered image suggestion feature for the `/editor` that:

1. **Generates image prompts** for each of the 6 slides after "Generate Copy" is clicked
2. **Uses a configurable system prompt** (editable in UI alongside Poppy and Text Styling prompts)
3. **Allows users to edit** the generated prompts per slide
4. **Generates images** from prompts using GPT-Image-1.5 + RemoveBG
5. **Places images** on the canvas (centered, like current upload behavior)

### Key Decisions

| Decision | Choice |
|----------|--------|
| Trigger | After "Generate Copy" completes (not Realign) |
| Template gating | Only visible for "Enhanced" template type |
| AI Model for prompts | Claude (same ANTHROPIC_API_KEY) |
| Image generation | GPT-Image-1.5 (normal background) → RemoveBG |
| Image placement | Replaces existing image (single image per slide) |
| Auto-realign | No - user clicks "Realign Text" manually if needed |
| Progress indicator | Linear progress bar (~30 seconds) |
| Prompt storage | Per-slide in `carousel_project_slides.ai_image_prompt` |
| System prompt storage | Per-template-type in `carousel_template_types.default_image_gen_prompt` |

---

## Phase Plan Summary

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Database Schema | ✅ Complete |
| **Phase 2** | Backend API Infrastructure | ✅ Complete |
| **Phase 3** | GPT Image Generator Update | ✅ Complete |
| **Phase 4** | Frontend State & Third Prompt Setting | ✅ Complete |
| **Phase 5** | AI Image Prompt UI in Sidebar | ✅ Complete |
| **Phase 6** | Generate Image Flow | 🟡 Testing |

---

## Phase 1: Database Schema

### Goal
Add the required database columns to support AI image prompts.

### Files to Create

#### `supabase/migrations/20260114_000001_add_ai_image_prompt_fields.sql`

```sql
-- Add Image Generation Prompt to carousel_template_types (like emphasis_prompt)
-- This stores the system prompt sent to Claude for generating per-slide image prompts
ALTER TABLE public.carousel_template_types
ADD COLUMN IF NOT EXISTS default_image_gen_prompt TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.carousel_template_types.default_image_gen_prompt IS
  'System prompt for Claude to generate per-slide image prompts; editable like Poppy/Emphasis prompts.';

-- Add AI image prompt column to carousel_project_slides
-- This stores the generated/edited prompt per slide
ALTER TABLE public.carousel_project_slides
ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT;

COMMENT ON COLUMN public.carousel_project_slides.ai_image_prompt IS
  'AI-generated prompt for image generation; editable by user, auto-saved like body text.';
```

### Test Instructions

1. Run the migration against your Supabase database:
   - Go to Supabase Dashboard → SQL Editor
   - Paste the migration SQL and run it
   - OR run via CLI: `supabase db push` (if using local migrations)

2. Verify the columns were added:
   ```sql
   -- Check carousel_template_types
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'carousel_template_types' 
   AND column_name = 'default_image_gen_prompt';
   
   -- Check carousel_project_slides
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'carousel_project_slides' 
   AND column_name = 'ai_image_prompt';
   ```

3. Both queries should return 1 row each.

### Success Criteria

- [ ] `carousel_template_types.default_image_gen_prompt` column exists (TEXT, NOT NULL, DEFAULT '')
- [ ] `carousel_project_slides.ai_image_prompt` column exists (TEXT, nullable)
- [ ] No errors when querying the tables

---

## Phase 2: Backend API Infrastructure

### Goal
Update existing APIs to read/write the new fields and create the image prompt generation endpoint.

### Files to Modify

#### 1. `src/app/api/editor/_utils.ts`

**Changes:**
- Add `default_image_gen_prompt` to `TemplateTypeDefaultsRow` type
- Update `mergeTemplateTypeDefaults` to include `imageGenPrompt`

```typescript
// Add to TemplateTypeDefaultsRow type (around line 36)
export type TemplateTypeDefaultsRow = {
  id: TemplateTypeId;
  label: string;
  default_prompt: string;
  default_emphasis_prompt: string;
  default_image_gen_prompt: string;  // NEW
  default_slide1_template_id: string | null;
  default_slide2_5_template_id: string | null;
  default_slide6_template_id: string | null;
  updated_at: string;
  updated_by: string | null;
};

// Update mergeTemplateTypeDefaults (around line 108)
export function mergeTemplateTypeDefaults(
  defaults: TemplateTypeDefaultsRow,
  override: TemplateTypeOverrideRow | null
) {
  return {
    templateTypeId: defaults.id,
    label: defaults.label,
    prompt: (override?.prompt_override ?? '') || defaults.default_prompt || '',
    emphasisPrompt: /* existing logic */,
    imageGenPrompt: (defaults.default_image_gen_prompt || '').trim() || DEFAULT_IMAGE_GEN_PROMPT,  // NEW
    slide1TemplateId: /* existing */,
    slide2to5TemplateId: /* existing */,
    slide6TemplateId: /* existing */,
    updatedAt: defaults.updated_at,
  };
}
```

**Add default prompt constant:**
```typescript
const DEFAULT_IMAGE_GEN_PROMPT = `You are creating image generation prompts for a 6-slide Instagram carousel about health/medical topics.

For EACH slide, generate a concise, descriptive prompt that would create a professional medical illustration matching that slide's content.

REQUIREMENTS:
- NO TEXT in the images (text will be added separately by the design system)
- Professional, clean medical illustration style
- Suitable for Instagram/LinkedIn carousel (portrait format 1080x1440)
- Educational and trustworthy visual aesthetic
- Consider the narrative flow across all 6 slides

INPUT: You will receive all 6 slides with their headline and body text.

OUTPUT: Return ONLY valid JSON:
{
  "prompts": [
    "prompt for slide 1",
    "prompt for slide 2", 
    "prompt for slide 3",
    "prompt for slide 4",
    "prompt for slide 5",
    "prompt for slide 6"
  ]
}

Each prompt should be 1-3 sentences describing the visual concept.`;
```

#### 2. `src/app/api/editor/template-types/effective/route.ts`

**Changes:**
- Add `default_image_gen_prompt` to SELECT query

```typescript
// Update line 29
.select(
  'id, label, default_prompt, default_emphasis_prompt, default_image_gen_prompt, default_slide1_template_id, default_slide2_5_template_id, default_slide6_template_id, updated_at, updated_by'
)
```

#### 3. `src/app/api/editor/template-types/defaults/update/route.ts`

**Changes:**
- Accept `defaultImageGenPrompt` in Body type
- Handle in patch

```typescript
// Update Body type (around line 8)
type Body = {
  templateTypeId: TemplateTypeId;
  defaultPrompt?: string;
  defaultEmphasisPrompt?: string;
  defaultImageGenPrompt?: string;  // NEW
  slide1TemplateId?: string | null;
  slide2to5TemplateId?: string | null;
  slide6TemplateId?: string | null;
};

// Add to patch handling (around line 37)
if (typeof body.defaultImageGenPrompt === 'string') patch.default_image_gen_prompt = body.defaultImageGenPrompt;

// Update SELECT (around line 50)
.select(
  'id, label, default_prompt, default_emphasis_prompt, default_image_gen_prompt, default_slide1_template_id, default_slide2_5_template_id, default_slide6_template_id, updated_at, updated_by'
)
```

#### 4. `src/app/api/editor/projects/slides/update/route.ts`

**Changes:**
- Accept `aiImagePrompt` field

```typescript
// Update Body type (around line 8)
type Body = {
  projectId: string;
  slideIndex: number;
  headline?: string | null;
  body?: string | null;
  layoutSnapshot?: any | null;
  inputSnapshot?: any | null;
  aiImagePrompt?: string | null;  // NEW
};

// Add to patch handling (around line 40)
if (body.aiImagePrompt !== undefined) patch.ai_image_prompt = body.aiImagePrompt;

// Update SELECT (around line 50)
.select('id, project_id, slide_index, headline, body, layout_snapshot, input_snapshot, ai_image_prompt, updated_at')
```

#### 5. `src/app/api/editor/projects/load/route.ts`

**Changes:**
- Include `ai_image_prompt` in SELECT

```typescript
// Update line 33
.select('id, project_id, slide_index, headline, body, layout_snapshot, input_snapshot, ai_image_prompt, created_at, updated_at')
```

### Files to Create

#### 6. `src/app/api/editor/projects/jobs/generate-image-prompts/route.ts`

```typescript
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
  slideIndex?: number; // Optional: if provided, regenerate only this slide
};

function extractJsonObject(text: string): any {
  const s = String(text || '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Claude did not return valid JSON');
  }
  return JSON.parse(s.slice(first, last + 1));
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.projectId) {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }

  // Load project to get template_type_id
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, template_type_id')
    .eq('id', body.projectId)
    .eq('owner_user_id', user.id)
    .single();

  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  // Only for Enhanced template type
  if (project.template_type_id !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Image prompts only available for Enhanced template type' }, { status: 400 });
  }

  // Load all 6 slides
  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, headline, body')
    .eq('project_id', body.projectId)
    .order('slide_index', { ascending: true });

  if (slidesErr || !slides || slides.length !== 6) {
    return NextResponse.json({ success: false, error: 'Could not load slides' }, { status: 500 });
  }

  // Load the image gen prompt from template type settings
  const { data: ttRow } = await supabase
    .from('carousel_template_types')
    .select('default_image_gen_prompt')
    .eq('id', 'enhanced')
    .maybeSingle();

  const systemPrompt = String(ttRow?.default_image_gen_prompt || '').trim() || getDefaultImageGenPrompt();

  // Build the input for Claude
  const slidesInput = slides.map((s, i) => ({
    slideNumber: i + 1,
    headline: s.headline || '',
    body: s.body || '',
  }));

  const userMessage = `Here are the 6 slides:\n\n${JSON.stringify(slidesInput, null, 2)}`;

  // Call Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 });
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 45_000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        temperature: 0.7,
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${userMessage}` },
        ],
      }),
      signal: ac.signal,
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = json?.error?.message || 'Anthropic API error';
      throw new Error(msg);
    }

    const content = json?.content?.[0]?.text || '';
    const parsed = extractJsonObject(content);
    const prompts = parsed?.prompts;

    if (!Array.isArray(prompts) || prompts.length !== 6) {
      throw new Error('Claude did not return 6 prompts');
    }

    // If slideIndex provided, only update that slide
    if (typeof body.slideIndex === 'number' && body.slideIndex >= 0 && body.slideIndex <= 5) {
      await supabase
        .from('carousel_project_slides')
        .update({ ai_image_prompt: prompts[body.slideIndex] })
        .eq('project_id', body.projectId)
        .eq('slide_index', body.slideIndex);

      return NextResponse.json({
        success: true,
        prompts: prompts,
        updatedSlideIndex: body.slideIndex,
      });
    }

    // Otherwise update all 6 slides
    await Promise.all(
      prompts.map((prompt: string, idx: number) =>
        supabase
          .from('carousel_project_slides')
          .update({ ai_image_prompt: prompt })
          .eq('project_id', body.projectId)
          .eq('slide_index', idx)
      )
    );

    return NextResponse.json({
      success: true,
      prompts,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to generate image prompts' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}

function getDefaultImageGenPrompt(): string {
  return `You are creating image generation prompts for a 6-slide Instagram carousel about health/medical topics.

For EACH slide, generate a concise, descriptive prompt that would create a professional medical illustration matching that slide's content.

REQUIREMENTS:
- NO TEXT in the images (text will be added separately by the design system)
- Professional, clean medical illustration style
- Suitable for Instagram/LinkedIn carousel (portrait format 1080x1440)
- Educational and trustworthy visual aesthetic
- Consider the narrative flow across all 6 slides

INPUT: You will receive all 6 slides with their headline and body text.

OUTPUT: Return ONLY valid JSON:
{
  "prompts": [
    "prompt for slide 1",
    "prompt for slide 2", 
    "prompt for slide 3",
    "prompt for slide 4",
    "prompt for slide 5",
    "prompt for slide 6"
  ]
}

Each prompt should be 1-3 sentences describing the visual concept.`;
}
```

### Test Instructions

1. **Restart dev server** after making changes

2. **Test template-types/effective API**:
   - Open browser DevTools → Network tab
   - Load a project in `/editor`
   - Look for request to `/api/editor/template-types/effective?type=enhanced`
   - Verify response includes `imageGenPrompt` field

3. **Test slides/update API**:
   - In browser console:
   ```javascript
   const token = (await supabase.auth.getSession()).data.session?.access_token;
   const res = await fetch('/api/editor/projects/slides/update', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ projectId: 'YOUR_PROJECT_ID', slideIndex: 0, aiImagePrompt: 'Test prompt' })
   });
   console.log(await res.json());
   ```
   - Should return success with the updated slide

4. **Test generate-image-prompts API** (after creating the file):
   - In browser console:
   ```javascript
   const token = (await supabase.auth.getSession()).data.session?.access_token;
   const res = await fetch('/api/editor/projects/jobs/generate-image-prompts', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ projectId: 'YOUR_PROJECT_ID' })
   });
   console.log(await res.json());
   ```
   - Should return `{ success: true, prompts: [...6 prompts...] }`

### Success Criteria

- [ ] `/api/editor/template-types/effective` returns `imageGenPrompt` field
- [ ] `/api/editor/template-types/defaults/update` accepts `defaultImageGenPrompt`
- [ ] `/api/editor/projects/slides/update` accepts `aiImagePrompt`
- [ ] `/api/editor/projects/load` returns `ai_image_prompt` for each slide
- [ ] `/api/editor/projects/jobs/generate-image-prompts` successfully calls Claude and returns 6 prompts

---

## Phase 3: GPT Image Generator Update

### Goal
Update GPT-Image-1.5 to generate images with normal backgrounds (not transparent), since we'll use RemoveBG.

### Files to Modify

#### `src/lib/gpt-image-generator.ts`

**Changes:**
- Remove `background: 'transparent'` from the request
- Update comments to reflect new flow

```typescript
// Around line 23, update requestBody:
const requestBody = {
  model: 'gpt-image-1.5',
  prompt: noTextPrompt,
  n: 1,
  size: '1024x1536',
  quality: 'high',
  // REMOVED: background: 'transparent' - we now use RemoveBG for transparency
  output_format: 'png',
};

// Update console logs to remove transparency mentions
```

### Test Instructions

1. **Verify the change compiles**: `npm run build` should succeed

2. **Manual test** (optional, can skip if confident):
   - The actual image generation will be tested in Phase 6
   - For now, just verify the file compiles without errors

### Success Criteria

- [ ] `gpt-image-generator.ts` no longer includes `background: 'transparent'`
- [ ] Build succeeds without errors

---

## Phase 4: Frontend State & Third Prompt Setting

### Goal
Add the "Image Generation Prompt" as a third editable prompt in the sidebar settings, alongside "Poppy Prompt" and "Text Styling Prompt".

### Files to Modify

#### `src/app/editor/EditorShell.tsx`

**Changes (Part 1 - State):**

```typescript
// Around line 120, add new state:
const [templateTypeImageGenPrompt, setTemplateTypeImageGenPrompt] = useState<string>("");

// Around line 133, update promptModalSection type:
const [promptModalSection, setPromptModalSection] = useState<"prompt" | "emphasis" | "image">("prompt");
```

**Changes (Part 2 - Load settings):**

```typescript
// Around line 1888, in loadTemplateTypeEffective:
setTemplateTypeImageGenPrompt(effective?.imageGenPrompt || '');
```

**Changes (Part 3 - Save settings):**

```typescript
// Around line 2086, in savePromptSettings:
body: JSON.stringify({
  templateTypeId,
  defaultPrompt: templateTypePrompt,
  defaultEmphasisPrompt: templateTypeEmphasisPrompt,
  defaultImageGenPrompt: templateTypeImageGenPrompt,  // NEW
  slide1TemplateId: templateTypeMappingSlide1,
  slide2to5TemplateId: templateTypeMappingSlide2to5,
  slide6TemplateId: templateTypeMappingSlide6,
}),
```

**Changes (Part 4 - Autosave dependency):**

```typescript
// Around line 2196, add to useEffect dependencies:
templateTypeImageGenPrompt,
```

**Changes (Part 5 - Third button in sidebar):**

```typescript
// After the "Text Styling Prompt" button (around line 2880), add:
{templateTypeId === "enhanced" && (
  <button
    type="button"
    className="w-full text-left p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
    onClick={() => {
      setPromptModalSection("image");
      setPromptModalOpen(true);
    }}
    title="Edit Image Generation Prompt"
  >
    <div className="text-sm font-semibold text-slate-700">Image Generation Prompt</div>
    <div className="mt-0.5 text-xs text-slate-500 truncate">
      {`${templateTypeId.toUpperCase()}: ${(templateTypeImageGenPrompt || "").split("\n")[0] || "Click to edit..."}`}
    </div>
  </button>
)}
```

**Changes (Part 6 - Third section in modal):**

```typescript
// In the prompt modal (around line 4345), add third section:
{promptModalSection === "image" && (
  <div>
    <div className="text-sm font-semibold text-slate-900">Image Generation Prompt</div>
    <div className="mt-0.5 text-xs text-slate-500">
      System prompt sent to Claude for generating per-slide image prompts (Enhanced only).
    </div>
    <textarea
      className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
      rows={10}
      value={templateTypeImageGenPrompt}
      onChange={(e) => {
        promptDirtyRef.current = true;
        setTemplateTypeImageGenPrompt(e.target.value);
      }}
      placeholder="Enter the image generation prompt for this template type..."
    />
  </div>
)}
```

### Test Instructions

1. **Restart dev server**

2. **Navigate to `/editor`**

3. **Select "Enhanced" template type** (the third button should only appear for Enhanced)

4. **Verify third button appears**: Below "Text Styling Prompt", you should see "Image Generation Prompt"

5. **Click "Image Generation Prompt"**: Modal should open with a textarea

6. **Edit the prompt and wait**: Should auto-save (check Network tab for request to `/api/editor/template-types/defaults/update`)

7. **Refresh page**: The edited prompt should persist

### Success Criteria

- [ ] "Image Generation Prompt" button appears in sidebar (Enhanced only)
- [ ] Clicking opens modal with textarea
- [ ] Edits auto-save to database
- [ ] Prompt persists after page refresh

---

## Phase 5: AI Image Prompt UI in Sidebar

### Goal
Add the per-slide AI Image Prompt UI section in the sidebar (below Body input), showing the generated prompt with edit/regenerate/generate buttons.

### Files to Modify

#### `src/app/editor/EditorShell.tsx`

**Changes (Part 1 - SlideState type):**

```typescript
// Around line 309, add to SlideState type:
type SlideState = {
  // ... existing fields ...
  draftAiImagePrompt: string;
  savedAiImagePrompt: string;
  imageGenerating: boolean;
  imageGenerationProgress: number;
  imageGenerationError: string | null;
};
```

**Changes (Part 2 - initSlide):**

```typescript
// Around line 330, add to initSlide:
const initSlide = (): SlideState => ({
  // ... existing fields ...
  draftAiImagePrompt: "",
  savedAiImagePrompt: "",
  imageGenerating: false,
  imageGenerationProgress: 0,
  imageGenerationError: null,
});
```

**Changes (Part 3 - loadProject hydration):**

```typescript
// Around line 1932, when hydrating slides:
return {
  ...prev,
  // ... existing fields ...
  draftAiImagePrompt: row?.ai_image_prompt || '',
  savedAiImagePrompt: row?.ai_image_prompt || '',
  imageGenerating: false,
  imageGenerationProgress: 0,
  imageGenerationError: null,
};
```

**Changes (Part 4 - Auto-save for AI prompt):**

```typescript
// Add new useEffect after existing auto-save effects (around line 398):
const activeDraftAiImagePrompt = slides[activeSlideIndex]?.draftAiImagePrompt || "";
useEffect(() => {
  if (!currentProjectId) return;
  if (switchingSlides) return;
  if (templateTypeId !== "enhanced") return;
  const cur = slidesRef.current[activeSlideIndex];
  if (!cur) return;
  if ((cur.draftAiImagePrompt || "") === (cur.savedAiImagePrompt || "")) return;
  
  const timeoutId = window.setTimeout(() => {
    void saveSlidePatch(activeSlideIndex, { aiImagePrompt: activeDraftAiImagePrompt });
    setSlides((prev) => prev.map((s, i) => 
      i !== activeSlideIndex ? s : { ...s, savedAiImagePrompt: s.draftAiImagePrompt }
    ));
  }, 600);
  
  return () => window.clearTimeout(timeoutId);
}, [currentProjectId, activeSlideIndex, activeDraftAiImagePrompt, templateTypeId, switchingSlides]);
```

**Changes (Part 5 - regeneratePromptForActiveSlide function):**

```typescript
// Add new function (around line 890):
const regeneratePromptForActiveSlide = async () => {
  if (!currentProjectId) return;
  if (templateTypeId !== "enhanced") return;
  
  try {
    const data = await fetchJson('/api/editor/projects/jobs/generate-image-prompts', {
      method: 'POST',
      body: JSON.stringify({ projectId: currentProjectId, slideIndex: activeSlideIndex }),
    });
    
    if (data.success && Array.isArray(data.prompts)) {
      const newPrompt = data.prompts[activeSlideIndex] || '';
      setSlides((prev) => prev.map((s, i) => 
        i !== activeSlideIndex ? s : { 
          ...s, 
          draftAiImagePrompt: newPrompt,
          savedAiImagePrompt: newPrompt,
        }
      ));
    }
  } catch (e: any) {
    addLog(`❌ Regenerate prompt failed: ${e?.message}`);
  }
};
```

**Changes (Part 6 - UI section in sidebar):**

```typescript
// After the Body input section, before Generate Copy button (around line 3860):
{templateTypeId === "enhanced" && (
  <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="text-sm font-semibold text-slate-900">✨ AI Image Prompt</div>
      <button
        type="button"
        className="h-7 px-2 rounded-md border border-slate-200 bg-white text-slate-600 text-xs font-medium disabled:opacity-50"
        onClick={() => void regeneratePromptForActiveSlide()}
        disabled={copyGenerating || slides[activeSlideIndex]?.imageGenerating}
        title="Generate a new prompt suggestion"
      >
        🔄 Regenerate
      </button>
    </div>
    
    <textarea
      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 resize-none"
      rows={4}
      placeholder="AI will generate an image prompt after you click Generate Copy..."
      value={slides[activeSlideIndex]?.draftAiImagePrompt || ""}
      onChange={(e) => {
        const val = e.target.value;
        setSlides((prev) => prev.map((s, i) => 
          i !== activeSlideIndex ? s : { ...s, draftAiImagePrompt: val }
        ));
        slidesRef.current = slidesRef.current.map((s, i) =>
          i !== activeSlideIndex ? s : { ...s, draftAiImagePrompt: val }
        );
      }}
      disabled={copyGenerating || slides[activeSlideIndex]?.imageGenerating}
    />
    
    {/* Error message */}
    {slides[activeSlideIndex]?.imageGenerationError && (
      <div className="mt-2 text-xs text-red-600">
        ❌ {slides[activeSlideIndex]?.imageGenerationError}
      </div>
    )}
    
    <button
      type="button"
      className="mt-3 w-full h-10 rounded-lg bg-violet-600 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
      disabled={
        !currentProjectId ||
        copyGenerating ||
        slides[activeSlideIndex]?.imageGenerating ||
        !(slides[activeSlideIndex]?.draftAiImagePrompt || "").trim()
      }
    >
      🎨 Generate Image
    </button>
  </div>
)}
```

**Changes (Part 7 - Update runGenerateCopy):**

```typescript
// Around line 870, after enqueueLiveLayout, add:
if (typeOut === 'enhanced') {
  try {
    addLog('🖼️ Generating AI image prompts...');
    const promptsData = await fetchJson('/api/editor/projects/jobs/generate-image-prompts', {
      method: 'POST',
      body: JSON.stringify({ projectId: currentProjectId }),
    });
    if (Array.isArray(promptsData?.prompts)) {
      setSlides((prev) => prev.map((s, i) => ({
        ...s,
        draftAiImagePrompt: promptsData.prompts[i] || '',
        savedAiImagePrompt: promptsData.prompts[i] || '',
      })));
      slidesRef.current = slidesRef.current.map((s, i) => ({
        ...s,
        draftAiImagePrompt: promptsData?.prompts?.[i] || '',
        savedAiImagePrompt: promptsData?.prompts?.[i] || '',
      }));
      addLog(`✅ Generated ${promptsData.prompts.length} image prompts`);
    }
  } catch (e: any) {
    addLog(`⚠️ Image prompt generation failed (non-blocking): ${e?.message}`);
  }
}
```

### Test Instructions

1. **Restart dev server**

2. **Navigate to `/editor` with Enhanced template type**

3. **Create or load a project**

4. **Click "Generate Copy"**:
   - Wait for copy to generate
   - After completion, the "✨ AI Image Prompt" section should show a generated prompt

5. **Edit the prompt**: Type in the textarea, wait 600ms, check Network tab for auto-save

6. **Click "🔄 Regenerate"**: Should fetch a new prompt for just this slide

7. **Switch slides**: Each slide should have its own prompt

8. **Refresh page**: Prompts should persist

### Success Criteria

- [ ] AI Image Prompt section appears for Enhanced template type
- [ ] Prompts are generated after "Generate Copy" completes
- [ ] Prompts are editable and auto-save
- [ ] "Regenerate" button works for active slide
- [ ] Prompts persist across page refresh
- [ ] "Generate Image" button appears (disabled until Phase 6)

---

## Phase 6: Generate Image Flow

### Goal
Implement the actual image generation: GPT-Image-1.5 → RemoveBG → Upload to storage → Place on canvas.

### Files to Create

#### `src/app/api/editor/projects/slides/image/generate/route.ts`

```typescript
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../../../_utils';
import { generateMedicalImage } from '@/lib/gpt-image-generator';
import { computeAlphaMask128FromPngBytes } from '../_mask';

export const runtime = 'nodejs';
export const maxDuration = 120; // Image generation can take up to 60s

const BUCKET = 'carousel-project-images' as const;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Body = {
  projectId: string;
  slideIndex: number;
  prompt: string;
};

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { projectId, slideIndex, prompt } = body;
  
  if (!projectId || !prompt?.trim()) {
    return NextResponse.json({ success: false, error: 'projectId and prompt are required' }, { status: 400 });
  }
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json({ success: false, error: 'slideIndex must be 0-5' }, { status: 400 });
  }

  // Verify project ownership
  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id')
    .eq('id', projectId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  
  if (projErr || !project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Step 1: Generate image with GPT-Image-1.5
    console.log('[Generate Image] 🎨 Calling GPT-Image-1.5...');
    const imageDataUrl = await generateMedicalImage(prompt);
    
    // Extract base64 from data URL
    const base64Match = imageDataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image data URL format');
    }
    const imageBase64 = base64Match[1];
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // Step 2: Remove background with RemoveBG
    console.log('[Generate Image] 🔧 Removing background...');
    const removeBgApiKey = process.env.REMOVEBG_API_KEY;
    if (!removeBgApiKey) {
      throw new Error('Missing REMOVEBG_API_KEY');
    }

    const formData = new FormData();
    formData.append('image_file', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');
    formData.append('format', 'png');

    const removeBgRes = await fetch('https://removebgapi.com/api/v1/remove', {
      method: 'POST',
      headers: { Authorization: `Bearer ${removeBgApiKey}` },
      body: formData,
    });

    if (!removeBgRes.ok) {
      throw new Error(`RemoveBG failed (${removeBgRes.status})`);
    }

    const processedBuffer = Buffer.from(await removeBgRes.arrayBuffer());
    const processedBytes = new Uint8Array(processedBuffer);
    
    // Step 3: Compute alpha mask
    console.log('[Generate Image] 🖼️ Computing alpha mask...');
    const mask = computeAlphaMask128FromPngBytes(processedBytes, 32, 128, 128);

    // Step 4: Upload to Supabase storage
    const baseDir = `projects/${projectId}/slides/${slideIndex}`;
    const originalPath = `${baseDir}/ai-generated-original.png`;
    const processedPath = `${baseDir}/image.png`;
    const v = String(Date.now());

    // Upload original (for debugging/retry)
    await svc.storage.from(BUCKET).upload(originalPath, imageBuffer, { 
      contentType: 'image/png', 
      upsert: true 
    });

    // Upload processed (active image)
    const { error: upErr } = await svc.storage.from(BUCKET).upload(processedPath, processedBuffer, { 
      contentType: 'image/png', 
      upsert: true 
    });
    
    if (upErr) {
      throw new Error(upErr.message);
    }

    const { data: urlData } = svc.storage.from(BUCKET).getPublicUrl(processedPath);
    const publicUrl = `${urlData.publicUrl}?v=${v}`;

    console.log('[Generate Image] ✅ Image generated and uploaded successfully');

    return NextResponse.json({
      success: true,
      image: {
        url: publicUrl,
        path: processedPath,
        bucket: BUCKET,
        mask,
        bgRemovalEnabled: true,
        bgRemovalStatus: 'succeeded',
      },
    });
  } catch (e: any) {
    console.error('[Generate Image] ❌ Failed:', e);
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'Image generation failed. Please contact Dr. Nick.' 
    }, { status: 500 });
  }
}
```

### Files to Modify

#### `src/app/editor/EditorShell.tsx`

**Changes - Add generateImageForActiveSlide function:**

```typescript
// Add after regeneratePromptForActiveSlide (around line 910):
const generateImageForActiveSlide = async () => {
  if (!currentProjectId) return;
  const prompt = slides[activeSlideIndex]?.draftAiImagePrompt || "";
  if (!prompt.trim()) return;
  
  // Start progress animation
  setSlides((prev) => prev.map((s, i) => 
    i !== activeSlideIndex ? s : { 
      ...s, 
      imageGenerating: true, 
      imageGenerationProgress: 0,
      imageGenerationError: null 
    }
  ));
  slidesRef.current = slidesRef.current.map((s, i) =>
    i !== activeSlideIndex ? s : { ...s, imageGenerating: true, imageGenerationProgress: 0, imageGenerationError: null }
  );
  
  // Animate progress bar over ~30 seconds
  const startTime = Date.now();
  const progressInterval = window.setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(95, (elapsed / 30000) * 100);
    setSlides((prev) => prev.map((s, i) => 
      i !== activeSlideIndex ? s : { ...s, imageGenerationProgress: progress }
    ));
  }, 300);
  
  try {
    addLog(`🎨 Generating image for slide ${activeSlideIndex + 1}...`);
    const result = await fetchJson('/api/editor/projects/slides/image/generate', {
      method: 'POST',
      body: JSON.stringify({ 
        projectId: currentProjectId, 
        slideIndex: activeSlideIndex,
        prompt 
      }),
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Image generation failed');
    }
    
    addLog(`✅ Image generated successfully`);
    
    // Update layout with new image (similar to uploadImageForActiveSlide)
    const imgData = result.image;
    const curSlide = slidesRef.current[activeSlideIndex];
    const baseLayout = (curSlide as any)?.layoutData?.layout || layoutData?.layout || null;
    
    // Default centered position
    const defaultX = (1080 - 400) / 2;
    const defaultY = (1440 - 600) / 2;
    
    const nextImage = {
      x: defaultX,
      y: defaultY,
      width: 400,
      height: 600,
      url: imgData.url,
      mask: imgData.mask || null,
      storage: { bucket: imgData.bucket, path: imgData.path },
      bgRemovalEnabled: true,
      bgRemovalStatus: imgData.bgRemovalStatus || 'succeeded',
    };
    
    const nextLayout = baseLayout
      ? { ...baseLayout, image: nextImage }
      : { canvas: { width: 1080, height: 1440 }, textLines: [], margins: { top: 60, right: 60, bottom: 60, left: 60 }, image: nextImage };
    
    const nextLayoutData = { success: true, layout: nextLayout, imageUrl: imgData.url };
    
    setSlides((prev) => prev.map((s, i) => 
      i !== activeSlideIndex ? s : { 
        ...s, 
        layoutData: nextLayoutData,
        imageGenerationProgress: 100 
      }
    ));
    slidesRef.current = slidesRef.current.map((s, i) =>
      i !== activeSlideIndex ? s : { ...s, layoutData: nextLayoutData, imageGenerationProgress: 100 }
    );
    
    if (activeSlideIndex === activeSlideIndex) {
      setLayoutData(nextLayoutData as any);
    }
    
    // Save to database
    layoutDirtyRef.current = true;
    void saveSlidePatch(activeSlideIndex, { layoutSnapshot: nextLayout });
    
    setSlides((prev) => prev.map((s, i) => 
      i !== activeSlideIndex ? s : { ...s, imageGenerating: false }
    ));
    
  } catch (e: any) {
    addLog(`❌ Image generation failed: ${e?.message}`);
    setSlides((prev) => prev.map((s, i) => 
      i !== activeSlideIndex ? s : { 
        ...s, 
        imageGenerationError: e?.message || "Image generation failed. Please contact Dr. Nick.",
        imageGenerating: false,
      }
    ));
  } finally {
    window.clearInterval(progressInterval);
    setSlides((prev) => prev.map((s, i) => 
      i !== activeSlideIndex ? s : { ...s, imageGenerating: false }
    ));
    slidesRef.current = slidesRef.current.map((s, i) =>
      i !== activeSlideIndex ? s : { ...s, imageGenerating: false }
    );
  }
};
```

**Changes - Update Generate Image button onClick:**

```typescript
// Update the button in the UI (around line 3910):
<button
  type="button"
  className="mt-3 w-full h-10 rounded-lg bg-violet-600 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
  onClick={() => void generateImageForActiveSlide()}  // ADD THIS
  disabled={
    !currentProjectId ||
    copyGenerating ||
    slides[activeSlideIndex]?.imageGenerating ||
    !(slides[activeSlideIndex]?.draftAiImagePrompt || "").trim()
  }
>
  {slides[activeSlideIndex]?.imageGenerating ? "Generating..." : "🎨 Generate Image"}
</button>
```

**Changes - Add progress bar UI:**

```typescript
// Add between error message and button (around line 3905):
{slides[activeSlideIndex]?.imageGenerating && (
  <div className="mt-2">
    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
      <div 
        className="h-full bg-violet-500 transition-all duration-300"
        style={{ width: `${slides[activeSlideIndex]?.imageGenerationProgress || 0}%` }}
      />
    </div>
    <div className="text-xs text-slate-500 mt-1">
      Generating image... ~{Math.max(0, 30 - Math.floor((slides[activeSlideIndex]?.imageGenerationProgress || 0) * 0.3))}s left
    </div>
  </div>
)}
```

### Test Instructions

1. **Restart dev server**

2. **Navigate to `/editor` with Enhanced template**

3. **Generate copy for a project** (to get image prompts)

4. **Click "🎨 Generate Image"**:
   - Progress bar should animate
   - After ~20-40 seconds, image should appear on canvas (centered)
   - Image should have transparent background

5. **Verify image persists**: Refresh page, image should still be there

6. **Test error handling**: 
   - Remove REMOVEBG_API_KEY temporarily
   - Try generating - should show error message

7. **Test with different slides**: Generate images for multiple slides

### Success Criteria

- [ ] "Generate Image" button triggers image generation
- [ ] Progress bar animates during generation
- [ ] Image appears on canvas after generation completes
- [ ] Image has transparent background (via RemoveBG)
- [ ] Image persists after page refresh
- [ ] Error messages display correctly when generation fails
- [ ] User can click "Realign Text" to wrap text around the image

---

## Technical Reference

### Database Schema

```sql
-- carousel_template_types
default_image_gen_prompt TEXT NOT NULL DEFAULT ''

-- carousel_project_slides  
ai_image_prompt TEXT
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/editor/template-types/effective` | GET | Returns all template settings including `imageGenPrompt` |
| `/api/editor/template-types/defaults/update` | POST | Saves template settings including `defaultImageGenPrompt` |
| `/api/editor/projects/slides/update` | POST | Saves slide data including `aiImagePrompt` |
| `/api/editor/projects/load` | GET | Loads project with `ai_image_prompt` per slide |
| `/api/editor/projects/jobs/generate-image-prompts` | POST | Calls Claude to generate prompts for all/one slide |
| `/api/editor/projects/slides/image/generate` | POST | GPT-Image + RemoveBG + Upload |

### State Management

```typescript
// Per-slide state in EditorShell
type SlideState = {
  // ... existing ...
  draftAiImagePrompt: string;
  savedAiImagePrompt: string;
  imageGenerating: boolean;
  imageGenerationProgress: number;
  imageGenerationError: string | null;
};

// Template type state
templateTypeImageGenPrompt: string;
```

### Flow Diagram

```
User clicks "Generate Copy"
         ↓
Backend generates text copy (existing)
         ↓
Frontend calls /generate-image-prompts
         ↓
Claude generates 6 prompts using system prompt
         ↓
Prompts saved to DB + displayed in UI
         ↓
User edits prompt (optional)
         ↓
User clicks "Generate Image"
         ↓
GPT-Image-1.5 generates image
         ↓
RemoveBG removes background
         ↓
Upload to Supabase storage
         ↓
Image appears on canvas (centered)
         ↓
User clicks "Realign Text" (optional)
```

---

## Status Tracker

| Phase | Status | Approved | Completed |
|-------|--------|----------|-----------|
| Phase 1 | ✅ Complete | ✅ | ✅ |
| Phase 2 | ✅ Complete | ✅ | ✅ |
| Phase 3 | ✅ Complete | ✅ | ✅ |
| Phase 4 | ✅ Complete | ✅ | ✅ |
| Phase 5 | ✅ Complete | ✅ | ✅ |
| Phase 6 | 🟡 Testing | ✅ | ⬜ |

---

**Next Step**: Verify Phase 6 (Generate Image Flow)
