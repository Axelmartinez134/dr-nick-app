// Lightweight shim to import PDF.js library from node_modules with a stable path
// We use the legacy build which exports a browser-ready bundle.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'

export default pdfjsLib


