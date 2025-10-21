// Centralized marketing configuration (shared across alias/version pages)
export const CTA_LABEL = 'Book a consult'
export const CALENDLY_URL = 'https://calendly.com/axel-automatedbots/45min?hide_gdpr_banner=1'
export const TAGLINE = 'The Fittest You'
// DocSend removed — PDFs are now self-hosted per alias/version

export function getBrandingAssetUrl(fileName: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Public bucket path for marketing-assets
  return `${base}/storage/v1/object/public/marketing-assets/lib/branding/${fileName}`
}


