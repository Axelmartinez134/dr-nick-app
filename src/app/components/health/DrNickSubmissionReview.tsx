'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  markSubmissionAsReviewed, 
  updateDrNickAnalysis,
  getWeeklyDataForCharts 
} from './healthService'
import { computePlateauPreventionRateForWeek } from './plateauUtils'
import { getSignedImageUrl } from './imageService'
import { supabase } from '../auth/AuthContext'
import { updateHealthRecord } from './healthService'
import ChartsDashboard from './ChartsDashboard'
import { QueueSubmission } from './DrNickQueue'
import StickyNotes from './StickyNotes'
import StickySummary from './StickySummary'
import { generateMondayMessage, generateMondayMessageFromTemplate, loadMondayMessage, saveMondayMessage } from './mondayMessageService'
import { useMondayMessageAutoSave } from './hooks/useMondayMessageAutoSave'
import { getActiveGrokPrompt, updateGlobalGrokPrompt, getActiveGrokSettings, updateGlobalGrokSettings } from './grokService'
import { getActiveMondayTemplate, updateGlobalMondayTemplate } from './mondayTemplateService'
import { useGrokAutoSave } from './hooks/useGrokAutoSave'
import { useWhoopAnalysisAutoSave } from './hooks/useWhoopAnalysisAutoSave'

interface DrNickSubmissionReviewProps {
  submission: QueueSubmission
  onReviewComplete: () => void
  onBackToQueue: () => void
}

export default function DrNickSubmissionReview({ 
  submission, 
  onReviewComplete, 
  onBackToQueue 
}: DrNickSubmissionReviewProps) {
  const formatFastingMinutes = (mins: number | null | undefined) => {
    if (mins === null || mins === undefined) return 'N/A'
    const n = Number(mins)
    if (!Number.isFinite(n)) return 'N/A'
    const clamped = Math.min(1439, Math.max(0, Math.floor(n)))
    const h = Math.floor(clamped / 60)
    const m = clamped % 60
    return `${h}h ${m}m`
  }

  // State management
  const [submissionChartData, setSubmissionChartData] = useState<any[]>([])
  const [signedUrls, setSignedUrls] = useState<{[key: string]: string}>({})
  
  // Enhanced image viewer with navigation
  const [viewingImageSet, setViewingImageSet] = useState<{
    currentIndex: number,
    imageType: 'lumen' | 'food_log' | 'fasting',
    images: Array<{url: string, title: string, day: string, fieldName: string}>
  } | null>(null)
  
  // NEW: Day-based unified image viewer state
  const [viewingDayImageSet, setViewingDayImageSet] = useState<{
    currentIndex: number,
    days: Array<{
      day: string,
      lumenImage: {url: string, title: string, fieldName: string} | null,
      foodLogImage: {url: string, title: string, fieldName: string} | null
    }>
  } | null>(null)

  // Creatine/MyosMD per-day selection (Mon–Sun) stored as JSON array of full lowercase strings
  const creatineSelectedDays = (() => {
    const raw = (submission as any)?.creatine_myosmd_days_selected
    if (Array.isArray(raw)) return raw.map((s: any) => String(s).toLowerCase())
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.map((s: any) => String(s).toLowerCase())
      } catch {}
    }
    return [] as string[]
  })()
  const creatineDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
  const didTakeCreatineOn = (index0: number) => {
    const key = creatineDayKeys[index0]
    return !!key && creatineSelectedDays.includes(key)
  }
  
  // PDF viewing modal state
  const [viewingPdf, setViewingPdf] = useState<{
    url: string, 
    title: string, 
    analysisText: string, 
    analysisType: 'weekly' | 'monthly'
  } | null>(null)
  
  // Analysis form state
  const [weeklyAnalysis, setWeeklyAnalysis] = useState(submission.weekly_whoop_analysis || '')
  const [monthlyAnalysis, setMonthlyAnalysis] = useState(submission.monthly_whoop_analysis || '')
  const [weeklyPdfUploading, setWeeklyPdfUploading] = useState(false)
  const [monthlyPdfUploading, setMonthlyPdfUploading] = useState(false)
  const [weeklyPdfUrl, setWeeklyPdfUrl] = useState(submission.weekly_whoop_pdf_url || '')
  const [monthlyPdfUrl, setMonthlyPdfUrl] = useState(submission.monthly_whoop_pdf_url || '')
  
  // Weight change goal state
  const [weightChangeGoal, setWeightChangeGoal] = useState('1.00')
  
  // Resistance training goal state
  const [resistanceTrainingGoal, setResistanceTrainingGoal] = useState(0)
  const [proteinGoalGrams, setProteinGoalGrams] = useState('150')
  
  // Nutrition compliance days state
  const [nutritionComplianceDays, setNutritionComplianceDays] = useState('0')
  
  // Sleep consistency score state
  const [sleepScore, setSleepScore] = useState('0')
  
  // Stored PDF states (downloaded by N8N from Whoop links)
  const [weeklyStoredPdf, setWeeklyStoredPdf] = useState<string | null>(submission.weekly_whoop_pdf || null)
  const [monthlyStoredPdf, setMonthlyStoredPdf] = useState<string | null>(submission.monthly_whoop_pdf || null)
  
  // Start Message state (placeholder for future dynamic message system)
  const [startMessage, setStartMessage] = useState('')
  
  // Monday Message state
  const [mondayMessage, setMondayMessage] = useState(submission.monday_message_content || '')
  const [generatingMessage, setGeneratingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  
  // Grok Analysis state
  const [grokPrompt, setGrokPrompt] = useState('')
  const [grokResponse, setGrokResponse] = useState(submission.grok_analysis_response || '')
  const [grokAnalyzing, setGrokAnalyzing] = useState(false)
  const [grokError, setGrokError] = useState<string | null>(null)
  const [grokTemperature, setGrokTemperature] = useState<number>(0.3)

  // Monday Template state
  const [mondayTemplate, setMondayTemplate] = useState('')
  const [unitSystem, setUnitSystem] = useState<'imperial' | 'metric'>('imperial')
  useEffect(() => {
    if (!submission?.user_id) return
    const fetchUnits = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('unit_system')
          .eq('id', submission.user_id)
          .single()
        setUnitSystem((data?.unit_system as 'imperial' | 'metric') || 'imperial')
      } catch {
        setUnitSystem('imperial')
      }
    }
    fetchUnits()
  }, [submission?.user_id])
  const [templateSaveStatus, setTemplateSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [templateCollapsed, setTemplateCollapsed] = useState(true)
  const [placeholdersCollapsed, setPlaceholdersCollapsed] = useState(true)
  
  // Ensure state is synchronized with submission data changes
  useEffect(() => {
    setMondayMessage(submission.monday_message_content || '')
    setWeeklyAnalysis(submission.weekly_whoop_analysis || '')
    setMonthlyAnalysis(submission.monthly_whoop_analysis || '')
    setGrokResponse(submission.grok_analysis_response || '')
  }, [submission.id, submission.monday_message_content, submission.weekly_whoop_analysis, submission.monthly_whoop_analysis, submission.grok_analysis_response])
  
  // N8N Processing states
  const [weeklyProcessing, setWeeklyProcessing] = useState(false)
  const [monthlyProcessing, setMonthlyProcessing] = useState(false)
  
  // File input refs for custom upload buttons
  const weeklyFileInputRef = useRef<HTMLInputElement>(null)
  const monthlyFileInputRef = useRef<HTMLInputElement>(null)
  
  // Timeout references to prevent stuck processing states
  const [weeklyTimeout, setWeeklyTimeout] = useState<NodeJS.Timeout | null>(null)
  const [monthlyTimeout, setMonthlyTimeout] = useState<NodeJS.Timeout | null>(null)
  
  // Monday message auto-save functionality
  const { saveStatus: messageSaveStatus, forceSave: forceMessageSave } = useMondayMessageAutoSave(
    mondayMessage,
    submission.id,
    !generatingMessage && !messageError
  )
  
  // Grok analysis auto-save functionality
  const { saveStatus: grokSaveStatus, forceSave: forceGrokSave } = useGrokAutoSave(
    grokResponse,
    submission.id,
    !grokAnalyzing && !grokError
  )

  // Whoop analysis auto-save functionality
  const { saveStatus: weeklyAnalysisSaveStatus, forceSave: forceWeeklySave } = useWhoopAnalysisAutoSave(
    weeklyAnalysis,
    submission.id,
    'weekly',
    true
  )

  const { saveStatus: monthlyAnalysisSaveStatus, forceSave: forceMonthlySave } = useWhoopAnalysisAutoSave(
    monthlyAnalysis,
    submission.id,
    'monthly',
    true
  )
  

  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  // Load chart data for selected submission
  const loadSubmissionChartData = async (userId: string) => {
    try {
      const { data, error } = await getWeeklyDataForCharts(userId)
      if (error) {
        console.error('Error loading chart data:', error)
        return
      }
      setSubmissionChartData(data || [])
    } catch (err) {
      console.error('Failed to load chart data:', err)
    }
  }

  // Generate signed URLs for images and PDFs
  const generateSignedUrls = async (submission: QueueSubmission) => {
    const imageFields = [
      'lumen_day1_image', 'lumen_day2_image', 'lumen_day3_image', 'lumen_day4_image',
      'lumen_day5_image', 'lumen_day6_image', 'lumen_day7_image',
      'food_log_day1_image', 'food_log_day2_image', 'food_log_day3_image',
      'food_log_day4_image', 'food_log_day5_image', 'food_log_day6_image', 'food_log_day7_image',
      'weekly_fasting_screenshot_image'
    ]

    // Add PDF fields to signed URL generation
    const pdfFields = ['weekly_whoop_pdf', 'monthly_whoop_pdf']
    const allFields = [...imageFields, ...pdfFields]

    const newSignedUrls: {[key: string]: string} = {}
    
    for (const field of allFields) {
      const fileUrl = submission[field as keyof QueueSubmission] as string
      if (fileUrl) {
        try {
          const signedUrl = await getSignedImageUrl(fileUrl) // This works for PDFs too
          if (signedUrl) {
            newSignedUrls[field] = signedUrl
          }
        } catch (err) {
          console.error(`Failed to get signed URL for ${field}:`, err)
        }
      }
    }
    
    setSignedUrls(newSignedUrls)
  }

  // Handle PDF upload
  const handlePdfUpload = async (file: File, type: 'weekly' | 'monthly') => {
    try {
      if (type === 'weekly') {
        setWeeklyPdfUploading(true)
      } else {
        setMonthlyPdfUploading(true)
      }

      // Create unique file path for PDF
      const fileExt = file.name.split('.').pop()
      const fileName = `whoop_${type}_${Date.now()}.${fileExt}`
      const filePath = `whoop-pdfs/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('checkin-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('checkin-images')
        .getPublicUrl(filePath)

      const uploadResult = { success: true, url: publicUrl }
      
      if (uploadResult.success && uploadResult.url) {
        if (type === 'weekly') {
          setWeeklyPdfUrl(uploadResult.url)
        } else {
          setMonthlyPdfUrl(uploadResult.url)
        }
      } else {
        alert(`Failed to upload ${type} PDF`)
      }
    } catch (error) {
      console.error(`Error uploading ${type} PDF:`, error)
      alert(`Failed to upload ${type} PDF`)
    } finally {
      if (type === 'weekly') {
        setWeeklyPdfUploading(false)
      } else {
        setMonthlyPdfUploading(false)
      }
    }
  }

  // Clear existing PDF and analysis content (only if it exists)
  const clearExistingContent = async (type: 'weekly' | 'monthly') => {
          console.log(`🧹 Checking for existing ${type} content to clear...`)
      console.log(`📋 Current state check:`, {
        type,
        weeklyStoredPdf: !!weeklyStoredPdf,
        monthlyStoredPdf: !!monthlyStoredPdf,
        weeklyAnalysis: weeklyAnalysis ? weeklyAnalysis.length + ' chars' : 'empty',
        monthlyAnalysis: monthlyAnalysis ? monthlyAnalysis.length + ' chars' : 'empty'
      })
      
      try {
        // Check if there's actually content to clear
        const existingPdf = type === 'weekly' ? weeklyStoredPdf : monthlyStoredPdf
        const existingAnalysis = type === 'weekly' ? weeklyAnalysis : monthlyAnalysis
        
        if (!existingPdf && !existingAnalysis) {
          console.log(`✅ No existing ${type} content found - skipping clear step`)
          return // Nothing to clear, skip this step
        }
      
      console.log(`🧹 Found existing ${type} content, clearing...`, {
        hasPdf: !!existingPdf,
        hasAnalysis: !!existingAnalysis
      })
      
      // Only clear database fields if there's actually content
      const clearFields: any = {}
      
      if (existingPdf) {
        clearFields[type === 'weekly' ? 'weekly_whoop_pdf' : 'monthly_whoop_pdf'] = null
      }
      
      if (existingAnalysis) {
        clearFields[type === 'weekly' ? 'weekly_whoop_analysis' : 'monthly_whoop_analysis'] = null
      }
      
      // Only update database if there are fields to clear
      if (Object.keys(clearFields).length > 0) {
        console.log(`📝 Clearing database fields:`, clearFields)
        const { error: clearError } = await updateDrNickAnalysis(submission.id, clearFields)
        if (clearError) {
          console.error('Failed to clear existing content:', clearError)
          throw new Error('Failed to clear existing content from database')
        }
      }
      
      // Clear local state (safe to do even if already empty)
      if (type === 'weekly') {
        setWeeklyStoredPdf(null)
        setWeeklyAnalysis('')
      } else {
        setMonthlyStoredPdf(null)
        setMonthlyAnalysis('')
      }
      
      // Clear signed URLs for the cleared content
      setSignedUrls(prev => {
        const updated = { ...prev }
        delete updated[`${type}_whoop_pdf`]
        return updated
      })
      
      console.log(`✅ ${type} content cleared successfully`)
    } catch (error) {
      console.error(`❌ Error clearing ${type} content:`, error)
      throw error
    }
  }

  // Send Whoop link to N8N for processing (with auto-clear)
  const handleSendToN8N = async (type: 'weekly' | 'monthly') => {
    const whoopUrl = type === 'weekly' ? weeklyPdfUrl : monthlyPdfUrl
    
    if (!whoopUrl.trim()) {
      alert(`Please enter a ${type} Whoop link first`)
      return
    }

    // Step 1: Clear existing content first (prevents race conditions)
    try {
      await clearExistingContent(type)
    } catch (clearError) {
      console.error(`❌ Clear operation failed:`, clearError)
      alert(`Failed to clear existing ${type} content. Please try again.`)
      return
    }

    // Step 2: Save the new Whoop URL to database
    try {
      const analysisData = {
        [type === 'weekly' ? 'weekly_whoop_pdf_url' : 'monthly_whoop_pdf_url']: whoopUrl
      }

      const { error: saveError } = await updateDrNickAnalysis(submission.id, analysisData)
      if (saveError) {
        console.error('Failed to save Whoop URL:', saveError)
        alert('Failed to save Whoop URL to database')
        return
      }
      
      console.log(`✅ ${type} Whoop URL saved to database:`, whoopUrl)
    } catch (error) {
      console.error('Error saving Whoop URL:', error)
      alert('Failed to save Whoop URL to database')
      return
    }

    // Step 3: Set processing state with timeout fallback
    if (type === 'weekly') {
      setWeeklyProcessing(true)
      // Clear any existing timeout
      if (weeklyTimeout) {
        clearTimeout(weeklyTimeout)
      }
    } else {
      setMonthlyProcessing(true)
      // Clear any existing timeout
      if (monthlyTimeout) {
        clearTimeout(monthlyTimeout)
      }
    }

    // Set a timeout to reset processing state if N8N doesn't respond
    const processingTimeout = setTimeout(() => {
      console.warn(`⏰ N8N processing timeout after 3 minutes for ${type} analysis`)
      if (type === 'weekly') {
        setWeeklyProcessing(false)
        setWeeklyTimeout(null)
      } else {
        setMonthlyProcessing(false)
        setMonthlyTimeout(null)
      }
      alert(`${type} analysis processing timed out. The analysis may still complete in the background. Please check back in a few minutes or try again.`)
    }, 180000) // 3 minutes timeout

    // Store timeout reference
    if (type === 'weekly') {
      setWeeklyTimeout(processingTimeout)
    } else {
      setMonthlyTimeout(processingTimeout)
    }

    try {
      // Your N8N webhook URL - REPLACE WITH YOUR ACTUAL WEBHOOK URL
      const webhookUrl = 'https://n8n.srv745688.hstgr.cloud/webhook/e21836ca-8d7c-4fef-b844-fc25070e97de'
      
      // Simple payload - just the essentials, N8N will query Supabase for the rest
      const payload = {
        submission_id: submission.id,
        type: type  // "weekly" or "monthly"
      }

      console.log('🚀 Sending webhook to N8N after clearing existing content:', webhookUrl)
      console.log('📦 Payload:', payload)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      console.log('📡 Response status:', response.status)
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const responseData = await response.text()
        console.log('✅ N8N Response:', responseData)
        console.log(`🔄 ${type} analysis request sent successfully, waiting for N8N to process...`)
        console.log(`⏱️ Processing timeout set for 3 minutes. Polling will check every 3 seconds for completion.`)
        alert(`Analysis request submitted successfully! This may take 30-60 seconds to complete.`)
        // Note: Processing state will be cleared when we detect the analysis is complete
        // Timeout is still active and will clear processing state if N8N takes too long
      } else {
        const errorText = await response.text()
        console.error('❌ N8N Error Response:', errorText)
        // Clear timeout on error
        if (type === 'weekly' && weeklyTimeout) {
          clearTimeout(weeklyTimeout)
          setWeeklyTimeout(null)
        } else if (type === 'monthly' && monthlyTimeout) {
          clearTimeout(monthlyTimeout)
          setMonthlyTimeout(null)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }
    } catch (error) {
      console.error('🚨 N8N webhook error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // Clear timeout on error
      if (type === 'weekly' && weeklyTimeout) {
        clearTimeout(weeklyTimeout)
        setWeeklyTimeout(null)
      } else if (type === 'monthly' && monthlyTimeout) {
        clearTimeout(monthlyTimeout)
        setMonthlyTimeout(null)
      }
      
      let errorMessage = 'Unknown error occurred'
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error - unable to reach N8N server. Check console for details.'
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
              alert(`Failed to process ${type} analysis: ${errorMessage}`)
      
      // Reset processing state on error
      if (type === 'weekly') {
        setWeeklyProcessing(false)
      } else {
        setMonthlyProcessing(false)
      }
    }
  }

  // Generate Monday message using global template (always fresh - clears cache first)
  const handleGenerateMondayMessage = async () => {
    setGeneratingMessage(true)
    setMessageError(null)
    
    try {
      // Check if template exists
      if (!mondayTemplate || mondayTemplate.trim() === '') {
        throw new Error('No global template available. Please set up a global template first.')
      }
      
      // Step 1: Clear any existing cached message first
      console.log('Clearing existing Monday message cache...')
      await saveMondayMessage(submission.id, '') // Clear the cache
      
      // Step 2: Generate completely fresh message with latest calculations using global template
      console.log('Generating fresh Monday message from global template with latest data...')
      const message = await generateMondayMessageFromTemplate(
        submission.user_id,
        submission.week_number,
        nutritionComplianceDays ? parseInt(nutritionComplianceDays) : 0
      )
      
      // Step 3: Set the new message (this will trigger auto-save)
      setMondayMessage(message)
      console.log('Fresh Monday message generated successfully from global template')
    } catch (error) {
      console.error('Error generating Monday message:', error)
      setMessageError('Failed to generate message. Please check that all required data is available and a global template exists.')
    } finally {
      setGeneratingMessage(false)
    }
  }

  // Load existing Monday message
  const loadExistingMondayMessage = async () => {
    try {
      const existingMessage = await loadMondayMessage(submission.id)
      setMondayMessage(existingMessage)
    } catch (error) {
      console.error('Error loading existing Monday message:', error)
    }
  }

  // Load Grok settings (prompt + temperature)
  const loadGrokSettings = async () => {
    try {
      // Add a small delay to ensure Supabase client is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const settings = await getActiveGrokSettings()
      setGrokPrompt(settings.prompt)
      setGrokTemperature(settings.temperature)
    } catch (error) {
      console.error('Error loading Grok settings:', error)
      setGrokPrompt('Please analyze this client\'s health data and provide actionable recommendations.')
      setGrokTemperature(0.3)
    }
  }

  // Handle Grok settings update (saves prompt + temperature globally)
  const handleGrokPromptUpdate = async () => {
    try {
      await updateGlobalGrokSettings(grokPrompt, grokTemperature)
      alert('Global Grok settings updated successfully!')
    } catch (error) {
      console.error('Error updating Grok settings:', error)
      alert('Failed to update Grok settings')
    }
  }

  // Send to Grok for analysis
  const handleSendToGrok = async () => {
    setGrokAnalyzing(true)
    setGrokError(null)
    
    try {
      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No authentication token available')
      }

      // Compute submission-week Plateau Prevention (Weight Loss Rate) from loaded chart data
      const plateauPreventionForSubmission = computePlateauPreventionRateForWeek(
        submissionChartData,
        submission.week_number
      )

      const response = await fetch('/api/grok/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          submissionId: submission.id,
          userId: submission.user_id,
          customPrompt: grokPrompt,
          temperature: grokTemperature,
          plateauPreventionRate: plateauPreventionForSubmission
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setGrokResponse(data.analysis)
      console.log('Grok analysis completed successfully')
    } catch (error) {
      console.error('Error sending to Grok:', error)
      setGrokError(error instanceof Error ? error.message : 'Failed to analyze with Grok')
    } finally {
      setGrokAnalyzing(false)
    }
  }

  // (Initial weight editor is provided inside ChartsDashboard for consistency)

  // Load Monday template
  const loadMondayTemplate = async () => {
    try {
      // Add a small delay to ensure Supabase client is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const template = await getActiveMondayTemplate()
      setMondayTemplate(template)
    } catch (error) {
      console.error('Error loading Monday template:', error)
      setMondayTemplate('Good evening, {{patient_first_name}}.\n\nI hope your week went well!\n\n[Default template placeholder - please update global template]')
    }
  }

  // Handle Monday template update (saves globally)
  const handleMondayTemplateUpdate = async () => {
    setTemplateSaveStatus('saving')
    try {
      await updateGlobalMondayTemplate(mondayTemplate)
      setTemplateSaveStatus('saved')
      setTimeout(() => setTemplateSaveStatus('idle'), 2000)
      alert('Global Monday template updated successfully!')
    } catch (error) {
      console.error('Error updating Monday template:', error)
      setTemplateSaveStatus('error')
      setTimeout(() => setTemplateSaveStatus('idle'), 3000)
      alert('Failed to update Monday template')
    }
  }

  // Save analysis and mark as reviewed
  const handleCompleteReview = async () => {
    setCompleting(true)
    
    try {
      // Update analysis
      const analysisData = {
        weekly_whoop_pdf_url: weeklyPdfUrl || undefined,
        weekly_whoop_analysis: weeklyAnalysis || undefined,
        monthly_whoop_pdf_url: monthlyPdfUrl || undefined,
        monthly_whoop_analysis: monthlyAnalysis || undefined,
      }

      const { error: updateError } = await updateDrNickAnalysis(submission.id, analysisData)
      if (updateError) {
        alert('Failed to save analysis')
        setCompleting(false)
        return
      }

      // Mark as reviewed
      const { error: reviewError } = await markSubmissionAsReviewed(submission.id)
      if (reviewError) {
        alert('Failed to mark as reviewed')
        setCompleting(false)
        return
      }

      alert('Review completed successfully!')
      onReviewComplete()
    } catch (error) {
      console.error('Error completing review:', error)
      alert('Failed to complete review')
      setCompleting(false)
    }
  }

  // Load current weight change goal for the selected patient
  const loadWeightChangeGoal = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('weight_change_goal_percent, protein_goal_grams')
        .eq('id', submission.user_id)
        .single()
      
      if (error) {
        console.error('Error loading weight change goal:', error)
        return
      }
      
      setWeightChangeGoal(data.weight_change_goal_percent || '1.00')
      setProteinGoalGrams(String((data as any)?.protein_goal_grams ?? 150))
    } catch (err) {
      console.error('Failed to load weight change goal:', err)
    }
  }

  // Handle weight goal update
  const handleGoalUpdate = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ weight_change_goal_percent: parseFloat(weightChangeGoal) })
        .eq('id', submission.user_id)
      
      if (error) {
        console.error('Error updating weight change goal:', error)
        alert('Failed to update weight change goal')
        return
      }
      
      alert('Weight change goal updated successfully!')
    } catch (err) {
      console.error('Failed to update weight change goal:', err)
      alert('Failed to update weight change goal')
    }
  }

  // Handle resistance training goal update
  const handleResistanceGoalUpdate = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ resistance_training_days_goal: resistanceTrainingGoal })
        .eq('id', submission.user_id)
      
      if (error) {
        console.error('Error updating resistance training goal:', error)
        alert('Failed to update resistance training goal')
        return
      }
      
      alert('Resistance training goal updated successfully!')
    } catch (err) {
      console.error('Failed to update resistance training goal:', err)
      alert('Failed to update resistance training goal')
    }
  }

  // Inline BP editor placed to the right of Client Profile Goals
  function BPInlineEditor({ submission }: { submission: QueueSubmission }) {
    const [tracksBP, setTracksBP] = useState(false)
    const [systolic, setSystolic] = useState('')
    const [diastolic, setDiastolic] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle')

    useEffect(() => {
      const load = async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('track_blood_pressure')
            .eq('id', submission.user_id)
            .single()
          const enabled = Boolean(data?.track_blood_pressure)
          setTracksBP(enabled)
          setSystolic((submission as any)?.systolic_bp != null ? String((submission as any).systolic_bp) : '')
          setDiastolic((submission as any)?.diastolic_bp != null ? String((submission as any).diastolic_bp) : '')
        } catch {}
      }
      load()
    }, [submission])

    if (!tracksBP) return null

    const save = async () => {
      setSaving(true)
      setSaveState('idle')
      try {
        const { error } = await updateHealthRecord(submission.id, {
          systolic_bp: systolic === '' ? null : parseInt(systolic),
          diastolic_bp: diastolic === '' ? null : parseInt(diastolic)
        } as any)
        if (error) throw error
        setSaveState('success')
        setTimeout(() => setSaveState('idle'), 1500)
      } catch (e) {
        console.error(e)
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 2000)
      } finally {
        setSaving(false)
      }
    }

    return (
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm min-w-[220px]">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-blue-700">🩺 Blood Pressure (mmHg)</label>
          <span className="text-xs text-gray-500 cursor-help" title="Systolic = top number; Diastolic = bottom number">ℹ️</span>
        </div>
        <p className="text-xs text-gray-600 mb-3">Enter this week's readings</p>

        <div className="flex items-end gap-3">
          {/* Systolic input with unit suffix */}
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              className="w-24 pr-10 px-2 py-1 border border-blue-200 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="120"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">mmHg</span>
            <div className="text-[10px] text-gray-500 mt-1 text-center">Systolic</div>
          </div>

          {/* Diastolic input with unit suffix */}
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              className="w-24 pr-10 px-2 py-1 border border-blue-200 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="80"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">mmHg</span>
            <div className="text-[10px] text-gray-500 mt-1 text-center">Diastolic</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className={`w-full px-4 py-2 h-10 rounded-md text-sm text-white transition-colors ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {saving ? 'Saving…' : 'Update'}
          </button>
          {saveState === 'success' && (
            <span className="text-green-600 text-xs">Saved ✓</span>
          )}
          {saveState === 'error' && (
            <span className="text-red-600 text-xs">Failed</span>
          )}
        </div>
      </div>
    )
  }

  // Body Composition top-row editor (appears above Client Profile Goals when tracking is enabled)
  function BodyCompTopRow({ submission }: { submission: QueueSubmission }) {
    const [enabled, setEnabled] = useState(false)
    const [visceral, setVisceral] = useState('')
    const [subcut, setSubcut] = useState('')
    const [bellyPct, setBellyPct] = useState('')
    const [rhr, setRhr] = useState('')
    const [musclePct, setMusclePct] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle')

    useEffect(() => {
      const load = async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('track_body_composition')
            .eq('id', submission.user_id)
            .single()
          const isOn = Boolean((data as any)?.track_body_composition)
          setEnabled(isOn)
          setVisceral((submission as any)?.visceral_fat_level != null ? String((submission as any).visceral_fat_level) : '')
          setSubcut((submission as any)?.subcutaneous_fat_level != null ? String((submission as any).subcutaneous_fat_level) : '')
          setBellyPct((submission as any)?.belly_fat_percent != null ? String((submission as any).belly_fat_percent) : '')
          setRhr((submission as any)?.resting_heart_rate != null ? String((submission as any).resting_heart_rate) : '')
          setMusclePct((submission as any)?.total_muscle_mass_percent != null ? String((submission as any).total_muscle_mass_percent) : '')
        } catch {}
      }
      load()
    }, [submission])

    if (!enabled) return null

    const save = async () => {
      setSaving(true)
      setSaveState('idle')
      try {
        const updates: any = {
          visceral_fat_level: visceral === '' ? null : parseFloat(visceral),
          subcutaneous_fat_level: subcut === '' ? null : parseFloat(subcut),
          belly_fat_percent: bellyPct === '' ? null : parseFloat(bellyPct),
          resting_heart_rate: rhr === '' ? null : parseInt(rhr),
          total_muscle_mass_percent: musclePct === '' ? null : parseFloat(musclePct)
        }
        const { error } = await updateHealthRecord(submission.id, updates)
        if (error) throw error
        setSaveState('success')
        setTimeout(() => setSaveState('idle'), 1500)
      } catch (e) {
        console.error(e)
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 2000)
      } finally {
        setSaving(false)
      }
    }

    return (
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm">
        <label className="block text-sm font-medium text-blue-700 mb-2">🧬 Body Composition</label>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Visceral</label>
            <input className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" type="number" step="0.01" min="0" value={visceral} onChange={(e) => setVisceral(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">Subcutaneous</label>
            <input className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" type="number" step="0.01" min="0" value={subcut} onChange={(e) => setSubcut(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">Belly Fat %</label>
            <input className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" type="number" step="0.01" min="0" max="100" value={bellyPct} onChange={(e) => setBellyPct(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">Muscle %</label>
            <input className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" type="number" step="0.01" min="0" max="100" value={musclePct} onChange={(e) => setMusclePct(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {saveState === 'success' && (
            <span className="text-green-600 text-xs">Saved ✓</span>
          )}
          {saveState === 'error' && (
            <span className="text-red-600 text-xs">Failed</span>
          )}
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400">{saving ? 'Updating...' : 'Update'}</button>
        </div>
      </div>
    )
  }

  // Resting Heart Rate top-row editor (independent of Body Composition)
  function RhrTopRow({ submission }: { submission: QueueSubmission }) {
    const [rhr, setRhr] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle')

    useEffect(() => {
      setRhr((submission as any)?.resting_heart_rate != null ? String((submission as any).resting_heart_rate) : '')
    }, [submission])

    const save = async () => {
      setSaving(true)
      setSaveState('idle')
      try {
        const updates: any = {
          resting_heart_rate: rhr === '' ? null : parseInt(rhr)
        }
        const { error } = await updateHealthRecord(submission.id, updates)
        if (error) throw error
        setSaveState('success')
        setTimeout(() => setSaveState('idle'), 1500)
      } catch (e) {
        console.error(e)
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 2000)
      } finally {
        setSaving(false)
      }
    }

    return (
      <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg shadow-sm min-w-[220px]">
        <label className="block text-sm font-medium text-rose-700 mb-2">❤️ Resting Heart Rate</label>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-xs text-gray-700 mb-1">RHR (bpm)</label>
            <input
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
              type="number"
              min={20}
              max={120}
              value={rhr}
              onChange={(e) => setRhr(e.target.value)}
              placeholder="e.g., 58"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {saveState === 'success' && (
            <span className="text-green-600 text-xs">Saved ✓</span>
          )}
          {saveState === 'error' && (
            <span className="text-red-600 text-xs">Failed</span>
          )}
          <button onClick={save} disabled={saving} className="w-full px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400">{saving ? 'Updating...' : 'Update'}</button>
        </div>
      </div>
    )
  }

  // Load current nutrition compliance days and weight change goal
  const loadSubmissionData = async () => {
    try {
      // Load weight change goal and resistance training goal
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('weight_change_goal_percent, resistance_training_days_goal')
        .eq('id', submission.user_id)
        .single()
      
      if (profileError) {
        console.error('Error loading profile data:', profileError)
      } else {
        setWeightChangeGoal(profileData.weight_change_goal_percent || '1.00')
        setResistanceTrainingGoal(profileData.resistance_training_days_goal || 0)
      }
      
      // Load current nutrition compliance days for this submission
      setNutritionComplianceDays(String(submission.nutrition_compliance_days || 0))
      
      // Load current sleep consistency score for this submission
      setSleepScore(String(submission.sleep_consistency_score || 0))
      
    } catch (err) {
      console.error('Failed to load submission data:', err)
    }
  }

  // Handle nutrition compliance days update
  const handleNutritionUpdate = async () => {
    const nutritionDays = parseInt(nutritionComplianceDays)
    
    // Validation
    if (isNaN(nutritionDays) || nutritionDays < 0 || nutritionDays > 7) {
      alert('Nutrition compliance days must be between 0 and 7')
      return
    }
    
    try {
      const { error } = await supabase
        .from('health_data')
        .update({ nutrition_compliance_days: nutritionDays })
        .eq('id', submission.id)
      
      if (error) {
        console.error('Error updating nutrition compliance days:', error)
        alert('Failed to update nutrition compliance days')
        return
      }
      
      // Refresh chart data to show the updated nutrition compliance
      await loadSubmissionChartData(submission.user_id)
      
      alert('Nutrition compliance days updated successfully!')
    } catch (err) {
      console.error('Failed to update nutrition compliance days:', err)
      alert('Failed to update nutrition compliance days')
    }
  }

  // Handle sleep score update
  const handleSleepScoreUpdate = async () => {
    const sleepScoreValue = parseInt(sleepScore)
    
    // Validation
    if (isNaN(sleepScoreValue) || sleepScoreValue < 0 || sleepScoreValue > 100) {
      alert('Sleep consistency score must be between 0 and 100')
      return
    }
    
    try {
      const { error } = await supabase
        .from('health_data')
        .update({ sleep_consistency_score: sleepScoreValue })
        .eq('id', submission.id)
      
      if (error) {
        console.error('Error updating sleep consistency score:', error)
        alert('Failed to update sleep consistency score')
        return
      }
      
      // Refresh chart data to show the updated sleep score
      await loadSubmissionChartData(submission.user_id)
      
      alert('Sleep consistency score updated successfully!')
    } catch (err) {
      console.error('Failed to update sleep consistency score:', err)
      alert('Failed to update sleep consistency score')
    }
  }

  // Helper function to build image sets for navigation
  const buildImageSet = (clickedImageType: 'lumen' | 'food_log', clickedIndex: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const images: Array<{url: string, title: string, day: string, fieldName: string}> = []
    
    days.forEach((day, index) => {
      const fieldName = `${clickedImageType}_day${index + 1}_image`
      const imageUrl = submission[fieldName as keyof QueueSubmission] as string
      const displayUrl = signedUrls[fieldName] || imageUrl
      
      if (displayUrl) {
        images.push({
          url: displayUrl,
          title: `${day} ${clickedImageType === 'lumen' ? 'Lumen' : 'Food Log'} Screenshot - Week ${submission.week_number}`,
          day,
          fieldName
        })
      }
    })
    
    // Find the correct index in the filtered images array
    const actualIndex = images.findIndex(img => img.fieldName === `${clickedImageType}_day${clickedIndex + 1}_image`)
    
    return {
      currentIndex: actualIndex >= 0 ? actualIndex : 0,
      imageType: clickedImageType,
      images
    }
  }

  // Navigation functions
  const navigateImage = (direction: 'prev' | 'next') => {
    if (!viewingImageSet) return
    
    const { currentIndex, images } = viewingImageSet
    let newIndex: number
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    } else {
      newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
    }
    
    setViewingImageSet(prev => prev ? { ...prev, currentIndex: newIndex } : null)
  }

  // NEW: Helper function to build day-based image sets for unified viewing
  const buildDayImageSet = (clickedIndex: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const dayImagePairs: Array<{
      day: string,
      lumenImage: {url: string, title: string, fieldName: string} | null,
      foodLogImage: {url: string, title: string, fieldName: string} | null
    }> = []
    
    days.forEach((day, index) => {
      const lumenFieldName = `lumen_day${index + 1}_image`
      const foodLogFieldName = `food_log_day${index + 1}_image`
      
      const lumenImageUrl = submission[lumenFieldName as keyof QueueSubmission] as string
      const foodLogImageUrl = submission[foodLogFieldName as keyof QueueSubmission] as string
      
      const lumenDisplayUrl = signedUrls[lumenFieldName] || lumenImageUrl
      const foodLogDisplayUrl = signedUrls[foodLogFieldName] || foodLogImageUrl
      
      const lumenImage = lumenDisplayUrl ? {
        url: lumenDisplayUrl,
        title: `${day} Lumen Screenshot - Week ${submission.week_number}`,
        fieldName: lumenFieldName
      } : null
      
      const foodLogImage = foodLogDisplayUrl ? {
        url: foodLogDisplayUrl,
        title: `${day} Food Log Screenshot - Week ${submission.week_number}`,
        fieldName: foodLogFieldName
      } : null
      
      // Include all days (even if both images are missing) for consistent navigation
      dayImagePairs.push({
        day,
        lumenImage,
        foodLogImage
      })
    })
    
    return {
      currentIndex: clickedIndex,
      days: dayImagePairs
    }
  }

  // NEW: Navigation function for day-based viewing
  const dayNavigateImage = (direction: 'prev' | 'next') => {
    if (!viewingDayImageSet) return
    
    const { currentIndex, days } = viewingDayImageSet
    let newIndex: number
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : days.length - 1
    } else {
      newIndex = currentIndex < days.length - 1 ? currentIndex + 1 : 0
    }
    
    setViewingDayImageSet(prev => prev ? { ...prev, currentIndex: newIndex } : null)
  }

  // Keyboard navigation (updated to handle both modal types)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Handle day-based unified viewer
      if (viewingDayImageSet) {
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault()
            dayNavigateImage('prev')
            break
          case 'ArrowRight':
            event.preventDefault()
            dayNavigateImage('next')
            break
          case 'Escape':
            event.preventDefault()
            setViewingDayImageSet(null)
            break
        }
        return
      }
      
      // Handle original single-type viewer (fallback)
      if (viewingImageSet) {
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault()
            navigateImage('prev')
            break
          case 'ArrowRight':
            event.preventDefault()
            navigateImage('next')
            break
          case 'Escape':
            event.preventDefault()
            setViewingImageSet(null)
            break
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [viewingImageSet, viewingDayImageSet])

  // Initialize component
  useEffect(() => {
    const initializeReview = async () => {
      setLoading(true)
      
  // Load chart data for the client
      await loadSubmissionChartData(submission.user_id)
      
      // Generate signed URLs for images and PDFs
      await generateSignedUrls(submission)
      
      // Load weight change goal
      await loadWeightChangeGoal()
      
      // Load current nutrition compliance days and weight change goal
      await loadSubmissionData()
      
      // Load existing Monday message
      await loadExistingMondayMessage()
      
      // Load Grok settings (prompt + temperature)
      await loadGrokSettings()
      
      // Load Monday template
      await loadMondayTemplate()
      
      setLoading(false)
    }
    
    initializeReview()
  }, [submission.user_id])

  // Poll for analysis completion when processing
  useEffect(() => {
    if (!weeklyProcessing && !monthlyProcessing) return

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('health_data')
          .select('weekly_whoop_analysis, monthly_whoop_analysis, weekly_whoop_pdf, monthly_whoop_pdf')
          .eq('id', submission.id)
          .single()

        if (error) {
          console.error('Error polling for analysis completion:', error)
          return
        }

        // Check if weekly analysis completed
        if (weeklyProcessing && data.weekly_whoop_analysis) {
          console.log('✅ Weekly analysis completion detected!')
          setWeeklyProcessing(false)
          
          // Clear timeout on successful completion
          if (weeklyTimeout) {
            clearTimeout(weeklyTimeout)
            setWeeklyTimeout(null)
          }
          
          setWeeklyAnalysis(data.weekly_whoop_analysis) // Update analysis text
          if (data.weekly_whoop_pdf) {
            setWeeklyStoredPdf(data.weekly_whoop_pdf) // Update stored PDF
          }
          // Refresh the full submission data to show the new analysis
          await Promise.all([
            loadSubmissionChartData(submission.user_id),
            generateSignedUrls(submission)
          ])
          alert('✅ Weekly Whoop analysis completed and PDF stored!')
        }

        // Check if monthly analysis completed
        if (monthlyProcessing && data.monthly_whoop_analysis) {
          console.log('✅ Monthly analysis completion detected!')
          setMonthlyProcessing(false)
          
          // Clear timeout on successful completion
          if (monthlyTimeout) {
            clearTimeout(monthlyTimeout)
            setMonthlyTimeout(null)
          }
          
          setMonthlyAnalysis(data.monthly_whoop_analysis) // Update analysis text
          if (data.monthly_whoop_pdf) {
            setMonthlyStoredPdf(data.monthly_whoop_pdf) // Update stored PDF
          }
          // Refresh the full submission data to show the new analysis
          await Promise.all([
            loadSubmissionChartData(submission.user_id),
            generateSignedUrls(submission)
          ])
          alert('✅ Monthly Whoop analysis completed and PDF stored!')
        }
      } catch (error) {
        console.error('Error polling analysis completion:', error)
      }
    }, 3000) // Poll every 3 seconds

          return () => clearInterval(pollInterval)
    }, [weeklyProcessing, monthlyProcessing, submission.id, submission.user_id])

  // Cleanup timeouts on component unmount
  useEffect(() => {
    return () => {
      if (weeklyTimeout) {
        clearTimeout(weeklyTimeout)
      }
      if (monthlyTimeout) {
        clearTimeout(monthlyTimeout)
      }
    }
  }, [])
  
    if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading review data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {(submission as any).data_entered_by === 'system' || (submission.notes || '').startsWith('AUTO-CREATED') ? (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-md p-3">
          <span className="font-semibold">MISSED CHECK-IN (SYSTEM) — Week {submission.week_number}.</span> This week was auto-created to keep the timeline continuous. Review like a normal check-in and click "Complete Review & Remove from Queue" when done.
        </div>
      ) : null}
      
      {/* 1. Client Submission Overview - Full Width */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {/* Client Weekly Submission Data */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-1">📝 Client Weekly Check-In Submissions</h4>
            <p className="text-sm text-gray-600">Data submitted by {submission.profiles.first_name} {submission.profiles.last_name} for Week {submission.week_number}</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-10 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-blue-700">Weight</label>
            <div className="text-2xl font-bold text-blue-900">{unitSystem === 'metric' ? (submission.weight !== null && submission.weight !== undefined ? `${(Math.round((submission.weight * 0.45359237) * 100) / 100).toFixed(2)} kg` : 'N/A') : (submission.weight !== null && submission.weight !== undefined ? `${submission.weight.toFixed(2)} lbs` : 'N/A')}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-green-700">Waist</label>
            <div className="text-2xl font-bold text-green-900">{unitSystem === 'metric' ? (submission.waist !== null && submission.waist !== undefined ? `${(Math.round((submission.waist * 2.54) * 100) / 100).toFixed(2)} cm` : 'N/A') : (submission.waist !== null && submission.waist !== undefined ? `${submission.waist.toFixed(2)} inches` : 'N/A')}</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-slate-700">Average Daily Fasting</label>
            <div className="text-2xl font-bold text-slate-900">{formatFastingMinutes((submission as any).avg_daily_fasting_minutes)}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-emerald-700">HMB + Creatine/ MyosMD Consumed</label>
            <div className="text-2xl font-bold text-emerald-900">{(submission as any).creatine_myosmd_days ?? 'N/A'}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-purple-700">Days Strain Goal Met</label>
            <div className="text-2xl font-bold text-purple-900">{submission.purposeful_exercise_days ?? 'N/A'}</div>
          </div>
          <div className="bg-teal-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-teal-700">Resistance Training Days</label>
            <div className="text-2xl font-bold text-teal-900">{submission.resistance_training_days ?? '0'}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-red-700">Days of Hunger</label>
            <div className="text-2xl font-bold text-red-900">{submission.symptom_tracking_days ?? '0'}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-yellow-700">Poor Recovery Days</label>
            <div className="text-2xl font-bold text-yellow-900">{submission.poor_recovery_days ?? '0'}</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-indigo-700">Sleep Consistency Score</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sleepScore}
                  onChange={(e) => setSleepScore(e.target.value)}
                  className="w-20 px-2 py-1 border border-indigo-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm text-indigo-700">%</span>
              </div>
              <button
                onClick={handleSleepScoreUpdate}
                className="w-full px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition-colors"
                title="Update sleep consistency score"
              >
                Update
              </button>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-orange-700">Nutrition Days</label>
            <div className="space-y-2">
              <input
                type="number"
                min="0"
                max="7"
                value={nutritionComplianceDays}
                onChange={(e) => setNutritionComplianceDays(e.target.value)}
                className="w-16 px-2 py-1 border border-orange-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleNutritionUpdate}
                className="w-full px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                title="Update nutrition compliance days"
              >
                Update
              </button>
            </div>
          </div>
        </div>
        </div>

        {/* Top row: Body Composition (if enabled) */}
        <div className="mt-6">
          <div className="flex justify-center gap-6 items-start">
            <BodyCompTopRow submission={submission} />
          </div>
        </div>

        {/* Client Profile Goals Section */}
        <div className="mt-8 mb-6">
          <div className="flex justify-between gap-4 items-start flex-wrap w-full">
            {/* Left: Goals rectangle */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex-1 min-w-[480px] max-w-[860px]">
              <div className="mb-4 text-center md:min-h-[56px] flex flex-col justify-center">
                <h4 className="text-lg font-semibold text-gray-800 mb-1">🎯 Client Profile Goals</h4>
                <p className="text-sm text-gray-600">These goals persist throughout the entire program and apply to all weekly submissions</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Daily Protein Goal */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <label className="block text-sm font-medium text-blue-700">Daily Protein Goal (grams)</label>
                  <p className="text-xs text-blue-600 mb-2">Target daily protein intake in grams</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={proteinGoalGrams}
                        onChange={(e) => setProteinGoalGrams(e.target.value)}
                        className="w-24 px-2 py-1 border border-blue-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="150"
                      />
                      <span className="text-sm text-blue-700">g</span>
                    </div>
                    <button
                      onClick={async () => {
                        const rounded = Math.round(parseFloat(proteinGoalGrams))
                        setProteinGoalGrams(String(isNaN(rounded) ? 150 : rounded))
                        await (async () => {
                          try {
                            const val = isNaN(rounded) ? 150 : rounded
                            const { error } = await supabase
                              .from('profiles')
                              .update({ protein_goal_grams: val })
                              .eq('id', submission.user_id)
                            if (error) {
                              console.error('Error updating protein goal:', error)
                              alert('Failed to update protein goal')
                              return
                            }
                            alert('Protein goal updated successfully!')
                          } catch (err) {
                            console.error('Failed to update protein goal:', err)
                            alert('Failed to update protein goal')
                          }
                        })()
                      }}
                    className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      title="Update daily protein goal"
                    >
                      Update
                    </button>
                  </div>
                </div>

                {/* Week-over-Week Weight Loss % */}
                <div className="bg-pink-50 p-3 rounded-lg">
                  <label className="block text-sm font-medium text-pink-700">Week-over-Week Weight Loss %</label>
                  <p className="text-xs text-pink-600 mb-2">Target percentage for weekly weight reduction</p>
                  <div className="space-y-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.10"
                      max="5.00"
                      value={weightChangeGoal}
                      onChange={(e) => setWeightChangeGoal(e.target.value)}
                      className="w-20 px-2 py-1 border border-pink-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <button
                      onClick={handleGoalUpdate}
                    className="w-full px-3 py-1 bg-pink-600 text-white rounded text-sm hover:bg-pink-700 transition-colors"
                      title="Update weight change goal"
                    >
                      Update
                    </button>
                  </div>
                </div>

                {/* Training Days Per Week Goal */}
                <div className="bg-purple-50 p-3 rounded-lg">
                  <label className="block text-sm font-medium text-purple-700">Training Days Per Week Goal</label>
                  <p className="text-xs text-purple-600 mb-2">Target resistance training days for this client</p>
                  <div className="space-y-2">
                    <input
                      type="number"
                      min="0"
                      max="7"
                      value={resistanceTrainingGoal}
                      onChange={(e) => setResistanceTrainingGoal(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-purple-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleResistanceGoalUpdate}
                      className="w-full px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
                      title="Update resistance training goal"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Heart Health wrapper containing RHR + BP */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex-none min-w-[520px]">
              <div className="mb-4 text-center md:min-h-[56px] flex flex-col justify-center">
                <h4 className="text-lg font-semibold text-gray-800 mb-1">❤️ Heart Health</h4>
                <p className="text-sm text-gray-600">Weekly cardiovascular metrics for review</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RhrTopRow submission={submission} />
                {Boolean((submission as any)?.profiles?.id) && (
                  <BPInlineEditor submission={submission} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Client Self-Reflection */}
        {submission.notes && (
          <div className="border-t pt-6">
            <label className="block text-lg font-medium text-gray-900 mb-3">🧠 Client Self-Reflection</label>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-gray-800 whitespace-pre-wrap">{submission.notes}</p>
            </div>
          </div>
        )}

        {/* Detailed Symptom Notes */}
        {submission.detailed_symptom_notes && (
          <div className="border-t pt-6">
            <label className="block text-lg font-medium text-gray-900 mb-3">
              ⚠️ Detailed Symptom Notes
              <span className="text-sm text-gray-500 font-normal ml-2">(Related to Days of Hunger above)</span>
            </label>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-gray-800 whitespace-pre-wrap">{submission.detailed_symptom_notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Client Submission Images - Full Width */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-xl font-semibold text-gray-900 mb-6">📷 Client Submission Images</h4>

        {/* Weekly Fasting Screenshot */}
        <div className="mb-8">
          <h5 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-3">Required</span>
            Weekly Fasting Screenshot
          </h5>
          {(() => {
            const fieldName = 'weekly_fasting_screenshot_image'
            const imageUrl = submission[fieldName as keyof QueueSubmission] as string
            const displayUrl = signedUrls[fieldName] || imageUrl
            return (
              <div className="max-w-md">
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt="Weekly Fasting Screenshot"
                    className="w-full h-48 object-cover rounded-lg border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
                    onClick={() => setViewingImageSet({
                      currentIndex: 0,
                      imageType: 'fasting',
                      images: [{ url: displayUrl, title: 'Weekly Fasting Screenshot', day: 'Weekly', fieldName }]
                    })}
                  />
                ) : (
                  <div
                    className="w-full h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400"
                    title="No Image"
                  >
                    No Image
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        
        {/* Lumen Images */}
        <div className="mb-8">
          <h5 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-3">Required</span>
            Lumen Screenshots
          </h5>
          <div className="grid grid-cols-7 gap-4">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
              const fieldName = `lumen_day${index + 1}_image`
              const imageUrl = submission[fieldName as keyof QueueSubmission] as string
              const displayUrl = signedUrls[fieldName] || imageUrl
              
              return (
                <div key={day} className="text-center">
                  <div className="text-sm text-gray-600 mb-2 font-medium">{day}</div>
                  {displayUrl ? (
                    <img 
                      src={displayUrl}
                      alt={`${day} Lumen`}
                      className="w-full h-24 object-cover rounded-lg border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
                      onClick={() => setViewingDayImageSet(buildDayImageSet(index))}
                    />
                  ) : (
                    <div 
                      className="w-full h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 cursor-pointer hover:border-gray-400 transition-colors"
                      onClick={() => setViewingDayImageSet(buildDayImageSet(index))}
                      title="Click to view daily comparison"
                    >
                      No Image
                    </div>
                  )}
                  {didTakeCreatineOn(index) ? (
                    <div className="mt-1 text-sm font-bold text-green-700">
                      Creatine ✓
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* Food Log Images */}
        <div className="mb-8">
          <h5 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm mr-3">Optional</span>
            Food Log Screenshots
          </h5>
          <div className="grid grid-cols-7 gap-4">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
              const fieldName = `food_log_day${index + 1}_image`
              const imageUrl = submission[fieldName as keyof QueueSubmission] as string
              const displayUrl = signedUrls[fieldName] || imageUrl
              
              return (
                <div key={day} className="text-center">
                  <div className="text-sm text-gray-600 mb-2 font-medium">{day}</div>
                  {displayUrl ? (
                    <img 
                      src={displayUrl}
                      alt={`${day} Food Log`}
                      className="w-full h-24 object-cover rounded-lg border-2 border-green-200 cursor-pointer hover:border-green-400 transition-colors shadow-sm"
                      onClick={() => setViewingDayImageSet(buildDayImageSet(index))}
                    />
                  ) : (
                    <div 
                      className="w-full h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 cursor-pointer hover:border-gray-400 transition-colors"
                      onClick={() => setViewingDayImageSet(buildDayImageSet(index))}
                      title="Click to view daily comparison"
                    >
                      No Image
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>


      </div>

      {/* 3. Monday Morning Start Message - Full Width */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-xl font-semibold text-gray-900 mb-6">📞 Monday Morning Start Message</h4>
        
        <div className="space-y-6">

          {/* Template Editor Section - Collapsible */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => setTemplateCollapsed(!templateCollapsed)}
              className="w-full px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between rounded-t-lg"
            >
              <span className="flex items-center gap-2">
                <span>{templateCollapsed ? '🔽' : '🔼'}</span>
                <span>Edit Global Template</span>
              </span>
              <span className="text-sm text-gray-500">
                {templateCollapsed ? 'Click to expand' : 'Click to collapse'}
              </span>
            </button>
            
            {!templateCollapsed && (
              <div className="p-4 border-t border-gray-200 space-y-4">
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                  <p>This template applies to all Clients. Changes are saved globally and will affect all future Monday message generation.</p>
                </div>

                {/* Available Placeholders - Nested Collapsible */}
                <div className="border border-gray-100 rounded-lg">
                  <button
                    onClick={() => setPlaceholdersCollapsed(!placeholdersCollapsed)}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center justify-between rounded-t-lg"
                  >
                    <span className="flex items-center gap-2">
                      <span>{placeholdersCollapsed ? '📋' : '📂'}</span>
                      <span>Available Placeholders</span>
                    </span>
                    <span className="text-xs text-gray-400">
                      {placeholdersCollapsed ? 'Show placeholders' : 'Hide placeholders'}
                    </span>
                  </button>
                  
                  {!placeholdersCollapsed && (
                    <div className="p-3 border-t border-gray-100 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-black">
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{patient_first_name}}'}</code> - Client's first name</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{plateau_prevention_rate}}'}</code> - Current plateau prevention %</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{plateau_prevention_status}}'}</code> - Progress status text</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{trend_direction}}'}</code> - "trending up/down/stable"</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{trend_description}}'}</code> - Progress description</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{current_week_number}}'}</code> - Current week number</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{week_count}}'}</code> - Number of weeks in average</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{week_average_loss_rate}}'}</code> - Week average loss %</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{overall_loss_rate_percent}}'}</code> - Overall loss rate %</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{goal_loss_rate_percent}}'}</code> - Target loss rate %</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{total_waist_loss_inches}}'}</code> - Total waist loss</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{protein_goal_grams}}'}</code> - Daily protein target</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{protein_goal_lower_bound}}'}</code> - Protein goal -3g</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{protein_goal_upper_bound}}'}</code> - Protein goal +3g</div>
                        <div><code className="bg-white px-1 rounded text-black font-medium">{'{{weekly_compliance_percent}}'}</code> - Weekly compliance %</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Template Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Global Template Content
                    </label>
                    <div className="flex items-center space-x-4">
                      {/* Template save status indicator */}
                      {templateSaveStatus === 'saving' && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-xs">Saving...</span>
                        </div>
                      )}
                      {templateSaveStatus === 'saved' && (
                        <div className="flex items-center gap-1 text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs">Saved ✓</span>
                        </div>
                      )}
                      {templateSaveStatus === 'error' && (
                        <div className="flex items-center gap-1 text-red-600">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-xs">Error ⚠</span>
                        </div>
                      )}
                      
                      <button
                        onClick={handleMondayTemplateUpdate}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium"
                      >
                        💾 Update Global Template
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={mondayTemplate}
                    onChange={(e) => setMondayTemplate(e.target.value)}
                    rows={8}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono text-sm"
                    placeholder="Loading global template..."
                    onKeyDown={(e) => {
                      // Ctrl+S to manually save
                      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault()
                        handleMondayTemplateUpdate()
                      }
                    }}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Use placeholders above in your template. Changes affect all Clients. Press Ctrl+S to force save.
                  </div>
                </div>
              </div>
            )}
          </div>


          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Monday Morning Message Content
            </label>
            <div className="flex items-center space-x-4">
              {/* Save status indicator */}
              {messageSaveStatus === 'typing' && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs">Typing...</span>
                </div>
              )}
              {messageSaveStatus === 'saving' && (
                <div className="flex items-center gap-1 text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs">Saving...</span>
                </div>
              )}
              {messageSaveStatus === 'saved' && (
                <div className="flex items-center gap-1 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs">Saved ✓</span>
                </div>
              )}
              {messageSaveStatus === 'error' && (
                <div className="flex items-center gap-1 text-red-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs">Error ⚠</span>
                </div>
              )}
              
              <button
                onClick={handleGenerateMondayMessage}
                disabled={generatingMessage || !nutritionComplianceDays || !mondayTemplate || mondayTemplate.trim() === ''}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  generatingMessage || !nutritionComplianceDays || !mondayTemplate || mondayTemplate.trim() === ''
                    ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={
                  !mondayTemplate || mondayTemplate.trim() === '' 
                    ? "Please set up a global template first" 
                    : !nutritionComplianceDays 
                      ? "Please enter nutrition compliance days first" 
                      : "Generate personalized Monday message from global template"
                }
              >
                {generatingMessage ? 'Generating...' : '🔄 Generate Monday Morning Message'}
              </button>
            </div>
          </div>

          {messageError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{messageError}</div>
            </div>
          )}

          <div className="relative">
            <textarea
              value={mondayMessage}
              onChange={(e) => setMondayMessage(e.target.value)}
              rows={16}
              className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-900 leading-relaxed"
              placeholder="Click '🔄 Generate Fresh Message' above to create a personalized Monday morning message using this client's latest data and progress metrics. The button always clears any cached content and generates fresh calculations. You can edit the generated message before sending."
              onKeyDown={(e) => {
                // Ctrl+S to force save
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault()
                  forceMessageSave()
                }
              }}
            />
            {generatingMessage && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <div className="mt-2 text-sm text-gray-600">Generating personalized message...</div>
                </div>
              </div>
            )}
          </div>


        </div>
      </div>

      {/* 4. Whoop Analysis - Full Width (Moved from sidebar) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-xl font-semibold text-gray-900 mb-6">📊 Whoop Analysis</h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Weekly Analysis Section */}
          <div className="space-y-4">
            <h5 className="text-lg font-medium text-gray-800 mb-4 border-b pb-2">Weekly Analysis</h5>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#000000' }}>
                Weekly Whoop Link
              </label>
              <div className="flex items-start space-x-3">
                <input
                  type="url"
                  value={weeklyPdfUrl}
                  onChange={(e) => setWeeklyPdfUrl(e.target.value)}
                  maxLength={5000}
                  className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter Whoop link for weekly analysis (up to 5000 characters)"
                />
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSendToN8N('weekly')}
                    disabled={!weeklyPdfUrl.trim() || weeklyProcessing}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {weeklyProcessing ? 'Processing...' : '📊 Generate Analysis'}
                  </button>
                  
                  {/* Status indicator */}
                  {weeklyProcessing && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center text-purple-600">
                        <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm">Generating analysis...</span>
                      </div>
                      <button
                        onClick={() => {
                          setWeeklyProcessing(false)
                          if (weeklyTimeout) {
                            clearTimeout(weeklyTimeout)
                            setWeeklyTimeout(null)
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  
                  {weeklyStoredPdf && !weeklyProcessing && (
                    <div className="flex items-center text-green-600">
                      <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">PDF Stored</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {weeklyPdfUrl.length}/5000 characters
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#000000' }}>
                Weekly Whoop PDF Upload
              </label>
              
              {/* Show stored PDF from N8N if available */}
              {weeklyStoredPdf && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    PDF Successfully Processed
                  </div>
                  <div className="flex items-start space-x-4">
                    {/* PDF Thumbnail */}
                    <div 
                      className="w-24 h-24 bg-red-50 border-2 border-red-200 rounded-lg cursor-pointer hover:border-red-400 transition-colors shadow-sm flex flex-col items-center justify-center group"
                      onClick={() => setViewingPdf({
                        url: signedUrls['weekly_whoop_pdf'] || weeklyStoredPdf,
                        title: `Weekly Whoop PDF - Week ${submission.week_number}`,
                        analysisText: weeklyAnalysis,
                        analysisType: 'weekly'
                      })}
                    >
                      <svg className="w-8 h-8 text-red-600 mb-1 group-hover:text-red-700" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs text-red-700 font-medium">PDF</span>
                    </div>
                    
                    {/* PDF Info and Actions */}
                    <div className="flex-1">
                      <div className="text-sm text-green-800 font-medium">Weekly Whoop Analysis PDF</div>
                      <div className="text-xs text-gray-600 mt-1">Click thumbnail to view PDF and edit analysis side-by-side</div>
                      <div className="flex items-center space-x-2 mt-2">
                        <a
                          href={signedUrls['weekly_whoop_pdf'] || weeklyStoredPdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          Open in Tab ↗
                        </a>
                        <a
                          href={signedUrls['weekly_whoop_pdf'] || weeklyStoredPdf}
                          download
                          className="text-sm text-green-600 hover:text-green-800 underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Manual file upload (fallback/additional option) */}
              <div className="flex items-center space-x-3">
                {/* Hidden file input */}
                <input
                  ref={weeklyFileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePdfUpload(file, 'weekly')
                  }}
                  disabled={weeklyPdfUploading}
                  className="hidden"
                />
                {/* Custom button that triggers file input */}
                <button
                  onClick={() => weeklyFileInputRef.current?.click()}
                  disabled={weeklyPdfUploading}
                  className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                >
                  Choose PDF File
                </button>
                {weeklyPdfUploading && <div className="text-blue-600">Uploading...</div>}
                {weeklyPdfUrl && !weeklyStoredPdf && <div className="text-green-600">✓ Uploaded</div>}
              </div>
              
              {weeklyStoredPdf && (
                <div className="mt-1 text-xs text-gray-500">
                  Manual upload available as backup option
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Weekly Analysis Notes
                </label>
                <div className="flex items-center space-x-4">
                  {/* Save status indicator */}
                  {weeklyAnalysisSaveStatus === 'typing' && (
                    <div className="flex items-center gap-1 text-yellow-600">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs">Typing...</span>
                    </div>
                  )}
                  {weeklyAnalysisSaveStatus === 'saving' && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-xs">Saving...</span>
                    </div>
                  )}
                  {weeklyAnalysisSaveStatus === 'saved' && (
                    <div className="flex items-center gap-1 text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs">Saved ✓</span>
                    </div>
                  )}
                  {weeklyAnalysisSaveStatus === 'error' && (
                    <div className="flex items-center gap-1 text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs">Error saving</span>
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={weeklyAnalysis}
                onChange={(e) => setWeeklyAnalysis(e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Enter your weekly analysis for this client..."
                onKeyDown={(e) => {
                  // Ctrl+S to force save
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault()
                    forceWeeklySave()
                  }
                }}
              />
            </div>
          </div>

          {/* Monthly Analysis Section */}
          <div className="space-y-4">
            <h5 className="text-lg font-medium text-gray-800 mb-4 border-b pb-2">Monthly Analysis</h5>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#000000' }}>
                Monthly Whoop Link
              </label>
              <div className="flex items-start space-x-3">
                <input
                  type="url"
                  value={monthlyPdfUrl}
                  onChange={(e) => setMonthlyPdfUrl(e.target.value)}
                  maxLength={5000}
                  className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter Whoop link for monthly analysis (up to 5000 characters)"
                />
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSendToN8N('monthly')}
                    disabled={!monthlyPdfUrl.trim() || monthlyProcessing}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {monthlyProcessing ? 'Processing...' : '📊 Generate Analysis'}
                  </button>
                  
                  {/* Status indicator */}
                  {monthlyProcessing && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center text-purple-600">
                        <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm">Generating analysis...</span>
                      </div>
                      <button
                        onClick={() => {
                          setMonthlyProcessing(false)
                          if (monthlyTimeout) {
                            clearTimeout(monthlyTimeout)
                            setMonthlyTimeout(null)
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  
                  {monthlyStoredPdf && !monthlyProcessing && (
                    <div className="flex items-center text-green-600">
                      <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">PDF Stored</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {monthlyPdfUrl.length}/5000 characters
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#000000' }}>
                Monthly Whoop PDF Upload
              </label>
              
              {/* Show stored PDF from N8N if available */}
              {monthlyStoredPdf && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    PDF Successfully Processed
                  </div>
                  <div className="flex items-start space-x-4">
                    {/* PDF Thumbnail */}
                    <div 
                      className="w-24 h-24 bg-purple-50 border-2 border-purple-200 rounded-lg cursor-pointer hover:border-purple-400 transition-colors shadow-sm flex flex-col items-center justify-center group"
                      onClick={() => setViewingPdf({
                        url: signedUrls['monthly_whoop_pdf'] || monthlyStoredPdf,
                        title: `Monthly Whoop PDF - Week ${submission.week_number}`,
                        analysisText: monthlyAnalysis,
                        analysisType: 'monthly'
                      })}
                    >
                      <svg className="w-8 h-8 text-purple-600 mb-1 group-hover:text-purple-700" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs text-purple-700 font-medium">PDF</span>
                    </div>
                    
                    {/* PDF Info and Actions */}
                    <div className="flex-1">
                      <div className="text-sm text-green-800 font-medium">Monthly Whoop Analysis PDF</div>
                      <div className="text-xs text-gray-600 mt-1">Click thumbnail to view PDF and edit analysis side-by-side</div>
                      <div className="flex items-center space-x-2 mt-2">
                        <a
                          href={signedUrls['monthly_whoop_pdf'] || monthlyStoredPdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          Open in Tab ↗
                        </a>
                        <a
                          href={signedUrls['monthly_whoop_pdf'] || monthlyStoredPdf}
                          download
                          className="text-sm text-green-600 hover:text-green-800 underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Manual file upload (fallback/additional option) */}
              <div className="flex items-center space-x-3">
                {/* Hidden file input */}
                <input
                  ref={monthlyFileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePdfUpload(file, 'monthly')
                  }}
                  disabled={monthlyPdfUploading}
                  className="hidden"
                />
                {/* Custom button that triggers file input */}
                <button
                  onClick={() => monthlyFileInputRef.current?.click()}
                  disabled={monthlyPdfUploading}
                  className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                >
                  Choose PDF File
                </button>
                {monthlyPdfUploading && <div className="text-green-600">Uploading...</div>}
                {monthlyPdfUrl && !monthlyStoredPdf && <div className="text-green-600">✓ Uploaded</div>}
              </div>
              
              {monthlyStoredPdf && (
                <div className="mt-1 text-xs text-gray-500">
                  Manual upload available as backup option
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Monthly Analysis Notes
                </label>
                <div className="flex items-center space-x-4">
                  {/* Save status indicator */}
                  {monthlyAnalysisSaveStatus === 'typing' && (
                    <div className="flex items-center gap-1 text-yellow-600">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs">Typing...</span>
                    </div>
                  )}
                  {monthlyAnalysisSaveStatus === 'saving' && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-xs">Saving...</span>
                    </div>
                  )}
                  {monthlyAnalysisSaveStatus === 'saved' && (
                    <div className="flex items-center gap-1 text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs">Saved ✓</span>
                    </div>
                  )}
                  {monthlyAnalysisSaveStatus === 'error' && (
                    <div className="flex items-center gap-1 text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs">Error saving</span>
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={monthlyAnalysis}
                onChange={(e) => setMonthlyAnalysis(e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Enter your monthly analysis for this client (if applicable)..."
                onKeyDown={(e) => {
                  // Ctrl+S to force save
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault()
                    forceMonthlySave()
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Grok Analysis - Full Width */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-xl font-semibold text-gray-900 mb-6">🤖 Grok Analysis</h4>
        
        <div className="space-y-6">
          {/* Prompt Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Analysis Prompt
              </label>
              <button
                onClick={handleGrokPromptUpdate}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium"
              >
                💾 Save Grok Settings
              </button>
            </div>
            <textarea
              value={grokPrompt}
              onChange={(e) => setGrokPrompt(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Loading prompt from database..."
              onKeyDown={(e) => {
                // Ctrl+S to manually save
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault()
                  handleGrokPromptUpdate()
                }
              }}
            />
            <div className="text-xs text-gray-500 mt-1">
              This prompt applies to all Clients. Changes are saved globally and automatically (2s delay). Press Ctrl+S to force save.
            </div>
          </div>

          {/* Temperature Information Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-blue-900 mb-2">🌡️ Temperature Setting Guide</h5>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>What it does:</strong> Temperature controls how creative vs. consistent Grok's analysis will be.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="font-medium text-blue-900">Lower Values (0.0 - 0.5):</p>
                  <ul className="text-xs space-y-1 mt-1">
                    <li>• More focused and consistent responses</li>
                    <li>• Better for medical analysis</li>
                    <li>• Recommended: <strong>0.3</strong> (default)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-blue-900">Higher Values (0.8 - 2.0):</p>
                  <ul className="text-xs space-y-1 mt-1">
                    <li>• More creative and varied responses</li>
                    <li>• Less predictable analysis</li>
                    <li>• Use for brainstorming ideas</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs mt-3"><strong>💡 Tip:</strong> Start with 0.3 for reliable medical insights. Try 0.7-1.0 for alternative perspectives on complex cases.</p>
            </div>
          </div>

          {/* Send Button and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Temperature Control */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Temperature:
                </label>
                <input
                  type="number"
                  value={grokTemperature}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value) && value >= 0 && value <= 2) {
                      setGrokTemperature(value)
                    }
                  }}
                  min="0"
                  max="2"
                  step="0.1"
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.3"
                />
                <span className="force-black-text" style={{fontSize: '12px', fontWeight: 'bold'}}>(0-2)</span>
              </div>
              
            <button
              onClick={handleSendToGrok}
              disabled={grokAnalyzing}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                grokAnalyzing
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {grokAnalyzing ? 'Analyzing...' : '🤖 Send to Grok for Analysis'}
            </button>
            </div>
            
            {grokError && (
              <div className="text-red-600 text-sm font-medium">
                Error: {grokError}
              </div>
            )}
          </div>

          {/* Response Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Grok Analysis Response
              </label>
              <div className="flex items-center space-x-2 text-xs">
                {grokSaveStatus === 'saving' && <span className="text-blue-600">💾 Saving...</span>}
                {grokSaveStatus === 'saved' && <span className="text-green-600">✅ Saved</span>}
                {grokSaveStatus === 'error' && <span className="text-red-600">❌ Save error</span>}
              </div>
            </div>
            <div className="relative">
              <textarea
                value={grokResponse}
                onChange={(e) => setGrokResponse(e.target.value)}
                rows={12}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono text-sm"
                placeholder="Grok analysis will appear here after sending... You can edit the response if needed."
                onKeyDown={(e) => {
                  // Ctrl+S to force save
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault()
                    forceGrokSave()
                  }
                }}
              />
              {grokAnalyzing && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <div className="mt-2 text-sm text-gray-600">Analyzing with Grok...</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 pt-6 border-t mt-6">
          <button
            onClick={handleCompleteReview}
            disabled={completing}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-green-400 disabled:cursor-not-allowed"
          >
            {completing ? 'Completing Review...' : '✓ Complete Review & Remove from Queue'}
          </button>
          <button
            onClick={onBackToQueue}
            disabled={completing}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            ← Back to Queue
          </button>
        </div>
      </div>

      {/* 5. Progress Charts & Analytics - Full Width */}
      {submissionChartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-xl font-semibold text-gray-900 mb-6">
            📊 {submission.profiles.first_name} {submission.profiles.last_name} - Progress Charts & Analytics
          </h4>
          <ChartsDashboard 
            patientId={submission.user_id}
          />
        </div>
      )}

      {/* NEW: Unified Day-Based Image Viewer Modal */}
      {viewingDayImageSet && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-[90vw] max-h-full bg-white rounded-lg overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gray-100 px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {viewingDayImageSet.days[viewingDayImageSet.currentIndex].day} Daily Comparison - Week {submission.week_number}
                </h3>
                <div className="text-sm text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
                  {viewingDayImageSet.currentIndex + 1} of {viewingDayImageSet.days.length} days
                </div>
              </div>
              <button
                onClick={() => setViewingDayImageSet(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none"
                title="Close (ESC)"
              >
                ×
              </button>
            </div>
            
            {/* Modal Body with Navigation */}
            <div className="flex items-center justify-center p-6 min-h-[80vh]">
              {/* Previous Button - Outside the images */}
              <button
                onClick={() => dayNavigateImage('prev')}
                className="bg-white text-gray-800 p-4 rounded-full hover:bg-gray-100 transition-all shadow-lg border-2 border-gray-200 mr-6"
                title="Previous day (Left Arrow)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Side-by-Side Images Container */}
              <div className="flex justify-center items-center space-x-8 flex-1">
                {/* Lumen Image */}
                <div className="flex-1 text-center">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mb-4 inline-block">
                    Lumen Screenshot
                  </div>
                  <div className="flex items-center justify-center" style={{ minHeight: '70vh' }}>
                    {viewingDayImageSet.days[viewingDayImageSet.currentIndex].lumenImage ? (
                      <img
                        src={viewingDayImageSet.days[viewingDayImageSet.currentIndex].lumenImage!.url}
                        alt={viewingDayImageSet.days[viewingDayImageSet.currentIndex].lumenImage!.title}
                        className="max-w-full max-h-[70vh] object-contain border-2 border-blue-200 rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="max-w-full max-h-[70vh] bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500" style={{ minHeight: '500px', width: '300px' }}>
                        <div className="text-center">
                          <div className="text-4xl mb-2">📱</div>
                          <div className="text-sm">No Lumen Image</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Food Log Image */}
                <div className="flex-1 text-center">
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium mb-4 inline-block">
                    Food Log Screenshot
                  </div>
                  <div className="flex items-center justify-center" style={{ minHeight: '70vh' }}>
                    {viewingDayImageSet.days[viewingDayImageSet.currentIndex].foodLogImage ? (
                      <img
                        src={viewingDayImageSet.days[viewingDayImageSet.currentIndex].foodLogImage!.url}
                        alt={viewingDayImageSet.days[viewingDayImageSet.currentIndex].foodLogImage!.title}
                        className="max-w-full max-h-[70vh] object-contain border-2 border-green-200 rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="max-w-full max-h-[70vh] bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500" style={{ minHeight: '500px', width: '300px' }}>
                        <div className="text-center">
                          <div className="text-4xl mb-2">🍽️</div>
                          <div className="text-sm">No Food Log Image</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Next Button - Outside the images */}
              <button
                onClick={() => dayNavigateImage('next')}
                className="bg-white text-gray-800 p-4 rounded-full hover:bg-gray-100 transition-all shadow-lg border-2 border-gray-200 ml-6"
                title="Next day (Right Arrow)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            {/* Modal Footer with Day Indicators */}
            <div className="bg-gray-100 px-6 py-3 border-t">
              <div className="flex items-center justify-center space-x-2">
                {viewingDayImageSet.days.map((dayData, index) => (
                  <button
                    key={index}
                    onClick={() => setViewingDayImageSet(prev => prev ? { ...prev, currentIndex: index } : null)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      index === viewingDayImageSet.currentIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title={`Jump to ${dayData.day}`}
                  >
                    {dayData.day.slice(0, 3)}
                  </button>
                ))}
              </div>
              <div className="text-center text-xs text-gray-500 mt-2">
                Use ← → arrow keys or click day buttons to navigate
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Image Viewer Modal with Navigation */}
      {viewingImageSet && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-6xl max-h-full bg-white rounded-lg overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gray-100 px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {viewingImageSet.images[viewingImageSet.currentIndex].title}
                </h3>
                <div className="text-sm text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
                  {viewingImageSet.currentIndex + 1} of {viewingImageSet.images.length} 
                  {viewingImageSet.imageType === 'lumen' ? ' Lumen' : viewingImageSet.imageType === 'food_log' ? ' Food Log' : ' Fasting'} images
                </div>
              </div>
              <button
                onClick={() => setViewingImageSet(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none"
                title="Close (ESC)"
              >
                ×
              </button>
            </div>
            
            {/* Modal Body with Navigation */}
            <div className="relative p-6">
              {/* Previous Button */}
              {viewingImageSet.images.length > 1 && (
                <button
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-all z-10"
                  title="Previous image (Left Arrow)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              
              {/* Image */}
              <img
                src={viewingImageSet.images[viewingImageSet.currentIndex].url}
                alt={viewingImageSet.images[viewingImageSet.currentIndex].title}
                className="max-w-full max-h-[85vh] object-contain mx-auto"
              />
              
              {/* Next Button */}
              {viewingImageSet.images.length > 1 && (
                <button
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-all z-10"
                  title="Next image (Right Arrow)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Modal Footer with Day Indicators */}
            {viewingImageSet.images.length > 1 && (
              <div className="bg-gray-100 px-6 py-3 border-t">
                <div className="flex items-center justify-center space-x-2">
                  {viewingImageSet.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setViewingImageSet(prev => prev ? { ...prev, currentIndex: index } : null)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        index === viewingImageSet.currentIndex
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      title={`Jump to ${image.day}`}
                    >
                      {image.day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                  Use ← → arrow keys or click day buttons to navigate
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Viewer Modal - Side by Side Layout */}
      {viewingPdf && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-7xl h-full max-h-[90vh] bg-white rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-100 px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">{viewingPdf.title}</h3>
              <button
                onClick={() => {
                  // Save analysis changes before closing
                  if (viewingPdf.analysisType === 'weekly') {
                    setWeeklyAnalysis(viewingPdf.analysisText)
                  } else {
                    setMonthlyAnalysis(viewingPdf.analysisText)
                  }
                  setViewingPdf(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Left side - PDF Viewer */}
              <div className="w-1/2 border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                </div>
                <div className="flex-1 p-4 overflow-auto bg-gray-50">
                  {/* PDF Viewer - Full height iframe */}
                  <div className="h-full bg-white border border-gray-300 rounded overflow-hidden">
                    <iframe
                      src={viewingPdf.url}
                      className="w-full h-full"
                      title="PDF Viewer"
                      style={{ minHeight: '500px' }}
                    />
                  </div>
                  
                  {/* Fallback buttons if iframe doesn't work */}
                  <div className="mt-4 flex space-x-2">
                    <a
                      href={viewingPdf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      Open in New Tab ↗
                    </a>
                    <a
                      href={viewingPdf.url}
                      download
                      className="inline-flex items-center px-3 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              </div>
              
              {/* Right side - Analysis Editor */}
              <div className="w-1/2 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                  <h4 className="text-sm font-medium text-gray-700">
                    {viewingPdf.analysisType === 'weekly' ? 'Weekly' : 'Monthly'} Analysis Notes
                  </h4>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                  <textarea
                    value={viewingPdf.analysisText}
                    onChange={(e) => setViewingPdf({
                      ...viewingPdf,
                      analysisText: e.target.value
                    })}
                    className="w-full h-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                    placeholder={`Enter your ${viewingPdf.analysisType} analysis notes while reviewing the PDF...`}
                  />
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <button
                    onClick={() => {
                      // Save analysis changes
                      if (viewingPdf.analysisType === 'weekly') {
                        setWeeklyAnalysis(viewingPdf.analysisText)
                      } else {
                        setMonthlyAnalysis(viewingPdf.analysisText)
                      }
                      setViewingPdf(null)
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Save Analysis & Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <StickyNotes 
        patientId={submission.user_id}
        patientName={`${submission.profiles.first_name} ${submission.profiles.last_name}`}
      />
      
      <StickySummary
        patientId={submission.user_id}
        patientName={`${submission.profiles.first_name} ${submission.profiles.last_name}`}
        mondayMessage={mondayMessage}
        weeklyAnalysis={weeklyAnalysis}
        monthlyAnalysis={monthlyAnalysis}
        grokResponse={grokResponse}
      />
    </div>
  )
}