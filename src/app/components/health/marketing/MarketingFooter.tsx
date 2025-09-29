export default function MarketingFooter({
  year,
  company = 'TheFittestYou LLC',
  className = ''
}: { year?: number; company?: string; className?: string }) {
  const y = typeof year === 'number' ? year : new Date().getFullYear()
  return (
    <footer role="contentinfo" className={`max-w-md mx-auto px-4 py-6 border-t border-gray-200 text-center text-xs text-gray-600 ${className}`} style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom)/4)' }}>
      <div>Copyright © {y} {company}</div>
    </footer>
  )
}


