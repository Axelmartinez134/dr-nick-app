// Type definitions for AI Carousel Generator (Vision-Based)

export interface CarouselTextRequest {
  headline: string;
  body: string;
  templateId?: string; // Optional carousel template to constrain layout (templates MVP)
  // Optional rich-text styling (used by /editor): keep headline/body as plain text,
  // store formatting as ranges in the input snapshot.
  headlineStyleRanges?: any[];
  bodyStyleRanges?: any[];
  settings?: {
    backgroundColor?: string;
    textColor?: string;
    includeImage?: boolean;
    imagePrompt?: string;
  };
}

// Style range for inline text formatting
export interface TextStyle {
  start: number;  // Character index
  end: number;    // Character index
  fontWeight?: 'bold' | 'normal';
  fontStyle?: 'italic' | 'normal';
  fill?: string;  // Color (future use)
  underline?: boolean;  // Future use
}

// Single text line with mixed formatting
export interface TextLine {
  text: string;
  baseSize: number;  // Base font size for the line
  position: { x: number; y: number };
  // Optional anchor hint for renderers (JSON snapshot only).
  // When set to 'center', the renderer should interpret position.y as centerY.
  positionAnchorY?: 'top' | 'center';
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;  // Claude decides spacing
  maxWidth?: number;   // Optional width constraint
  styles: TextStyle[]; // Style ranges within the line
}

// Vision-based layout decision
export interface VisionLayoutDecision {
  canvas: { width: 1080; height: 1440 };
  textLines: TextLine[];
  image?: {
    x: number;
    y: number;
    width: number;
    height: number;
    url: string;  // Base64 data URL
  };
  margins: { top: 60; right: 60; bottom: 60; left: 60 };
}

export interface LayoutResponse {
  success: boolean;
  layout?: VisionLayoutDecision;
  imageUrl?: string;  // Base64 data URL
  error?: string;
}

// Legacy type for backward compatibility (will be removed)
export interface TextLayoutDecision {
  canvas: { width: 1080; height: 1440 };
  headline: {
    x: number;
    y: number;
    fontSize: number;
    maxWidth: number;
    textAlign: 'left' | 'center' | 'right';
    fontWeight: 'normal' | 'bold';
  };
  body: {
    x: number;
    y: number;
    fontSize: number;
    maxWidth: number;
    lineHeight: number;
    textAlign: 'left' | 'center' | 'right';
    fontWeight: 'normal' | 'bold';
  };
  image?: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
  };
  margins: { top: 60; right: 60; bottom: 60; left: 60 };
}

