export type Slide1GradientDef = {
  id: string;
  name: string;
  angleDeg: number;
  stops: Array<{ at: number; color: string }>;
};

export const SLIDE1_GRADIENTS: Slide1GradientDef[] = [
  {
    id: "sunset_glow",
    name: "Sunset Glow",
    angleDeg: 0,
    stops: [
      { at: 0, color: "#66E5E5" },
      { at: 50, color: "#E599B2" },
      { at: 100, color: "#E54D4D" },
    ],
  },
  {
    id: "ocean_breeze",
    name: "Ocean Breeze",
    angleDeg: 0,
    stops: [
      { at: 0, color: "#22D3EE" },
      { at: 55, color: "#60A5FA" },
      { at: 100, color: "#A78BFA" },
    ],
  },
  {
    id: "coral_reef",
    name: "Coral Reef",
    angleDeg: 0,
    stops: [
      { at: 0, color: "#FB7185" },
      { at: 55, color: "#F97316" },
      { at: 100, color: "#FDE047" },
    ],
  },
  {
    id: "warm_ember",
    name: "Warm Ember",
    angleDeg: 0,
    stops: [
      { at: 0, color: "#F97316" },
      { at: 55, color: "#EF4444" },
      { at: 100, color: "#A855F7" },
    ],
  },
  {
    id: "acid_lime",
    name: "Acid Lime",
    angleDeg: 0,
    stops: [
      { at: 0, color: "#A3E635" },
      { at: 55, color: "#22C55E" },
      { at: 100, color: "#14B8A6" },
    ],
  },
  {
    id: "pure_silver",
    name: "Pure Silver",
    angleDeg: 0,
    stops: [
      { at: 0, color: "#FFFFFF" },
      { at: 55, color: "#E5E7EB" },
      { at: 100, color: "#94A3B8" },
    ],
  },
] as const;

export function slide1GradientCss(g: Slide1GradientDef): string {
  const angle = Number.isFinite(g.angleDeg as any) ? Number(g.angleDeg) : 0;
  const stops = (Array.isArray(g.stops) ? g.stops : [])
    .map((s) => `${String(s.color)} ${Math.max(0, Math.min(100, Number(s.at)))}%`)
    .join(", ");
  return `linear-gradient(${angle}deg, ${stops})`;
}

