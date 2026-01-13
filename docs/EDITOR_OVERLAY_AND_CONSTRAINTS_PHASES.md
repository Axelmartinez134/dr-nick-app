# Editor Overlay + Silhouette Constraint Rollout (Phased Plan)

This document captures the agreed phased implementation plan for hardening the editor’s silhouette-aware wrapping + interaction model.

**Process rule:** After each phase is completed, the user reviews in the UI and explicitly approves proceeding to the next phase.

---

## Phase 1 — Debug overlays (visualization only; no behavior change)

### Goal
Make the layout system debuggable so we can see exactly what the engine thinks the boundaries are.

### Scope (must not change behavior)
- No changes to wrapping logic, drag constraints, or persistence.
- Only add visual overlays + a toggle to enable/disable them.

### Visual overlays (on-canvas)
- **Template contentRegion (outer)**: the template-defined safe area.
- **Wrap content rect / allowed rect (inset)**: the area the wrap engine actually uses (e.g., contentRegion inset by padding).
- **Image bounds used by layout**: the image rectangle used by the deterministic engine (`layout.image` bounds).
- **Silhouette mask overlay**: a translucent overlay derived from `layout.image.mask` / `imageAlphaMask` to visualize the keep-out silhouette.
- Optional (later within Phase 1 if helpful): lane/spans visualization used by wrap-flow (blocked spans / free spans).

### UI
- Add a toggle (e.g., in `/editor` Debug panel) to turn overlays on/off.

### Acceptance criteria
- Overlays are visible on the canvas when enabled and disappear when disabled.
- Overlays remain visible even after async image/template assets load (no “only top-left visible” due to stacking).
- No regressions to existing canvas behavior.

### Gate
User verifies Phase 1 visually and replies: **“Proceed to Phase 2.”**

---

## Phase 2 — Mask-based overlap detection + invalid highlight (no auto-fix)

### Goal
Allow free movement while making invalid overlap states obvious, using the silhouette (mask), not the image bounding box.

### UX rules
- During drag/scale:
  - Text is allowed to overlap the silhouette temporarily.
  - If invalid, show a clear visual indicator (e.g., red stroke/tint on the text object).

### Validity test (confirmed)
- Treat the dragged text line’s **AABB as solid**.
- If it intersects any **masked (silhouette) pixels**, it is **invalid**.
- Text remains clamped to the content rect (confirmed).

### Scope
- Implement in Enhanced mode.
- No snapping/auto-fix yet (that’s Phase 3).

### Acceptance criteria
- Dragging a line into the silhouette turns it “invalid” (red).
- Dragging away removes invalid highlight.
- No snapping/jumping away from silhouette during drag in Enhanced mode (unless explicitly desired later).

### Gate
User verifies Phase 2 behavior and replies: **“Proceed to Phase 3.”**

---

## Phase 3 — On-release auto-fix (minimal nudge in X/Y; dragged line only)

### Goal
Hybrid interaction: allow overlap while dragging, but auto-resolve invalid overlap on release while preserving user intent.

### Auto-fix policy (confirmed)
- On release:
  - If invalid, **nudge in X/Y only** (translate the box).
  - Do **not** resize the line width.
  - Do **not** change font size.
- Only adjust the **dragged line** (confirmed). No reflow of other lines in v1.

### “Keep user intent” definition (confirmed)
- Prefer the closest valid placement to the dropped position (minimal movement).

### Acceptance criteria
- Drag line into silhouette → it shows invalid state while dragging → on release it moves slightly to the nearest valid area.
- Other lines remain unchanged.

### Gate
User verifies Phase 3 behavior and replies: **“Proceed to Phase 4.”**

---

## Phase 4 — Persist per-line constraints keyed by source ranges (survive reflow)

### Goal
Turn manual line edits into durable “intent” that survives future reflow as long as the underlying source text range still exists.

### Persistence rules (confirmed)
- Constraints are **per-line** (fine control).
- Constraints remain valid across minor text edits **as long as the affected source range still exists**.

### Data model (conceptual)
- Store per-line overrides keyed by a stable identity derived from wrap engine metadata:
  - `{ block, paragraphIndex?, sourceStart, sourceEnd }`
- Values to persist:
  - `{ x, y, maxWidth }` (width scaling included as an editable action)

### Reflow integration
- When deterministic layout recomputes:
  - Map new lines to prior source ranges.
  - Apply any persisted overrides where the range still matches.
  - If an override results in invalid overlap after changes, drop/relax that override (exact policy TBD within this phase).

### Acceptance criteria
- Move/resize a line → it persists across:
  - slide switching and returning
  - image move triggering re-layout
  - minor copy edits that keep the underlying range intact
- If the underlying range no longer exists, the override stops applying.

### Gate
User verifies Phase 4 behavior and replies: **“Proceed to Phase 5.”**

---

## Phase 5 — Hardening + performance + UX polish

### Goal
Make the feature reliable, fast, and predictable under real usage.

### Hardening checklist
- **Performance**
  - Cache mask sampling structures for fast AABB→mask intersection checks.
  - Throttle overlap checks during drag if needed (keep editor responsive).
- **Determinism**
  - Same inputs → same output layout (especially important for saves/exports).
- **Graceful fallbacks**
  - If mask missing/invalid → fallback to rectangle-based keep-out (or disable silhouette rules with a clear indicator).
- **Robust failure modes**
  - If auto-fix cannot find a valid spot within bounds → show a clear warning and avoid destructive movement.
- **UX**
  - Clear invalid styling
  - Optional tooltip explaining why it’s invalid
  - Optional debug overlay improvements (blocked spans/lane visualization)

### Gate
User confirms Phase 5 readiness and priorities for any next expansions (e.g., constrained multi-line reflow, removing manual realign button, etc.).

