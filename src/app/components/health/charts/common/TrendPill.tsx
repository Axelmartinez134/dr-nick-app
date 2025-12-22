'use client'

import { useState } from 'react'

export type TrendOrientation = 'positiveGood' | 'negativeGood'

interface TrendPillProps {
  slope: number
  intercept: number
  pointsCount: number
  insufficientThreshold?: number
  orientation?: TrendOrientation
  labels?: {
    good?: string
    bad?: string
    flat?: string
    insufficient?: string
  }
  arrows?: {
    good?: string
    bad?: string
    flat?: string
  }
  decimals?: number
  className?: string
  hidden?: boolean
  titleOverride?: string
}

export default function TrendPill({
  slope,
  intercept,
  pointsCount,
  insufficientThreshold = 1,
  orientation = 'negativeGood',
  labels,
  arrows,
  decimals = 2,
  className,
  hidden = false,
  titleOverride,
}: TrendPillProps) {
  const [open, setOpen] = useState(false)

  if (hidden) return null

  const labelTexts = {
    good: labels?.good ?? 'Trending Well',
    bad: labels?.bad ?? 'Trending Poorly',
    flat: labels?.flat ?? 'Trending Flat',
    insufficient: labels?.insufficient ?? 'Insufficient data',
  }
  const symbol = {
    good: arrows?.good ?? '↗',
    bad: arrows?.bad ?? '↘',
    flat: arrows?.flat ?? '→',
  }

  let text = labelTexts.insufficient
  let classes = 'bg-gray-100 text-gray-800'
  let arrow = ''

  if (pointsCount >= insufficientThreshold) {
    if (slope === 0) {
      text = labelTexts.flat
      classes = 'bg-gray-100 text-gray-800'
      arrow = symbol.flat
    } else {
      const isGood = orientation === 'positiveGood' ? slope > 0 : slope < 0
      if (isGood) {
        text = labelTexts.good
        classes = 'bg-green-100 text-green-800'
        arrow = symbol.good
      } else {
        text = labelTexts.bad
        classes = 'bg-red-100 text-red-800'
        arrow = symbol.bad
      }
    }
  }

  const m = Number(slope).toFixed(decimals)
  const b = Number(intercept).toFixed(decimals)
  const defaultTitle = `y = ${m}x + ${b}`
  const title = pointsCount >= insufficientThreshold
    ? (titleOverride ?? defaultTitle)
    : labelTexts.insufficient

  return (
    <div className={`relative inline-block ${className ?? ''}`}>
      <div
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`cursor-help text-xs rounded-full px-3 py-1 whitespace-nowrap ${classes}`}
        aria-label={`${text}${arrow ? ` ${arrow}` : ''}`}
        title={title}
      >
        {`${text}${arrow ? ` ${arrow}` : ''}`}
      </div>
      {open && (
        <div className="absolute z-10 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg bottom-full right-0 mb-2">
          <div className="font-medium mb-1">Trend</div>
          <div className="font-mono text-xs bg-gray-800 p-2 rounded">
            {title}
          </div>
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}


