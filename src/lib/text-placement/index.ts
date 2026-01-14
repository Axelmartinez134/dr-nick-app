export type { AABB } from './aabb';
export { rectsOverlapAABB } from './aabb';

export type { ImageRect } from './maskIntersection';
export { aabbIntersectsMask } from './maskIntersection';

export type { AllowedRect, MaskData } from './nearestValid';
export { findNearestValidTopLeft } from './nearestValid';

export type { TextItem, EnforceResult } from './enforceInvariants';
export { enforceTextInvariantsSequential } from './enforceInvariants';

export type { InlineStyleRange } from './styleRangeRemap';
export { remapRangesByCommonPrefixSuffix } from './styleRangeRemap';
export { remapRangesByDiff } from './styleRangeRemap';

