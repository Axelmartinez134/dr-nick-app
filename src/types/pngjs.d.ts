declare module 'pngjs' {
  // Minimal typing to satisfy Next.js / TypeScript in server-only routes.
  // We only use PNG.sync.read(...) to get { width, height, data }.
  export const PNG: any;
}

