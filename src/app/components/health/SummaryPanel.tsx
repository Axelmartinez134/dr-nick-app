'use client'

import { useState } from 'react'

interface SummaryPanelProps {
  mondayMessage: string
  weeklyAnalysis: string
  monthlyAnalysis: string
  grokResponse: string
  position: { x: number, y: number }
  size: { width: number, height: number }
  patientName?: string
  onMinimize: () => void
  dragHandlers: {
    onMouseDown: (e: React.MouseEvent) => void
    onTouchStart: (e: React.TouchEvent) => void
  }
  resizeHandlers: {
    onMouseDown: (e: React.MouseEvent) => void
    onTouchStart: (e: React.TouchEvent) => void
  }
}

export default function SummaryPanel({
  mondayMessage,
  weeklyAnalysis,
  monthlyAnalysis,
  grokResponse,
  position,
  size,
  patientName,
  onMinimize,
  dragHandlers,
  resizeHandlers
}: SummaryPanelProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle')

  // Build the complete summary content
  const buildSummaryContent = () => {
    const sections = []
    
    if (mondayMessage?.trim()) {
      sections.push(`📞 Monday Morning Start Message\n${mondayMessage.trim()}`)
    }
    
    if (weeklyAnalysis?.trim()) {
      sections.push(`Weekly Analysis Notes\n${weeklyAnalysis.trim()}`)
    }
    
    if (monthlyAnalysis?.trim()) {
      sections.push(`Monthly Analysis Notes\n${monthlyAnalysis.trim()}`)
    }
    
    if (grokResponse?.trim()) {
      sections.push(`Grok Analysis Response\n${grokResponse.trim()}`)
    }
    
    return sections.join('\n\n_ _ _ _ _ _ _ _ _ _ _ _ _ _\n\n')
  }

  // Handle copy to clipboard
  const handleCopyAll = async () => {
    const content = buildSummaryContent()
    
    if (!content.trim()) {
      return
    }
    
    setCopyStatus('copying')
    
    try {
      await navigator.clipboard.writeText(content)
      setCopyStatus('copied')
      
      // Reset status after 2 seconds
      setTimeout(() => {
        setCopyStatus('idle')
      }, 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      setCopyStatus('idle')
    }
  }

  const summaryContent = buildSummaryContent()
  const hasContent = summaryContent.trim().length > 0

  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`
      }}
    >
      {/* Header with drag handle */}
      <div
        className="flex items-center justify-between bg-purple-600 text-white p-2 rounded-t-lg cursor-move touch-manipulation"
        {...dragHandlers}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm">📋</span>
          <span className="text-sm font-medium truncate">
            Summary{patientName ? ` - ${patientName}` : ''}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            disabled={!hasContent || copyStatus === 'copying'}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors touch-manipulation ${
              copyStatus === 'copied' 
                ? 'bg-green-500 text-white' 
                : copyStatus === 'copying'
                ? 'bg-purple-400 text-white cursor-not-allowed'
                : hasContent 
                ? 'bg-purple-500 hover:bg-purple-400 text-white' 
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            title={hasContent ? "Copy all content to clipboard" : "No content to copy"}
          >
            {copyStatus === 'copied' ? '✓ Copied' : copyStatus === 'copying' ? 'Copying...' : '📋 Copy All'}
          </button>
          
          <button
            onClick={onMinimize}
            className="w-6 h-6 flex items-center justify-center bg-purple-500 hover:bg-purple-400 rounded text-xs touch-manipulation"
            title="Minimize"
          >
            −
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-col h-full">
        {/* Summary content display */}
        <div className="flex-1 p-4 overflow-auto">
          {hasContent ? (
            <div className="space-y-4">
              {/* Monday Message */}
              {mondayMessage?.trim() && (
                <div className="bg-blue-50 p-3 rounded border text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                  {mondayMessage.trim()}
                </div>
              )}
              
              {/* Divider */}
              {mondayMessage?.trim() && (weeklyAnalysis?.trim() || monthlyAnalysis?.trim() || grokResponse?.trim()) && (
                <div className="text-center text-gray-400 text-sm font-mono">
                  _ _ _ _ _ _ _ _ _ _ _ _ _ _
                </div>
              )}
              
              {/* Weekly Analysis */}
              {weeklyAnalysis?.trim() && (
                <div className="bg-green-50 p-3 rounded border text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                  {weeklyAnalysis.trim()}
                </div>
              )}
              
              {/* Divider */}
              {weeklyAnalysis?.trim() && (monthlyAnalysis?.trim() || grokResponse?.trim()) && (
                <div className="text-center text-gray-400 text-sm font-mono">
                  _ _ _ _ _ _ _ _ _ _ _ _ _ _
                </div>
              )}
              
              {/* Monthly Analysis */}
              {monthlyAnalysis?.trim() && (
                <div className="bg-yellow-50 p-3 rounded border text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                  {monthlyAnalysis.trim()}
                </div>
              )}
              
              {/* Divider */}
              {monthlyAnalysis?.trim() && grokResponse?.trim() && (
                <div className="text-center text-gray-400 text-sm font-mono">
                  _ _ _ _ _ _ _ _ _ _ _ _ _ _
                </div>
              )}
              
              {/* Grok Response */}
              {grokResponse?.trim() && (
                <div className="bg-purple-50 p-3 rounded border text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                  {grokResponse.trim()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">No content available yet.</p>
              <p className="text-xs mt-2">Content will appear here as you add Monday messages, analysis notes, and Grok responses.</p>
            </div>
          )}
        </div>

        {/* Resize handle - Bottom Left */}
        <div
          className="absolute bottom-0 left-0 w-4 h-4 bg-purple-600 cursor-nw-resize opacity-50 hover:opacity-100 transition-opacity"
          style={{
            clipPath: 'polygon(0 100%, 100% 0, 100% 100%)'
          }}
          {...resizeHandlers}
          title="Drag to resize"
        />
      </div>
    </div>
  )
} 