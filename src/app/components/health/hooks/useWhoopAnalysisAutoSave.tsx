'use client'

import { useState, useEffect, useRef } from 'react'
import { updateDrNickAnalysis } from '../healthService'

export type SaveStatus = 'idle' | 'typing' | 'saving' | 'saved' | 'error'

interface UseWhoopAnalysisAutoSaveReturn {
  saveStatus: SaveStatus
  lastSaved: Date | null
  forceSave: () => Promise<void>
}

export function useWhoopAnalysisAutoSave(
  analysisText: string,
  submissionId: string | null,
  analysisType: 'weekly' | 'monthly',
  enabled: boolean = true
): UseWhoopAnalysisAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousAnalysisRef = useRef<string>('')
  const isInitialLoad = useRef<boolean>(true)

  // Force save function
  const forceSave = async () => {
    if (!submissionId || !analysisText.trim()) return

    setSaveStatus('saving')
    try {
      const updateData = {
        [analysisType === 'weekly' ? 'weekly_whoop_analysis' : 'monthly_whoop_analysis']: analysisText
      }
      
      await updateDrNickAnalysis(submissionId, updateData)
      setSaveStatus('saved')
      setLastSaved(new Date())
      previousAnalysisRef.current = analysisText
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    } catch (error) {
      console.error(`Error force saving ${analysisType} analysis:`, error)
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

    // If analysis hasn't changed, don't save
    if (analysisText === previousAnalysisRef.current) {
      return
    }

    // Handle initial load - don't show typing status for initial data population
    if (isInitialLoad.current) {
      previousAnalysisRef.current = analysisText
      isInitialLoad.current = false
      setSaveStatus('idle')
      return
    }

    // Show typing status immediately (only after initial load)
    setSaveStatus('typing')

    // Set up debounced save
    timeoutRef.current = setTimeout(async () => {
      if (analysisText.trim() === '') {
        // Don't save empty analysis, but update status
        setSaveStatus('idle')
        return
      }

      setSaveStatus('saving')
      try {
        const updateData = {
          [analysisType === 'weekly' ? 'weekly_whoop_analysis' : 'monthly_whoop_analysis']: analysisText
        }
        
        await updateDrNickAnalysis(submissionId, updateData)
        setSaveStatus('saved')
        setLastSaved(new Date())
        previousAnalysisRef.current = analysisText
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle')
        }, 3000)
      } catch (error) {
        console.error(`Error auto-saving ${analysisType} analysis:`, error)
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
  }, [analysisText, submissionId, analysisType, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Reset initial load flag when submission changes
  useEffect(() => {
    isInitialLoad.current = true
    previousAnalysisRef.current = ''
  }, [submissionId])

  return {
    saveStatus,
    lastSaved,
    forceSave
  }
} 