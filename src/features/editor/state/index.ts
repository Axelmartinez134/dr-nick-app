// State types, init helpers, selectors for /editor.
// Section 1: scaffold only.

export type { SlideState } from './slideState';
export { initSlide } from './slideState';
export {
  getLayoutLockedFromInput,
  withLayoutLockedInInput,
  getAutoRealignOnImageReleaseFromInput,
  withAutoRealignOnImageReleaseInInput,
} from './editorFlags';

