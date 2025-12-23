// Type definitions for AI Carousel Generator

export interface CarouselTextRequest {
  headline: string;
  body: string;
  settings?: {
    backgroundColor?: string;
    textColor?: string;
    includeImage?: boolean;
    imagePrompt?: string;
  };
}

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

export interface LayoutResponse {
  success: boolean;
  layout?: TextLayoutDecision;
  imageUrl?: string;
  error?: string;
}

