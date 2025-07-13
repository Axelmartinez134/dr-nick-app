'use client'

interface SummaryIconProps {
  onClick: () => void
  position: { x: number, y: number }
  patientName?: string
  hasContent: boolean
  dragHandlers?: {
    onMouseDown: (e: React.MouseEvent) => void
    onTouchStart: (e: React.TouchEvent) => void
  }
}

export default function SummaryIcon({ 
  onClick, 
  position, 
  patientName,
  hasContent,
  dragHandlers 
}: SummaryIconProps) {
  
  return (
    <div
      className="fixed z-50 right-4 top-1/2 transform -translate-y-1/2 bg-purple-600 text-white rounded-lg shadow-lg cursor-pointer hover:bg-purple-700 transition-colors duration-200 select-none"
      style={{
        minWidth: '80px',
        minHeight: '60px'
      }}
      onClick={onClick}
      title={`Summary${patientName ? ` - ${patientName}` : ''}`}
      {...dragHandlers}
    >
      <div className="flex flex-col items-center justify-center p-2 h-full">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-lg">📋</span>
        </div>
        <div className="text-center">
          <div className="text-xs font-medium">Summary</div>
        </div>
      </div>
      
      {/* Content indicator */}
      {hasContent && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full">
          <div className="w-full h-full bg-green-400 rounded-full"></div>
        </div>
      )}
    </div>
  )
} 