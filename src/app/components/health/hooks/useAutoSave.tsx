'use client'

import { useState, useEffect, useRef } from 'react'
import { saveCoachingNotes } from '../healthService'

export type SaveStatus = 'idle' | 'typing' | 'saving' | 'saved' | 'error'

interface UseAutoSaveReturn {
  saveStatus: SaveStatus
  lastSaved: Date | null
  forceSave: () => Promise<void>
}

export function useAutoSave(
  notes: string, 
  patientId: string | null, 
  enabled: boolean = true
): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousNotesRef = useRef<string>('')

  // Force save function
  const forceSave = async () => {
    if (!patientId || !notes.trim()) return

    setSaveStatus('saving')
    try {
      await saveCoachingNotes(patientId, notes)
      setSaveStatus('saved')
      setLastSaved(new Date())
      previousNotesRef.current = notes
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    } catch (error) {
      console.error('Error force saving notes:', error)
      setSaveStatus('error')
      
      // Reset to idle after 5 seconds on error
      setTimeout(() => {
        setSaveStatus('idle')
      }, 5000)
    }
  }

  // Auto-save with debouncing
  useEffect(() => {
    if (!enabled || !patientId) return

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // If notes haven't changed, don't save
    if (notes === previousNotesRef.current) {
      return
    }

    // Show typing status immediately
    setSaveStatus('typing')

    // Set up debounced save
    timeoutRef.current = setTimeout(async () => {
      if (notes.trim() === '') {
        // Don't save empty notes, but update status
        setSaveStatus('idle')
        return
      }

      setSaveStatus('saving')
      try {
        await saveCoachingNotes(patientId, notes)
        setSaveStatus('saved')
        setLastSaved(new Date())
        previousNotesRef.current = notes
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle')
        }, 3000)
      } catch (error) {
        console.error('Error auto-saving notes:', error)
        setSaveStatus('error')
        
        // Reset to idle after 5 seconds on error
        setTimeout(() => {
          setSaveStatus('idle')
        }, 5000)
      }
    }, 2000) // 2 second debounce

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [notes, patientId, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Update previous notes ref when patient changes
  useEffect(() => {
    previousNotesRef.current = notes
  }, [patientId, notes])

  return {
    saveStatus,
    lastSaved,
    forceSave
  }
} 