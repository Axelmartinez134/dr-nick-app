'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import SummaryIcon from './SummaryIcon'
import SummaryPanel from './SummaryPanel'

interface StickySummaryProps {
  patientId: string | null
  patientName?: string
  mondayMessage: string
  weeklyAnalysis: string
  monthlyAnalysis: string
  grokResponse: string
}

export default function StickySummary({ 
  patientId, 
  patientName,
  mondayMessage,
  weeklyAnalysis,
  monthlyAnalysis,
  grokResponse
}: StickySummaryProps) {
  const { isDoctor } = useAuth()
  
  // State management
  const [isMinimized, setIsMinimized] = useState(true)
  const [position, setPosition] = useState({ x: 0, y: 100 }) // Will be set in useEffect
  const [size, setSize] = useState({ width: 400, height: 500 })
  
  // Drag and resize state
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartRef = useRef<{ x: number, y: number } | null>(null)
  const resizeStartRef = useRef<{ x: number, y: number, width: number, height: number } | null>(null)

  // Check if there's any content to display
  const hasContent = !!(
    mondayMessage?.trim() || 
    weeklyAnalysis?.trim() || 
    monthlyAnalysis?.trim() || 
    grokResponse?.trim()
  )

  // Panel controls
  const minimize = useCallback(() => {
    setIsMinimized(true)
  }, [])

  const maximize = useCallback(() => {
    setIsMinimized(false)
  }, [])

  // Drag handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true)
    dragStartRef.current = {
      x: clientX - position.x,
      y: clientY - position.y
    }
  }, [position])

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current) return

    const newX = clientX - dragStartRef.current.x
    const newY = clientY - dragStartRef.current.y

    // Keep panel within viewport bounds
    const maxX = window.innerWidth - size.width
    const maxY = window.innerHeight - size.height
    
    setPosition({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    })
  }, [isDragging, size])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  // Resize handlers
  const handleResizeStart = useCallback((clientX: number, clientY: number) => {
    setIsResizing(true)
    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height
    }
  }, [size])

  const handleResizeMove = useCallback((clientX: number, clientY: number) => {
    if (!isResizing || !resizeStartRef.current) return

    const deltaX = clientX - resizeStartRef.current.x
    const deltaY = clientY - resizeStartRef.current.y

    // For bottom-left resize: width decreases when moving right, increases when moving left
    const newWidth = Math.max(300, resizeStartRef.current.width - deltaX)
    const newHeight = Math.max(200, resizeStartRef.current.height + deltaY)

    // Keep panel within viewport bounds
    const maxWidth = window.innerWidth - position.x
    const maxHeight = window.innerHeight - position.y

    // For bottom-left resize, we need to adjust position when width changes
    const finalWidth = Math.min(maxWidth, newWidth)
    const widthDiff = finalWidth - size.width
    
    setSize({
      width: finalWidth,
      height: Math.min(maxHeight, newHeight)
    })
    
    // Adjust position to keep the right edge in place
    if (widthDiff !== 0) {
      setPosition(prev => ({
        ...prev,
        x: Math.max(0, prev.x - widthDiff)
      }))
    }
  }, [isResizing, position, size])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    resizeStartRef.current = null
  }, [])

  // Mouse event handlers
  const dragHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      handleDragStart(e.clientX, e.clientY)
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      handleDragStart(touch.clientX, touch.clientY)
    }
  }

  const resizeHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handleResizeStart(e.clientX, e.clientY)
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const touch = e.touches[0]
      handleResizeStart(touch.clientX, touch.clientY)
    }
  }

  // Global mouse/touch event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleDragMove(e.clientX, e.clientY)
      } else if (isResizing) {
        handleResizeMove(e.clientX, e.clientY)
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        handleDragEnd()
      } else if (isResizing) {
        handleResizeEnd()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0]
        if (isDragging) {
          handleDragMove(touch.clientX, touch.clientY)
        } else if (isResizing) {
          handleResizeMove(touch.clientX, touch.clientY)
        }
      }
    }

    const handleTouchEnd = () => {
      if (isDragging) {
        handleDragEnd()
      } else if (isResizing) {
        handleResizeEnd()
      }
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, isResizing, handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd])

  // Initialize position on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 450, y: 100 })
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to minimize
      if (e.key === 'Escape' && !isMinimized) {
        minimize()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMinimized, minimize])

  // Only show for Dr. Nick
  if (!isDoctor) return null

  // Don't render if no patient selected
  if (!patientId) return null

  // Render icon or panel
  if (isMinimized) {
    return (
      <SummaryIcon
        onClick={maximize}
        position={position}
        patientName={patientName}
        hasContent={hasContent}
        dragHandlers={dragHandlers}
      />
    )
  } else {
    return (
      <SummaryPanel
        mondayMessage={mondayMessage}
        weeklyAnalysis={weeklyAnalysis}
        monthlyAnalysis={monthlyAnalysis}
        grokResponse={grokResponse}
        position={position}
        size={size}
        patientName={patientName}
        onMinimize={minimize}
        dragHandlers={dragHandlers}
        resizeHandlers={resizeHandlers}
      />
    )
  }
} 