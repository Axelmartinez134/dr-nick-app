// Type definitions for AI Carousel Generator

export interface CarouselTextRequest {
  headline: string;
  body: string;
  settings?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

export interface TextLayoutDecision {
  canvas: { width: 1080; height: 1080 };
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
  margins: { top: 60; right: 60; bottom: 60; left: 60 };
}

export interface LayoutResponse {
  success: boolean;
  layout?: TextLayoutDecision;
  error?: string;
}

