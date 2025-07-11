'use client'

import { useRef, useEffect } from 'react'
import { SaveStatus } from './hooks/useAutoSave'

interface NotesPanelProps {
  notes: string
  onNotesChange: (notes: string) => void
  position: { x: number, y: number }
  size: { width: number, height: number }
  saveStatus: SaveStatus
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
  isLoading?: boolean
  error?: string | null
}

export default function NotesPanel({
  notes,
  onNotesChange,
  position,
  size,
  saveStatus,
  patientName,
  onMinimize,
  dragHandlers,
  resizeHandlers,
  isLoading = false,
  error = null
}: NotesPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Save status indicator
  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'typing':
        return (
          <div className="flex items-center gap-1 text-yellow-600">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-xs">Typing...</span>
          </div>
        )
      case 'saving':
        return (
          <div className="flex items-center gap-1 text-blue-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs">Saving...</span>
          </div>
        )
      case 'saved':
        return (
          <div className="flex items-center gap-1 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs">Saved ✓</span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center gap-1 text-red-600">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-xs">Error ⚠</span>
          </div>
        )
      default:
        return null
    }
  }

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
        className="flex items-center justify-between bg-blue-600 text-white p-2 rounded-t-lg cursor-move touch-manipulation"
        {...dragHandlers}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm">📝</span>
          <span className="text-sm font-medium truncate">
            Notes{patientName ? ` - ${patientName}` : ''}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {getSaveStatusDisplay()}
          <button
            onClick={onMinimize}
            className="w-6 h-6 flex items-center justify-center bg-blue-500 hover:bg-blue-400 rounded text-xs touch-manipulation"
            title="Minimize"
          >
            −
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-col h-full">
        {/* Notes textarea */}
        <div className="flex-1 p-2 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div className="text-sm text-gray-600">Loading notes...</div>
            </div>
          )}
          
          {error && (
            <div className="absolute top-2 left-2 right-2 bg-red-100 text-red-700 p-2 rounded text-sm">
              {error}
            </div>
          )}
          
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={`Start typing coaching notes for ${patientName || 'this patient'}...`}
            className="w-full h-full resize-none border border-gray-200 rounded p-2 text-sm font-mono leading-relaxed text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ minHeight: '200px' }}
            onKeyDown={(e) => {
              // Ctrl+S to force save
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                // Force save would be handled by parent component
              }
            }}
          />
        </div>
      </div>

      {/* Resize handle - unlimited sizing */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 bg-gray-400 hover:bg-gray-600 cursor-se-resize touch-manipulation"
        {...resizeHandlers}
        style={{
          borderTopLeftRadius: '4px',
          clipPath: 'polygon(100% 0, 0 100%, 100% 100%)'
        }}
        title="Drag to resize"
      />
    </div>
  )
} 