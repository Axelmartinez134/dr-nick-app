export type MarketingChartId =
  | 'weightTrend'
  | 'projection'
  | 'plateauWeight'
  | 'waistTrend'
  | 'sleepTrend'
  | 'morningFatBurnTrend'
  | 'bodyFatTrend'

export interface MarketingChartConfig {
  id: MarketingChartId
  title: string
  defaultEnabled: boolean
  collapsedByDefault: boolean
  descriptionBullets: string[]
  hasData: (snapshot: any) => boolean
  // Component is referenced by the viewer; we store the import path key here
  componentKey: MarketingChartId
}

export const MARKETING_CHARTS: MarketingChartConfig[] = [
  {
    id: 'weightTrend',
    title: 'Weight Trend Analysis',
    defaultEnabled: true,
    collapsedByDefault: false,
    descriptionBullets: [
      'Track weekly progress',
      'Dark black trend line shows overall direction',
      'Weekly fluctuations are normal - focus on trendline should be prioritized',
    ],
    hasData: (snapshot) => Array.isArray(snapshot?.derived?.weightTrend) && snapshot.derived.weightTrend.length > 0,
    componentKey: 'weightTrend',
  },
  {
    id: 'projection',
    title: 'Weight Loss Trend vs. Projections',
    defaultEnabled: true,
    collapsedByDefault: false,
    descriptionBullets: [
      'Red line shows actual progress (irregular pattern expected)',
      'Dark black trend line shows actual weight trajectory',
      'Dotted lines show theoretical projections extending to match your current progress',
      'Projections help identify if progress is on track with expectations',
    ],
    hasData: (snapshot) => Array.isArray(snapshot?.derived?.weightTrend) && snapshot.derived.weightTrend.length > 0,
    componentKey: 'projection',
  },
  {
    id: 'plateauWeight',
    title: 'Plateau Prevention (Weight Loss Rate)',
    defaultEnabled: true,
    collapsedByDefault: false,
    descriptionBullets: [
      'Tracks average weight loss percentage using progressive and rolling averages',
    ],
    hasData: (snapshot) => Array.isArray(snapshot?.derived?.weightTrend) && snapshot.derived.weightTrend.length > 0,
    componentKey: 'plateauWeight',
  },
  {
    id: 'waistTrend',
    title: 'Waist Trend',
    defaultEnabled: true,
    collapsedByDefault: true,
    descriptionBullets: [
      'Often more accurate than weight for fat loss tracking',
      'Dark black trend line shows overall waist measurement change direction',
      'Always measure at the horizontal level of your belly button with your stomoch 100% relaxed.',
    ],
    hasData: (snapshot) => Array.isArray(snapshot?.derived?.waistTrend) && snapshot.derived.waistTrend.length > 0,
    componentKey: 'waistTrend',
  },
  {
    id: 'sleepTrend',
    title: 'Sleep Consistency',
    defaultEnabled: true,
    collapsedByDefault: true,
    descriptionBullets: [
      'Data sourced from biometric analysis by Dr. Nick',
      'Dark black trend line shows overall sleep consistency direction',
      'Higher scores indicate better sleep consistency and recovery',
      'Sleep consistency directly impacts weight loss and overall progress',
    ],
    hasData: (snapshot) => Array.isArray(snapshot?.derived?.sleepTrend) && snapshot.derived.sleepTrend.length > 0,
    componentKey: 'sleepTrend',
  },
  {
    id: 'morningFatBurnTrend',
    title: 'Morning Fat Burn %',
    defaultEnabled: true,
    collapsedByDefault: true,
    descriptionBullets: [
      'Measured weekly through metabolic analysis',
      "Higher percentages over time indicate your body is responding to Dr. Nick's program changes",
      'Shows how well your body burns fat in a fasted state',
    ],
    hasData: (snapshot) => Array.isArray(snapshot?.derived?.morningFatBurnTrend) && snapshot.derived.morningFatBurnTrend.length > 0,
    componentKey: 'morningFatBurnTrend',
  },
  {
    id: 'bodyFatTrend',
    title: 'Body Fat %',
    defaultEnabled: true,
    collapsedByDefault: true,
    descriptionBullets: [
      'Measured using the most precise testing methodology Dr. Nick has determined available in your situation',
      'Scheduled periodically based on your progress milestones',
      'More accurate than weight alone for tracking fat loss',
    ],
    hasData: (snapshot) => Array.isArray(snapshot?.derived?.bodyFatTrend) && snapshot.derived.bodyFatTrend.length > 0,
    componentKey: 'bodyFatTrend',
  },
]
