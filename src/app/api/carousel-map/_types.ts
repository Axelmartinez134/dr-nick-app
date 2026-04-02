import 'server-only';

export type CarouselMapPromptKey = 'topics' | 'opening_pairs' | 'expansions';

export type CarouselMapSteeringStageKey = CarouselMapPromptKey;

export type CarouselMapTopic = {
  id: string;
  sourceGenerationKey: string;
  sortOrder: number;
  title: string;
  summary: string;
  whyItMatters: string;
  createdAt: string;
};

export type CarouselMapOpeningPair = {
  id: string;
  topicId: string;
  sourceGenerationKey: string;
  sortOrder: number;
  title: string;
  slide1: string;
  slide2: string;
  angleText: string;
  createdAt: string;
};

export type CarouselMapExpansion = {
  id: string;
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
  createdAt: string;
};

export type CarouselMapSource = {
  swipeItemId: string;
  url: string;
  title: string;
  authorHandle: string;
  platform: string;
  categoryName: string;
  caption: string;
  transcript: string;
  note: string;
};

export type CarouselMapGraph = {
  id: string;
  source: CarouselMapSource;
  selectedTopicId: string | null;
  selectedSlide1SourcePairId: string | null;
  selectedSlide1Text: string | null;
  selectedSlide2SourcePairId: string | null;
  selectedSlide2Text: string | null;
  topics: CarouselMapTopic[];
  openingPairs: CarouselMapOpeningPair[];
  expansions: CarouselMapExpansion[];
  topicsSteering: CarouselMapSteeringState;
  openingPairsSteering: CarouselMapSteeringState;
  expansionsSteering: CarouselMapSteeringState;
};

export type CarouselMapPromptSection = {
  id: string;
  title: string;
  content: string;
};

export type CarouselMapPromptState = {
  promptKey: CarouselMapPromptKey;
  promptText: string;
  isOverride: boolean;
};

export type CarouselMapSteeringState = {
  stageKey: CarouselMapSteeringStageKey;
  scopeKey: string | null;
  steeringText: string;
  lastUsedSteeringText: string;
  lastUsedAt: string | null;
};
