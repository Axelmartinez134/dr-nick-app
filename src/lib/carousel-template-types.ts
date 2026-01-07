// Type definitions for Carousel Template system (MVP: slide 1 only stored as slides[0])

export type TemplateAssetKind =
  | 'avatar'
  | 'footer_icon'
  | 'cta_pill_image'
  | 'other_image'
  | 'display_name'
  | 'handle'
  | 'cta_text'
  | 'other_text';

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
}

export interface TemplateTextAsset extends TemplateAssetBase {
  type: 'text';
  text: string;
  style: TemplateTextStyle;
}

export type TemplateAsset = TemplateImageAsset | TemplateTextAsset;

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



