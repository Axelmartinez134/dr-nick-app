# Carousel Map Source Of Truth

This document is the canonical source of truth for the `Carousel Map` feature inside the `/editor` Swipe File workflow.

It is intended to be used across sessions and implementations so future agents can pick up the work without re-deriving the product definition, architecture, or codebase integration.

Status:
- Product direction: aligned
- Implementation status: V1 plus initial V2 lineage visualization implemented in app code
- Scope in this document: current shipped V1 plus the remaining V2 backlog

## Core Product Definition

`Carousel Map` is a new creation surface inside Swipe File.

It is not an extension of `Generate ideas`.

It is a separate, visual, structured workflow that turns one source into:

1. extracted topics
2. one selected topic
3. many opening-slide variants
4. a user-composed `Slide 1` + `Slide 2`
5. one or more generated expansions for slides `3-6`
6. a final project created through the existing `Create project + rewrite` architecture

The system is map-first, not chat-first.

## Locked Product Decisions

These decisions are already settled and should be treated as requirements unless the user explicitly changes them later.

- Create a brand new button rather than modifying `Generate ideas`
- Button label is always `Carousel Map`
- Use a full-screen modal, not a new route for V1
- Keep the existing `Generate ideas` system untouched
- The workflow is:
  - source
  - topics
  - one selected topic
  - many opening pairs
  - slide 1 / slide 2 recombination
  - chosen opener
  - slides 3-6 expansion
  - create project
- Do not generate opening pairs for every topic automatically in V1
- One topic is selected at a time in V1
- User should be able to mix `Slide 1` from one variant with `Slide 2` from another
- `Carousel Map` should persist
- One map per `account_id + swipe_item_id` in V1
- Use the existing `Create project + rewrite` project-creation architecture rather than bypassing it
- Extend `generate-copy` for map-origin projects rather than directly writing final slide copy into `carousel_project_slides`

## Why This Exists

The insight behind `Carousel Map` is:

- Long-form source material contains many topics
- Users first need to understand what topics are available
- Most creative value comes from solving the opening, especially slides 1 and 2
- Users often want to mix and match the best opening pieces instead of accepting one full generated output
- Only after the opening is strong should the system generate the rest of the carousel

So the product should not force one-pass "generate 6 slides" output as the primary path.

It should help the user move through:

1. understand the source
2. identify the topic
3. build the opening
4. expand into the rest of the carousel

## User-Facing Workflow

The intended V1 user flow is:

1. User opens Swipe File or YouTube mirrored Swipe item
2. User clicks `Carousel Map`
3. Full-screen map modal opens
4. User sees the source material as the root
5. User generates or reviews extracted topics
6. User selects exactly one topic
7. User generates many opening pairs for that topic
8. User reviews opening-pair cards
9. User drags or clicks a full pair or an individual `Slide 1` / `Slide 2` from an opening-pair card into the chosen opener
10. User generates slides `3-6`
11. User reviews expansion candidates
12. User picks one and runs `Create project + rewrite`
13. The project loads in the editor and auto-runs `generate-copy`

## UI Model

Use a structured left-to-right lane UI.

Do not build a totally freeform infinite canvas in V1.

### Lane order

- `Source`
- `Topics`
- `Opening Pairs`
- `Chosen Opening`
- `Expansions`

### Modal shell

Use a full-screen modal over Swipe File:

- title: `Carousel Map`
- subtitle: source title
- action buttons:
  - `Refresh`
  - `Close`

### Lane 1: Source

Purpose:
- show the root swipe item context

Contents:
- source title
- creator / author
- platform
- category
- note / angle notes
- caption preview
- transcript preview

### Lane 2: Topics

Purpose:
- show extracted topic options

Topic card fields:
- `title`
- `summary`
- `whyItMatters`

Controls:
- `Generate Topics`
- `Regenerate Topics`

Rules:
- one selected topic at a time in V1

### Lane 3: Opening Pairs

Purpose:
- generate coherent `Slide 1 + Slide 2` pairs from the selected topic
- act as the direct source-of-truth for opening selection and drag-copy interactions

Opening pair card fields:
- `title`
- `slide1`
- `slide2`
- `angleText`

Actions:
- `Drag pair`
- click or drag `Slide 1`
- click or drag `Slide 2`
- `Use pair`
- `Copy pair`

Rules:
- the original opening-pair card remains in place
- dragging or clicking copies content into `Chosen Opening`
- dragging the pair handle copies both slides
- dragging or clicking an individual slide copies only that slide

### Lane 4: Chosen Opening

Purpose:
- hold the user’s currently assembled opener

Slots:
- `Chosen Slide 1`
- `Chosen Slide 2`

Actions:
- `Clear Slide 1`
- `Clear Slide 2`
- `Copy opener`
- `Generate Slides 3-6`

### Lane 5: Expansions

Purpose:
- show the generated slides `3-6` for the chosen opener

Expansion card fields:
- selected `Slide 1`
- selected `Slide 2`
- `Slide 3`
- `Slide 4`
- `Slide 5`
- `Slide 6`

Actions:
- `Use for Project`
- `Copy full carousel`
- `Generate more`

## Exact Codebase Integration Points

These are the exact current files that should be treated as the integration anchors for the future implementation.

### Launch points

- `src/features/editor/components/SwipeFileModal.tsx`
  - Current desktop repurpose card contains:
    - `Create project + rewrite`
    - `Generate ideas`
    - `Open existing project`
  - Add `Carousel Map` in this same repurpose block.
  - Current local modal booleans already exist for:
    - `ideasChatOpen`
    - `ideasPickerOpen`
  - `Carousel Map` should follow this same local modal-state pattern.

- `src/features/editor/components/YoutubeCreatorFeedPanel.tsx`
  - Same repurpose block pattern exists here for mirrored Swipe items.
  - `Carousel Map` should only be available when `selectedVideo.mirroredSwipeItemId` exists and transcript is available.

### Reusable modal patterns

- `src/features/editor/components/SwipeIdeasChatModal.tsx`
  - Use as the visual baseline for a large full-screen editor modal.

- `src/features/editor/components/ScriptChatModal.tsx`
  - Use as a simple full-screen modal orchestration pattern.

### Existing project creation path to mirror

- `src/app/api/swipe-file/items/[id]/create-project/route.ts`
  - Loads saved prompt from `editor_poppy_saved_prompts`
  - Loads effective template settings via `loadEffectiveTemplateTypeSettings`
  - Creates `carousel_projects`
  - Inserts six `carousel_project_slides`
  - Writes origin metadata such as:
    - `source_swipe_item_id`
    - `source_swipe_angle_snapshot`
    - `source_swipe_idea_id`
    - `source_swipe_idea_snapshot`

- `src/app/api/editor/projects/jobs/generate-copy/route.ts`
  - This is where template-type-specific output is generated.
  - `Carousel Map` should integrate here by adding a new map-origin branch, not by bypassing this route.

### Existing picker / prompt preview patterns to mirror

- `src/features/editor/components/SwipeIdeasPickerModal.tsx`
- `src/app/api/swipe-file/items/[id]/ideas/prompt-preview/route.ts`

These should be reused as references for:
- template type selection
- saved prompt selection
- prompt preview sections
- final create-project confirmation flow

## New Files To Create

### Frontend

- `src/features/editor/components/CarouselMapModal.tsx`
- `src/features/editor/components/CarouselMapProjectPickerModal.tsx`
- `src/features/editor/components/carousel-map/CarouselMapSourceLane.tsx`
- `src/features/editor/components/carousel-map/CarouselMapTopicsLane.tsx`
- `src/features/editor/components/carousel-map/CarouselMapOpeningPairsLane.tsx`
- `src/features/editor/components/carousel-map/CarouselMapSlidePoolLane.tsx`
- `src/features/editor/components/carousel-map/CarouselMapChosenOpeningLane.tsx`
- `src/features/editor/components/carousel-map/CarouselMapExpansionsLane.tsx`
- `src/features/editor/components/carousel-map/types.ts`

### Backend

- `src/app/api/carousel-map/_shared.ts`
- `src/app/api/carousel-map/_types.ts`
- `src/app/api/carousel-map/by-swipe-item/[id]/route.ts`
- `src/app/api/carousel-map/[mapId]/route.ts`
- `src/app/api/carousel-map/[mapId]/topics/generate/route.ts`
- `src/app/api/carousel-map/[mapId]/topics/select/route.ts`
- `src/app/api/carousel-map/[mapId]/opening-pairs/generate/route.ts`
- `src/app/api/carousel-map/[mapId]/selection/route.ts`
- `src/app/api/carousel-map/[mapId]/expansions/generate/route.ts`
- `src/app/api/carousel-map/[mapId]/prompt-preview/route.ts`
- `src/app/api/carousel-map/[mapId]/create-project/route.ts`

### Migrations

- `supabase/migrations/20260324_000001_add_carousel_map_v1.sql`
- `supabase/migrations/20260324_000002_extend_carousel_projects_for_carousel_map.sql`

## Exact Migration SQL Shapes

These SQL shapes are implementation-ready and intentionally mirror the existing repo style for RLS, account scoping, and superadmin gating.

### Migration 1
Suggested filename:
`supabase/migrations/20260324_000001_add_carousel_map_v1.sql`

```sql
-- /editor: Carousel Map (V1)
-- Persistent map workspace for source -> topics -> opening pairs -> expansions.
-- Superadmin-only and account-scoped (mirrors Swipe File ideas/chat access model).

-- =========================
-- 1) Root map
-- =========================
create table if not exists public.carousel_maps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  swipe_item_id uuid not null references public.swipe_file_items(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  selected_topic_id uuid null,
  selected_slide1_source_pair_id uuid null,
  selected_slide1_text text null,
  selected_slide2_source_pair_id uuid null,
  selected_slide2_text text null
);

create unique index if not exists carousel_maps_account_item_uidx
  on public.carousel_maps (account_id, swipe_item_id);

create index if not exists carousel_maps_account_created_at_idx
  on public.carousel_maps (account_id, created_at desc);

alter table public.carousel_maps enable row level security;

drop policy if exists "carousel_maps_select_superadmin" on public.carousel_maps;
create policy "carousel_maps_select_superadmin"
  on public.carousel_maps
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_maps_insert_superadmin" on public.carousel_maps;
create policy "carousel_maps_insert_superadmin"
  on public.carousel_maps
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_maps_update_superadmin" on public.carousel_maps;
create policy "carousel_maps_update_superadmin"
  on public.carousel_maps
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_maps_delete_superadmin" on public.carousel_maps;
create policy "carousel_maps_delete_superadmin"
  on public.carousel_maps
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_maps to authenticated;

-- =========================
-- 2) Topics
-- =========================
create table if not exists public.carousel_map_topics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  carousel_map_id uuid not null references public.carousel_maps(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  source_generation_key uuid not null,
  sort_order integer not null default 0,
  title text not null,
  summary text not null,
  why_it_matters text not null
);

create index if not exists carousel_map_topics_map_created_at_idx
  on public.carousel_map_topics (carousel_map_id, created_at asc);

create index if not exists carousel_map_topics_map_generation_idx
  on public.carousel_map_topics (carousel_map_id, source_generation_key, sort_order asc);

create index if not exists carousel_map_topics_account_created_at_idx
  on public.carousel_map_topics (account_id, created_at desc);

alter table public.carousel_map_topics enable row level security;

drop policy if exists "carousel_map_topics_select_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_select_superadmin"
  on public.carousel_map_topics
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_topics_insert_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_insert_superadmin"
  on public.carousel_map_topics
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_topics_update_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_update_superadmin"
  on public.carousel_map_topics
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_topics_delete_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_delete_superadmin"
  on public.carousel_map_topics
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_map_topics to authenticated;

-- =========================
-- 3) Opening pairs
-- =========================
create table if not exists public.carousel_map_opening_pairs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  carousel_map_id uuid not null references public.carousel_maps(id) on delete cascade,
  topic_id uuid not null references public.carousel_map_topics(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  source_generation_key uuid not null,
  sort_order integer not null default 0,
  title text not null,
  slide1 text not null,
  slide2 text not null,
  angle_text text not null
);

create index if not exists carousel_map_opening_pairs_map_created_at_idx
  on public.carousel_map_opening_pairs (carousel_map_id, created_at asc);

create index if not exists carousel_map_opening_pairs_topic_generation_idx
  on public.carousel_map_opening_pairs (topic_id, source_generation_key, sort_order asc);

create index if not exists carousel_map_opening_pairs_account_created_at_idx
  on public.carousel_map_opening_pairs (account_id, created_at desc);

alter table public.carousel_map_opening_pairs enable row level security;

drop policy if exists "carousel_map_opening_pairs_select_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_select_superadmin"
  on public.carousel_map_opening_pairs
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_opening_pairs_insert_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_insert_superadmin"
  on public.carousel_map_opening_pairs
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_opening_pairs_update_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_update_superadmin"
  on public.carousel_map_opening_pairs
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_opening_pairs_delete_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_delete_superadmin"
  on public.carousel_map_opening_pairs
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_map_opening_pairs to authenticated;

-- =========================
-- 4) Expansions
-- =========================
create table if not exists public.carousel_map_expansions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  carousel_map_id uuid not null references public.carousel_maps(id) on delete cascade,
  topic_id uuid not null references public.carousel_map_topics(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  source_generation_key uuid not null,
  sort_order integer not null default 0,
  selected_slide1_source_pair_id uuid null references public.carousel_map_opening_pairs(id) on delete set null,
  selected_slide2_source_pair_id uuid null references public.carousel_map_opening_pairs(id) on delete set null,
  selected_slide1_text text not null,
  selected_slide2_text text not null,
  slide3 text not null,
  slide4 text not null,
  slide5 text not null,
  slide6 text not null
);

create index if not exists carousel_map_expansions_map_created_at_idx
  on public.carousel_map_expansions (carousel_map_id, created_at asc);

create index if not exists carousel_map_expansions_topic_generation_idx
  on public.carousel_map_expansions (topic_id, source_generation_key, sort_order asc);

create index if not exists carousel_map_expansions_account_created_at_idx
  on public.carousel_map_expansions (account_id, created_at desc);

alter table public.carousel_map_expansions enable row level security;

drop policy if exists "carousel_map_expansions_select_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_select_superadmin"
  on public.carousel_map_expansions
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_expansions_insert_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_insert_superadmin"
  on public.carousel_map_expansions
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_expansions_update_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_update_superadmin"
  on public.carousel_map_expansions
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_expansions_delete_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_delete_superadmin"
  on public.carousel_map_expansions
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_map_expansions to authenticated;

-- =========================
-- 5) Back-references on root map
-- =========================
alter table public.carousel_maps
  drop constraint if exists carousel_maps_selected_topic_id_fkey;

alter table public.carousel_maps
  add constraint carousel_maps_selected_topic_id_fkey
  foreign key (selected_topic_id)
  references public.carousel_map_topics(id)
  on delete set null;

alter table public.carousel_maps
  drop constraint if exists carousel_maps_selected_slide1_source_pair_id_fkey;

alter table public.carousel_maps
  add constraint carousel_maps_selected_slide1_source_pair_id_fkey
  foreign key (selected_slide1_source_pair_id)
  references public.carousel_map_opening_pairs(id)
  on delete set null;

alter table public.carousel_maps
  drop constraint if exists carousel_maps_selected_slide2_source_pair_id_fkey;

alter table public.carousel_maps
  add constraint carousel_maps_selected_slide2_source_pair_id_fkey
  foreign key (selected_slide2_source_pair_id)
  references public.carousel_map_opening_pairs(id)
  on delete set null;

-- =========================
-- 6) updated_at trigger on root map
-- =========================
create or replace function public.touch_carousel_maps_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_touch_carousel_maps_updated_at on public.carousel_maps;
create trigger trigger_touch_carousel_maps_updated_at
  before update on public.carousel_maps
  for each row
  execute function public.touch_carousel_maps_updated_at();
```

### Migration 2
Suggested filename:
`supabase/migrations/20260324_000002_extend_carousel_projects_for_carousel_map.sql`

```sql
-- /editor: Carousel Map -> project rewrite provenance
-- Stores the selected Carousel Map expansion snapshot on carousel_projects
-- so generate-copy can produce the final template-specific 6-slide output.

alter table if exists public.carousel_projects
  add column if not exists source_carousel_map_id uuid null references public.carousel_maps(id) on delete set null,
  add column if not exists source_carousel_map_expansion_id uuid null references public.carousel_map_expansions(id) on delete set null,
  add column if not exists source_carousel_map_topic_snapshot text null,
  add column if not exists source_carousel_map_selected_slide1_snapshot text null,
  add column if not exists source_carousel_map_selected_slide2_snapshot text null,
  add column if not exists source_carousel_map_expansion_snapshot text null;

create index if not exists carousel_projects_source_carousel_map_id_idx
  on public.carousel_projects (source_carousel_map_id);

create index if not exists carousel_projects_source_carousel_map_expansion_id_idx
  on public.carousel_projects (source_carousel_map_expansion_id);
```

## Exact TypeScript Interfaces

These interfaces are the exact recommended types for the new files.

### `src/app/api/carousel-map/_types.ts`

```ts
export type TemplateTypeId = "regular" | "enhanced";

export interface CarouselMapRow {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  swipe_item_id: string;
  created_by_user_id: string;
  selected_topic_id: string | null;
  selected_slide1_source_pair_id: string | null;
  selected_slide1_text: string | null;
  selected_slide2_source_pair_id: string | null;
  selected_slide2_text: string | null;
}

export interface CarouselMapTopicRow {
  id: string;
  created_at: string;
  account_id: string;
  carousel_map_id: string;
  created_by_user_id: string;
  source_generation_key: string;
  sort_order: number;
  title: string;
  summary: string;
  why_it_matters: string;
}

export interface CarouselMapOpeningPairRow {
  id: string;
  created_at: string;
  account_id: string;
  carousel_map_id: string;
  topic_id: string;
  created_by_user_id: string;
  source_generation_key: string;
  sort_order: number;
  title: string;
  slide1: string;
  slide2: string;
  angle_text: string;
}

export interface CarouselMapExpansionRow {
  id: string;
  created_at: string;
  account_id: string;
  carousel_map_id: string;
  topic_id: string;
  created_by_user_id: string;
  source_generation_key: string;
  sort_order: number;
  selected_slide1_source_pair_id: string | null;
  selected_slide2_source_pair_id: string | null;
  selected_slide1_text: string;
  selected_slide2_text: string;
  slide3: string;
  slide4: string;
  slide5: string;
  slide6: string;
}

export interface CarouselMapSourceContext {
  swipeItemId: string;
  title: string;
  platform: string;
  authorHandle: string;
  categoryName: string;
  caption: string;
  transcript: string;
  note: string;
  createdProjectId: string | null;
}

export interface CarouselMapTopic {
  id: string;
  createdAt: string;
  sourceGenerationKey: string;
  sortOrder: number;
  title: string;
  summary: string;
  whyItMatters: string;
}

export interface CarouselMapOpeningPair {
  id: string;
  createdAt: string;
  topicId: string;
  sourceGenerationKey: string;
  sortOrder: number;
  title: string;
  slide1: string;
  slide2: string;
  angleText: string;
}

export interface CarouselMapExpansion {
  id: string;
  createdAt: string;
  topicId: string;
  sourceGenerationKey: string;
  sortOrder: number;
  selectedSlide1SourcePairId: string | null;
  selectedSlide2SourcePairId: string | null;
  selectedSlide1Text: string;
  selectedSlide2Text: string;
  slide3: string;
  slide4: string;
  slide5: string;
  slide6: string;
}

export interface CarouselMapHydratedState {
  map: {
    id: string;
    selectedTopicId: string | null;
    selectedSlide1SourcePairId: string | null;
    selectedSlide1Text: string | null;
    selectedSlide2SourcePairId: string | null;
    selectedSlide2Text: string | null;
    createdAt: string;
    updatedAt: string;
  };
  source: CarouselMapSourceContext;
  topics: CarouselMapTopic[];
  openingPairs: CarouselMapOpeningPair[];
  expansions: CarouselMapExpansion[];
}

export interface CarouselMapTopicModelOut {
  title: string;
  summary: string;
  whyItMatters: string;
}

export interface CarouselMapOpeningPairModelOut {
  title: string;
  slide1: string;
  slide2: string;
  angleText: string;
}

export interface CarouselMapExpansionModelOut {
  slide3: string;
  slide4: string;
  slide5: string;
  slide6: string;
}

export interface GetCarouselMapBySwipeItemResp {
  success: true;
  map: { id: string } | null;
}

export interface CreateOrLoadCarouselMapResp {
  success: true;
  map: { id: string };
}

export interface GetCarouselMapResp {
  success: true;
  state: CarouselMapHydratedState;
}

export interface GenerateCarouselMapTopicsBody {
  replaceExisting?: boolean;
}

export interface GenerateCarouselMapTopicsResp {
  success: true;
  topics: CarouselMapTopic[];
}

export interface SelectCarouselMapTopicBody {
  topicId: string;
}

export interface SelectCarouselMapTopicResp {
  success: true;
}

export interface GenerateCarouselMapOpeningPairsBody {
  topicId: string;
  count?: number;
  replaceExisting?: boolean;
}

export interface GenerateCarouselMapOpeningPairsResp {
  success: true;
  openingPairs: CarouselMapOpeningPair[];
}

export interface UpdateCarouselMapSelectionBody {
  selectedSlide1SourcePairId: string | null;
  selectedSlide1Text: string | null;
  selectedSlide2SourcePairId: string | null;
  selectedSlide2Text: string | null;
}

export interface UpdateCarouselMapSelectionResp {
  success: true;
}

export interface GenerateCarouselMapExpansionsBody {
  topicId: string;
  selectedSlide1SourcePairId?: string | null;
  selectedSlide2SourcePairId?: string | null;
  selectedSlide1Text: string;
  selectedSlide2Text: string;
  count?: number;
  replaceExisting?: boolean;
}

export interface GenerateCarouselMapExpansionsResp {
  success: true;
  expansions: CarouselMapExpansion[];
}

export interface CarouselMapPromptPreviewSection {
  id: string;
  title: string;
  content: string;
}

export interface CarouselMapPromptPreviewBody {
  templateTypeId: TemplateTypeId;
  savedPromptId: string;
  expansionId: string;
}

export interface CarouselMapPromptPreviewResp {
  success: true;
  fullPrompt: string;
  sections: CarouselMapPromptPreviewSection[];
}

export interface CreateCarouselMapProjectBody {
  templateTypeId: TemplateTypeId;
  savedPromptId: string;
  expansionId: string;
}

export interface CreateCarouselMapProjectResp {
  success: true;
  projectId: string;
}

export interface ErrorResp {
  success: false;
  error: string;
}
```

### `src/features/editor/components/carousel-map/types.ts`

```ts
export type TemplateTypeId = "regular" | "enhanced";

export interface CarouselMapRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  selectedTopicId: string | null;
  selectedSlide1SourcePairId: string | null;
  selectedSlide1Text: string | null;
  selectedSlide2SourcePairId: string | null;
  selectedSlide2Text: string | null;
}

export interface CarouselMapSourceCard {
  swipeItemId: string;
  title: string;
  platform: string;
  authorHandle: string;
  categoryName: string;
  caption: string;
  transcript: string;
  note: string;
  createdProjectId: string | null;
}

export interface CarouselMapTopicCard {
  id: string;
  createdAt: string;
  sourceGenerationKey: string;
  sortOrder: number;
  title: string;
  summary: string;
  whyItMatters: string;
}

export interface CarouselMapOpeningPairCard {
  id: string;
  createdAt: string;
  topicId: string;
  sourceGenerationKey: string;
  sortOrder: number;
  title: string;
  slide1: string;
  slide2: string;
  angleText: string;
}

export interface CarouselMapExpansionCard {
  id: string;
  createdAt: string;
  topicId: string;
  sourceGenerationKey: string;
  sortOrder: number;
  selectedSlide1SourcePairId: string | null;
  selectedSlide2SourcePairId: string | null;
  selectedSlide1Text: string;
  selectedSlide2Text: string;
  slide3: string;
  slide4: string;
  slide5: string;
  slide6: string;
}

export interface CarouselMapChosenOpening {
  selectedSlide1SourcePairId: string | null;
  selectedSlide1Text: string | null;
  selectedSlide2SourcePairId: string | null;
  selectedSlide2Text: string | null;
}

export interface CarouselMapHydratedState {
  map: CarouselMapRecord;
  source: CarouselMapSourceCard;
  topics: CarouselMapTopicCard[];
  openingPairs: CarouselMapOpeningPairCard[];
  expansions: CarouselMapExpansionCard[];
}

export interface CarouselMapSlideCandidate {
  key: string;
  pairId: string;
  topicId: string;
  sourceGenerationKey: string;
  pairTitle: string;
  kind: "slide1" | "slide2";
  text: string;
}

export interface CarouselMapModalProps {
  open: boolean;
  onClose: () => void;
  swipeItemId: string | null;
  swipeItemLabel: string;
  onProjectCreated?: (projectId: string) => void;
}

export interface CarouselMapProjectPickerModalProps {
  open: boolean;
  onClose: () => void;
  mapId: string | null;
  swipeItemId: string | null;
  swipeItemLabel: string;
  selectedExpansion: CarouselMapExpansionCard | null;
  initialTemplateTypeId: TemplateTypeId;
  initialSavedPromptId: string;
  onSelectionChange?: (args: { templateTypeId: TemplateTypeId; savedPromptId: string }) => void;
  onPick: (args: {
    expansionId: string;
    templateTypeId: TemplateTypeId;
    savedPromptId: string;
  }) => void;
}

export interface CarouselMapSourceLaneProps {
  source: CarouselMapSourceCard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export interface CarouselMapTopicsLaneProps {
  topics: CarouselMapTopicCard[];
  selectedTopicId: string | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onSelectTopic: (topicId: string) => void;
}

export interface CarouselMapOpeningPairsLaneProps {
  selectedTopic: CarouselMapTopicCard | null;
  openingPairs: CarouselMapOpeningPairCard[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onUsePair: (pair: CarouselMapOpeningPairCard) => void;
  onCopyPair: (pair: CarouselMapOpeningPairCard) => void;
}

export interface CarouselMapSlidePoolLaneProps {
  selectedTopic: CarouselMapTopicCard | null;
  slide1Candidates: CarouselMapSlideCandidate[];
  slide2Candidates: CarouselMapSlideCandidate[];
  selectedSlide1SourcePairId: string | null;
  selectedSlide2SourcePairId: string | null;
  onUseSlide1: (candidate: CarouselMapSlideCandidate) => void;
  onUseSlide2: (candidate: CarouselMapSlideCandidate) => void;
}

export interface CarouselMapChosenOpeningLaneProps {
  selectedTopic: CarouselMapTopicCard | null;
  chosenOpening: CarouselMapChosenOpening;
  generating: boolean;
  error: string | null;
  onClearSlide1: () => void;
  onClearSlide2: () => void;
  onCopyOpening: () => void;
  onGenerateExpansions: () => void;
}

export interface CarouselMapExpansionsLaneProps {
  selectedTopic: CarouselMapTopicCard | null;
  expansions: CarouselMapExpansionCard[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  selectedExpansionId: string | null;
  onSelectExpansion: (expansionId: string) => void;
  onCopyExpansion: (expansion: CarouselMapExpansionCard) => void;
  onCreateProject: (expansion: CarouselMapExpansionCard) => void;
}
```

## Shared Prompt Strategy

V1 should use three distinct AI stages:

### Topics
Inputs:
- source transcript
- caption
- title
- author
- category
- note

Output shape:

```json
{
  "topics": [
    {
      "title": "string",
      "summary": "string",
      "whyItMatters": "string"
    }
  ]
}
```

### Opening pairs
Inputs:
- selected topic
- source transcript
- caption
- note
- brand voice

Output shape:

```json
{
  "pairs": [
    {
      "title": "string",
      "slide1": "string",
      "slide2": "string",
      "angleText": "string"
    }
  ]
}
```

### Expansions
Inputs:
- selected topic
- selected slide 1
- selected slide 2
- source transcript
- caption
- note
- brand voice

Output shape:

```json
{
  "expansions": [
    {
      "slide3": "string",
      "slide4": "string",
      "slide5": "string",
      "slide6": "string"
    }
  ]
}
```

## Final Project Creation Architecture

After reading the actual current codebase, this is the correct V1 approach:

1. `Carousel Map` persists topics, opening pairs, and expansions in its own tables
2. User selects an expansion and enters a final picker modal
3. Picker chooses:
   - `templateTypeId`
   - `savedPromptId`
4. `POST /api/carousel-map/[mapId]/create-project`:
   - creates a `carousel_projects` row
   - stores:
     - `prompt_snapshot`
     - `source_swipe_item_id`
     - `source_carousel_map_id`
     - `source_carousel_map_expansion_id`
     - topic/opening/expansion snapshots
   - inserts six empty `carousel_project_slides`
5. Frontend loads the created project
6. Existing `generate-copy` auto-run behavior should be reused
7. `generate-copy` gets a new `carousel map` branch that reads the frozen map snapshot and the saved prompt snapshot to produce final template-specific slide output

This is different from an earlier draft idea to seed final slide text directly into project slides.

That earlier approach should be treated as superseded.

Why it is superseded:
- the current `create-project + rewrite` architecture freezes prompt snapshots first, then lets `generate-copy` create the final structured output
- enhanced templates expect generated `headline/body` formatting behavior
- bypassing `generate-copy` would make the selected saved prompt much less meaningful

## V1 Scope

Build in V1:

- `Carousel Map` button in `SwipeFileModal.tsx`
- `Carousel Map` button in `YoutubeCreatorFeedPanel.tsx`
- one map per `account_id + swipe_item_id`
- full-screen modal
- topic generation
- one selected topic
- opening pair generation
- opening-pair cards as the direct source for full-pair and per-slide drag/copy
- chosen opener persistence
- expansion generation
- final map-specific project picker modal
- map-specific create-project route
- new `generate-copy` branch for map-origin projects

Do not build in V1:

- multiple maps per swipe item
- freeform graph coordinates
- graph connector lines
- branch duplication
- map comments / annotations
- replacing `Generate ideas`

## Remaining V2 Backlog

Build next in V2:

- multiple maps per swipe item
- branch duplication
- topic comparison
- opener comparison
- saved favorite openers
- map version history
- route-level map surface if needed
- freeform graph coordinates if the product moves beyond the current structured lane layout
- map comments / annotations if collaborative review becomes important

## Shipped V1 + Early V2 Work

The current implementation was completed in this general order:

1. added `carousel_map` migrations and `carousel_projects` provenance fields
2. added shared backend types and helpers under `src/app/api/carousel-map/`
3. implemented create/load map routes
4. implemented topic generation
5. implemented opening-pair generation
6. implemented opening selection persistence
7. implemented expansion generation
8. implemented prompt-preview and create-project routes
9. extended `generate-copy` for map-origin projects
10. built the full-screen `CarouselMapModal`
11. added the map-specific project picker modal
12. added entry buttons in Swipe File and YouTube mirrored flow
13. updated docs and the codebase map
14. added visible lineage lines and source-provenance cues across the current structured lane layout

## Final Guidance For Future Sessions

If resuming this feature in a future session:

- treat this file as authoritative
- do not merge Carousel Map into the existing `Generate ideas` feature
- do not change the button label away from `Carousel Map` unless explicitly asked
- do not bypass the existing create-project + generate-copy architecture in V1
- use the exact table and type shapes above unless the user changes scope

