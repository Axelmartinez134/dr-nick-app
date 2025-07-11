'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getCoachingNotes, saveNotesPreferences, getNotesPreferences } from './healthService'
import { useAutoSave } from './hooks/useAutoSave'
import NotesIcon from './NotesIcon'
import NotesPanel from './NotesPanel'

interface StickyNotesProps {
  patientId?: string | null
  patientName?: string
}

export default function StickyNotes({ patientId, patientName }: StickyNotesProps) {
  const { isDoctor } = useAuth()
  
  // State management
  const [isMinimized, setIsMinimized] = useState(true)
  const [notes, setNotes] = useState('')
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null)
  const [position, setPosition] = useState({ x: 100, y: 100 })
  const [size, setSize] = useState({ width: 350, height: 400 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Drag and resize state
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartRef = useRef<{ x: number, y: number } | null>(null)
  const resizeStartRef = useRef<{ x: number, y: number, width: number, height: number } | null>(null)
  
  // Auto-save functionality
  const { saveStatus, forceSave } = useAutoSave(
    notes,
    currentPatientId,
    !isLoading && !error
  )

  // Load notes for patient
  const loadNotesForPatient = useCallback(async (patientId: string | null) => {
    if (!patientId) {
      setNotes('')
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await getCoachingNotes(patientId)
      if (error) {
        setError('Failed to load notes')
        setNotes('')
      } else {
        setNotes(data?.dr_nick_coaching_notes || '')
      }
    } catch (err) {
      console.error('Error loading notes:', err)
      setError('Failed to load notes')
      setNotes('')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Switch patient
  const switchPatient = useCallback(async (patientId: string | null) => {
    if (patientId === currentPatientId) return
    
    setCurrentPatientId(patientId)
    await loadNotesForPatient(patientId)
  }, [currentPatientId, loadNotesForPatient])

  // Save preferences with debouncing
  const savePreferencesDebounced = useCallback((prefs: any) => {
    const timeoutId = setTimeout(async () => {
      try {
        await saveNotesPreferences({
          position,
          size,
          isMinimized,
          ...prefs
        })
      } catch (error) {
        console.error('Error saving notes preferences:', error)
      }
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [position, size, isMinimized])

  // Control functions
  const maximize = useCallback(() => {
    setIsMinimized(false)
    savePreferencesDebounced({ isMinimized: false })
  }, [savePreferencesDebounced])

  const minimize = useCallback(() => {
    setIsMinimized(true)
    savePreferencesDebounced({ isMinimized: true })
  }, [savePreferencesDebounced])

  // Drag handlers
  const dragHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = { 
        x: e.clientX - position.x, 
        y: e.clientY - position.y 
      }
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = { 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      }
    }
  }

  // Resize handlers
  const resizeHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height
      }
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        width: size.width,
        height: size.height
      }
    }
  }

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data, error } = await getNotesPreferences()
        if (data?.notes_preferences && !error) {
          const prefs = data.notes_preferences
          if (prefs.position) setPosition(prefs.position)
          if (prefs.size) setSize(prefs.size)
          if (typeof prefs.isMinimized === 'boolean') setIsMinimized(prefs.isMinimized)
        }
      } catch (error) {
        console.error('Error loading notes preferences:', error)
      }
    }
    
    loadPreferences()
  }, [])

  // Handle patient changes
  useEffect(() => {
    if (patientId !== currentPatientId) {
      switchPatient(patientId || null)
    }
  }, [patientId, currentPatientId, switchPatient])

  // Global mouse/touch handlers
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      if (isDragging && dragStartRef.current) {
        e.preventDefault()
        const newPosition = {
          x: clientX - dragStartRef.current.x,
          y: clientY - dragStartRef.current.y
        }
        setPosition(newPosition)
      }
      
      if (isResizing && resizeStartRef.current) {
        e.preventDefault()
        const deltaX = clientX - resizeStartRef.current.x
        const deltaY = clientY - resizeStartRef.current.y
        
        // NO SIZE CONSTRAINTS - unlimited sizing
        const newSize = {
          width: Math.max(50, resizeStartRef.current.width + deltaX),
          height: Math.max(50, resizeStartRef.current.height + deltaY)
        }
        setSize(newSize)
      }
    }

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false)
        dragStartRef.current = null
        savePreferencesDebounced({ position })
      }
      if (isResizing) {
        setIsResizing(false)
        resizeStartRef.current = null
        savePreferencesDebounced({ size })
      }
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('touchmove', handleMove, { passive: false })
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchend', handleEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, isResizing, position, size, savePreferencesDebounced])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to force save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !isMinimized) {
        e.preventDefault()
        forceSave()
      }
      
      // Escape to minimize
      if (e.key === 'Escape' && !isMinimized) {
        minimize()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMinimized, forceSave, minimize])

  // Only show for Dr. Nick - moved AFTER all hooks
  if (!isDoctor) return null

  // Don't render if no patient selected
  if (!currentPatientId) return null

  // Render icon or panel
  if (isMinimized) {
    return (
      <NotesIcon
        notes={notes}
        onClick={maximize}
        position={position}
        patientName={patientName}
      />
    )
  } else {
    return (
      <NotesPanel
        notes={notes}
        onNotesChange={setNotes}
        position={position}
        size={size}
        saveStatus={saveStatus}
        patientName={patientName}
        onMinimize={minimize}
        dragHandlers={dragHandlers}
        resizeHandlers={resizeHandlers}
        isLoading={isLoading}
        error={error}
      />
    )
  }
} 