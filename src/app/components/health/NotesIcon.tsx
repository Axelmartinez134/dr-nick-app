'use client'

import { countNotesEntries } from './healthService'

interface NotesIconProps {
  notes: string
  onClick: () => void
  position: { x: number, y: number }
  patientName?: string
  dragHandlers?: {
    onMouseDown: (e: React.MouseEvent) => void
    onTouchStart: (e: React.TouchEvent) => void
  }
}

export default function NotesIcon({ 
  notes, 
  onClick, 
  position, 
  patientName, 
  dragHandlers 
}: NotesIconProps) {
  const entryCount = countNotesEntries(notes)
  
  return (
    <div
      className="fixed z-50 left-4 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-lg shadow-lg cursor-pointer hover:bg-blue-700 transition-colors duration-200 select-none"
      style={{
        minWidth: '80px',
        minHeight: '60px'
      }}
      onClick={onClick}
      title={`Notes${patientName ? ` - ${patientName}` : ''} (${entryCount} entries)`}
      {...dragHandlers}
    >
      <div className="flex flex-col items-center justify-center p-2 h-full">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-lg">📝</span>
        </div>
        <div className="text-center">
          <div className="text-xs font-medium">Notes</div>
        </div>
      </div>
      
      {/* Simple entry count indicator */}
      {entryCount > 0 && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full">
          <div className="w-full h-full bg-orange-400 rounded-full"></div>
        </div>
      )}
    </div>
  )
} 