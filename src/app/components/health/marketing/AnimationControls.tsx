// src/app/components/health/marketing/AnimationControls.tsx
// Animation speed controls for marketing content

'use client'

interface AnimationControlsProps {
  selectedSpeed: string
  onSpeedChange: (speed: string) => void
}

const speedOptions = [
  { value: 'ultra-fast', label: 'Ultra Fast (0.5s)', disabled: true },
  { value: 'fast', label: 'Fast (1s)', disabled: true },
  { value: 'normal', label: 'Normal (2s)', disabled: true },
  { value: 'slow', label: 'Slow (4s)', disabled: false },
  { value: 'cinematic', label: 'Cinematic (8s)', disabled: true },
]

export default function AnimationControls({ selectedSpeed, onSpeedChange }: AnimationControlsProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Choose animation speed for chart loading
      </p>
      
      <div className="space-y-2">
        {speedOptions.map(option => (
          <label
            key={option.value}
            className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              option.disabled
                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                : option.value === selectedSpeed
                  ? 'bg-blue-50 border-blue-500 text-blue-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="animationSpeed"
              value={option.value}
              checked={selectedSpeed === option.value}
              onChange={(e) => onSpeedChange(e.target.value)}
              disabled={option.disabled}
              className={`w-4 h-4 ${
                option.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 focus:ring-blue-500'
              }`}
            />
            <span className="flex-1 text-sm font-medium">
              {option.label}
            </span>
            {option.disabled && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                Coming Soon
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-yellow-600">⚠️</span>
          <span className="text-sm text-yellow-800">
            Only "Slow" speed is available in this MVP version
          </span>
        </div>
      </div>
    </div>
  )
} 