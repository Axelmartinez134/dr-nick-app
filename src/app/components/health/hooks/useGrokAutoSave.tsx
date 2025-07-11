// src/app/components/health/hooks/useGrokAutoSave.tsx
// Auto-save hook for Grok analysis responses

import { useState, useEffect, useRef } from 'react'
import { saveGrokAnalysisResponse } from '../grokService'

export interface GrokAutoSaveHook {
  saveStatus: 'saved' | 'saving' | 'error' | 'idle'
  forceSave: () => void
}

export function useGrokAutoSave(
  content: string,
  submissionId: string,
  enabled: boolean = true
): GrokAutoSaveHook {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContent = useRef<string>('')
  const isInitialMount = useRef(true)

  const saveToDatabase = async (contentToSave: string) => {
    try {
      setSaveStatus('saving')
      await saveGrokAnalysisResponse(submissionId, contentToSave)
      lastSavedContent.current = contentToSave
      setSaveStatus('saved')
      
      // Auto-hide "saved" status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
    } catch (error) {
      console.error('Error saving Grok analysis:', error)
      setSaveStatus('error')
      
      // Auto-hide error status after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 5000)
    }
  }

  const forceSave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    if (content !== lastSavedContent.current && enabled) {
      saveToDatabase(content)
    }
  }

  useEffect(() => {
    if (!enabled) return

    // Skip saving on initial mount (when content is loaded from database)
    if (isInitialMount.current) {
      isInitialMount.current = false
      lastSavedContent.current = content
      return
    }

    // Skip if content hasn't changed
    if (content === lastSavedContent.current) {
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for auto-save (2 seconds after user stops typing)
    timeoutRef.current = setTimeout(() => {
      saveToDatabase(content)
    }, 2000)

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [content, submissionId, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    saveStatus,
    forceSave
  }
} 