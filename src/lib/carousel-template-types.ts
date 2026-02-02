// Type definitions for Carousel Template system (MVP: slide 1 only stored as slides[0])

export type TemplateAssetKind =
  | 'avatar'
  | 'footer_icon'
  | 'cta_pill_image'
  | 'other_image'
  | 'display_name'
  | 'handle'
  | 'cta_text'
  | 'other_text'
  | 'shape_rect'
  | 'shape_arrow_solid'
  | 'shape_arrow_line';

export interface TemplateRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateTextStyle {
  fontFamily: string;
  fontSize: number;
  // Fabric accepts string or numeric weights. We support numeric weights to allow entries like Open Sans Light (300).
  fontWeight?: 'normal' | 'bold' | number;
  fill: string; // hex color
  textAlign?: 'left' | 'center' | 'right';
}

export interface TemplateAssetBase {
  id: string;
  kind: TemplateAssetKind;
  name?: string;
  rect: TemplateRect; // top-left in 1080x1440 canvas coords
  rotation?: 0; // rotation is disallowed (kept for schema clarity)
  zIndex?: number;
  locked?: boolean; // mainly informational; normal mode will lock all template assets
}

export interface TemplateImageAsset extends TemplateAssetBase {
  type: 'image';
  src: {
    bucket: 'carousel-templates';
    path: string; // carousel-templates/{templateId}/assets/{assetId}.{ext} (path *within* bucket)
    url: string; // public URL (getPublicUrl)
    contentType?: string;
  };
  // Optional: the image's intrinsic size can be stored for editor UX; not required for rendering.
  intrinsic?: { width: number; height: number };
  // Optional: non-destructive masking/crop metadata (Template Editor + /editor rendering).
  // These fields are intentionally optional for backward compatibility with older templates.
  maskShape?: 'none' | 'circle';
  crop?: {
    // Multiplier on top of the "cover" scale that ensures the mask is fully filled.
    // 1.0 means "just cover"; higher values zoom in further.
    scale: number;
    // Offsets applied to the image *inside* the mask, in template-canvas pixels (1080×1440 space),
    // where positive x moves the image right and positive y moves it down.
    offsetX: number;
    offsetY: number;
  };
}

export interface TemplateTextAsset extends TemplateAssetBase {
  type: 'text';
  text: string;
  style: TemplateTextStyle;
}

export interface TemplateShapeStyle {
  fill: string; // CSS color (prefer hex for UI color picker compatibility)
  stroke?: string; // CSS color
  strokeWidth?: number;
}

export interface TemplateShapeAsset extends TemplateAssetBase {
  type: 'shape';
  shape: 'rect' | 'arrow_solid' | 'arrow_line';
  // Rounded corner radius in template-canvas pixels (1080x1440 coordinate space).
  cornerRadius?: number;
  style: TemplateShapeStyle;
  // Arrow-only settings (ignored for non-arrow shapes).
  // Head size can be expressed either as:
  // - an absolute length in template pixels (preferred), or
  // - a percentage (legacy; kept for backward compatibility with older saved templates).
  //
  // When both are present, renderers should prefer `arrowHeadSizePx`.
  arrowHeadSizePx?: number;
  // Legacy: head size expressed as a percentage (older templates).
  arrowHeadSizePct?: number; // 0..100
}

export type TemplateAsset = TemplateImageAsset | TemplateTextAsset | TemplateShapeAsset;

export interface TemplateSlideDefinitionV1 {
  slideIndex: number; // slide 1 is 0
  contentRegion: TemplateRect; // OUTER safe box; placement clamps use inner padding
  // Optional friendly name for the content region layer in the Template Editor.
  // Stored in the template definition JSONB for persistence.
  contentRegionName?: string;
  assets: TemplateAsset[];
}

export interface CarouselTemplateDefinitionV1 {
  template_version: 1;
  slides: TemplateSlideDefinitionV1[]; // MVP uses slides[0] only
  // Optional global template metadata
  allowedFonts?: string[]; // Google Fonts families allowed for this template
}

export interface CarouselTemplateRow {
  id: string;
  name: string;
  owner_user_id: string;
  definition: CarouselTemplateDefinitionV1;
  created_at: string;
  updated_at: string;
}



