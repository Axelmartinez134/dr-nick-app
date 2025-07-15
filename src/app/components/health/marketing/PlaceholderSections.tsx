// src/app/components/health/marketing/PlaceholderSections.tsx
// Placeholder sections for future marketing features

'use client'

export default function PlaceholderSections() {
  return (
    <div className="space-y-6">
      
      {/* Chart Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 opacity-50 pointer-events-none">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Chart Selection
        </h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="w-4 h-4 text-blue-600" checked disabled />
            <span className="text-sm text-gray-600">Weight Trend Chart</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="w-4 h-4 text-blue-600" checked disabled />
            <span className="text-sm text-gray-600">Plateau Prevention</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="w-4 h-4 text-blue-600" checked disabled />
            <span className="text-sm text-gray-600">Weight Projection</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="w-4 h-4 text-blue-600" disabled />
            <span className="text-sm text-gray-600">Waist Trend</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="w-4 h-4 text-blue-600" disabled />
            <span className="text-sm text-gray-600">Sleep Consistency</span>
          </label>
        </div>
        <div className="mt-3 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
          Coming Soon
        </div>
      </div>

      {/* Branding Options */}
      <div className="bg-white rounded-lg shadow-md p-6 opacity-50 pointer-events-none">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🎨 Branding & Style
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Watermark Position</label>
            <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900" disabled>
              <option>Bottom Right</option>
              <option>Bottom Left</option>
              <option>Top Right</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Logo Style</label>
            <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900" disabled>
              <option>Dr. Nick Logo</option>
              <option>Text Only</option>
              <option>Icon + Text</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Color Theme</label>
            <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900" disabled>
              <option>Professional Blue</option>
              <option>Health Green</option>
              <option>Minimalist Gray</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
          Coming Soon
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-lg shadow-md p-6 opacity-50 pointer-events-none">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          💾 Export Options
        </h3>
        <div className="space-y-2">
          <button className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed">
            📱 TikTok/Instagram (9:16)
          </button>
          <button className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed">
            📺 YouTube (16:9)
          </button>
          <button className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed">
            📊 LinkedIn (1:1)
          </button>
          <button className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed">
            🎬 Custom Size
          </button>
        </div>
        <div className="mt-3 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
          Coming Soon
        </div>
      </div>

    </div>
  )
} 