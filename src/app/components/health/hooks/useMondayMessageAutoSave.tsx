'use client'

import { useState, useEffect, useRef } from 'react'
import { saveMondayMessage } from '../mondayMessageService'

export type SaveStatus = 'idle' | 'typing' | 'saving' | 'saved' | 'error'

interface UseMondayMessageAutoSaveReturn {
  saveStatus: SaveStatus
  lastSaved: Date | null
  forceSave: () => Promise<void>
}

export function useMondayMessageAutoSave(
  message: string, 
  submissionId: string | null, 
  enabled: boolean = true
): UseMondayMessageAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousMessageRef = useRef<string>('')

  // Force save function
  const forceSave = async () => {
    if (!submissionId || !message.trim()) return

    setSaveStatus('saving')
    try {
      await saveMondayMessage(submissionId, message)
      setSaveStatus('saved')
      setLastSaved(new Date())
      previousMessageRef.current = message
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    } catch (error) {
      console.error('Error force saving Monday message:', error)
      setSaveStatus('error')
      
      // Reset to idle after 5 seconds on error
      setTimeout(() => {
        setSaveStatus('idle')
      }, 5000)
    }
  }

  // Auto-save with debouncing
  useEffect(() => {
    if (!enabled || !submissionId) return

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // If message hasn't changed, don't save
    if (message === previousMessageRef.current) {
      return
    }

    // Show typing status immediately
    setSaveStatus('typing')

    // Set up debounced save
    timeoutRef.current = setTimeout(async () => {
      if (message.trim() === '') {
        // Don't save empty messages, but update status
        setSaveStatus('idle')
        return
      }

      setSaveStatus('saving')
      try {
        await saveMondayMessage(submissionId, message)
        setSaveStatus('saved')
        setLastSaved(new Date())
        previousMessageRef.current = message
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle')
        }, 3000)
      } catch (error) {
        console.error('Error auto-saving Monday message:', error)
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
  }, [message, submissionId, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Update previous message ref when submission changes
  useEffect(() => {
    previousMessageRef.current = message
  }, [submissionId, message])

  return {
    saveStatus,
    lastSaved,
    forceSave
  }
} 