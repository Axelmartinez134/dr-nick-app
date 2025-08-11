// src/app/components/health/HealthForm.tsx
// Weekly health check-in form with smart week detection, developer mode, and individual image uploads

'use client'

import { useState, useEffect, useCallback } from 'react'
import { saveWeeklyCheckin, getCheckinForWeek, hasUserSubmittedThisWeek, type CheckinFormData } from './healthService'
import { supabase } from '../auth/AuthContext'
import { fetchUnitSystem, getLengthUnitLabel, getWeightUnitLabel, UnitSystem } from './unitUtils'
import { uploadSingleImage, deleteImageByUrl, getSignedImageUrl } from './imageService'

// Extended CheckinFormData interface to include notes
interface ExtendedCheckinFormData extends CheckinFormData {
  notes?: string
}

// AoE helpers (match logic used in AuthContext gap-fill)
function toAoE(date: Date): Date {
  const offset = 14 * 60
  return new Date(date.getTime() + offset * 60000)
}
function getAoEMonday(date: Date): Date {
  const aoe = toAoE(date)
  const dayOfWeek = aoe.getDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(aoe)
  monday.setDate(aoe.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}
function calculateAoECurrentWeekFromWeek1(week1AoEMonday: Date): number {
  const nowAoEMonday = getAoEMonday(new Date())
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const diffMs = nowAoEMonday.getTime() - week1AoEMonday.getTime()
  const weeksElapsed = Math.floor(diffMs / msPerWeek)
  return weeksElapsed + 1
}

// Calendar-based week calculation with relaxed baseline anchor.
// Priority:
// 1) Patient-submitted Week 1
// 2) Any Week 1 (regardless of data_entered_by)
// 3) Fallback to the smallest available week_number as baseline
const calculateCurrentWeek = async (userId: string): Promise<number> => {
  try {
    // 1) Patient-submitted Week 1
    const { data: patientWeek1Rows, error: patientWeek1Error } = await supabase
      .from('health_data')
      .select('date')
      .eq('user_id', userId)
      .eq('week_number', 1)
      .eq('data_entered_by', 'patient')
      .order('created_at', { ascending: true })
      .limit(1)

    if (patientWeek1Error) {
      console.warn('calculateCurrentWeek: failed to fetch patient Week 1 baseline', patientWeek1Error)
    }
    if (patientWeek1Rows && patientWeek1Rows.length > 0) {
      const week1Date = new Date(patientWeek1Rows[0].date)
      const week1AoEMonday = getAoEMonday(week1Date)
      return calculateAoECurrentWeekFromWeek1(week1AoEMonday)
    }

    // 2) Any Week 1 (admin/system imported)
    const { data: anyWeek1Rows, error: anyWeek1Error } = await supabase
      .from('health_data')
      .select('date')
      .eq('user_id', userId)
      .eq('week_number', 1)
      .order('created_at', { ascending: true })
      .limit(1)

    if (anyWeek1Error) {
      console.warn('calculateCurrentWeek: failed to fetch any Week 1 baseline', anyWeek1Error)
    }
    if (anyWeek1Rows && anyWeek1Rows.length > 0) {
      const week1Date = new Date(anyWeek1Rows[0].date)
      const week1AoEMonday = getAoEMonday(week1Date)
      return calculateAoECurrentWeekFromWeek1(week1AoEMonday)
    }

    // 3) Fallback: smallest available week_number as baseline
    const { data: baselineRows, error: baselineError } = await supabase
      .from('health_data')
      .select('date, week_number')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })
      .limit(1)

    if (baselineError) {
      console.warn('calculateCurrentWeek: failed to fetch baseline row', baselineError)
      return 1
    }
    if (!baselineRows || baselineRows.length === 0) {
      return 1
    }

    const baselineDate = new Date(baselineRows[0].date as string)
    const baselineWeekNumber = Number(baselineRows[0].week_number) || 0
    const baselineAoEMonday = getAoEMonday(baselineDate)

    // Weeks elapsed since baseline AoE Monday (Week 1 baseline would yield weeksElapsed+1)
    const weeksElapsedSinceBaseline = calculateAoECurrentWeekFromWeek1(baselineAoEMonday) - 1
    const computedCurrentWeek = baselineWeekNumber + weeksElapsedSinceBaseline

    // Ensure at least Week 1
    return Math.max(1, computedCurrentWeek)
  } catch (error) {
    console.error('Error calculating current week:', error)
    return 1
  }
}

// Check if user already submitted for current week (patient rows only)
const checkIfAlreadySubmitted = async (userId: string, weekNumber: number): Promise<boolean> => {
  try {
    const { data: existing, error } = await supabase
      .from('health_data')
      .select('id')
      .eq('user_id', userId)
      .eq('week_number', weekNumber)
      .eq('data_entered_by', 'patient')
      .limit(1)

    if (error) {
      console.error('Error checking existing submission:', error)
      return false
    }

    return existing && existing.length > 0
  } catch (error) {
    console.error('Error checking submission:', error)
    return false
  }
}

// Get highest existing week number for a user (any source)
const fetchMaxExistingWeek = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('health_data')
      .select('week_number')
      .eq('user_id', userId)
      .order('week_number', { ascending: false })
      .limit(1)

    if (error) {
      console.warn('Error fetching max existing week:', error)
      return 0
    }
    if (!data || data.length === 0) return 0
    return Number(data[0].week_number) || 0
  } catch (e) {
    console.warn('Exception fetching max existing week:', e)
    return 0
  }
}

// Format Date to YYYY-MM-DD using UTC components
function toIsoDateUTC(d: Date): string {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Check if current day is within submission window (Monday-Wednesday)
const isValidSubmissionDay = (devMode: boolean): boolean => {
  if (devMode) return true // Dev mode bypasses restrictions
  
  // Get current time when first Monday occurs on Earth (UTC+14)
  const now = new Date()
  const firstMondayOffset = 14 * 60 // UTC+14 offset in minutes (Line Islands, Kiribati)
  const firstMondayTime = new Date(now.getTime() + (firstMondayOffset * 60000))
  
  const dayOfWeek = firstMondayTime.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Monday (1), Tuesday (2), Wednesday (3) are valid
  return dayOfWeek >= 1 && dayOfWeek <= 3
}

// Day names for labeling
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function HealthForm() {
  // Form state
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  useEffect(() => {
    (async () => {
      const u = await fetchUnitSystem()
      setUnitSystem(u)
    })()
  }, [])
  const [formData, setFormData] = useState<ExtendedCheckinFormData>({
    date: new Date().toISOString().split('T')[0],
    week_number: '1',
    weight: '',
    waist: '',
    resistance_training_days: '',
    symptom_tracking_days: '',
    detailed_symptom_notes: '',
    purposeful_exercise_days: '',
    poor_recovery_days: '',
    energetic_constraints_reduction_ok: false,
    notes: '',
    // Add all image fields
    lumen_day1_image: '',
    lumen_day2_image: '',
    lumen_day3_image: '',
    lumen_day4_image: '',
    lumen_day5_image: '',
    lumen_day6_image: '',
    lumen_day7_image: '',
    food_log_day1_image: '',
    food_log_day2_image: '',
    food_log_day3_image: '',
    food_log_day4_image: '',
    food_log_day5_image: '',
    food_log_day6_image: '',
    food_log_day7_image: ''
  })
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  
  // Week management
  const [activeWeek, setActiveWeek] = useState(1)
  const [devMode, setDevMode] = useState(false)
  const [devWeek, setDevWeek] = useState(1)
  
  // Submission state management
  const [hasSubmittedForCurrentWeek, setHasSubmittedForCurrentWeek] = useState(false)
  const [isSubmissionSuccessful, setIsSubmissionSuccessful] = useState(false)
  const [alreadySubmittedThisWeek, setAlreadySubmittedThisWeek] = useState(false)
  const [checkingSubmissionStatus, setCheckingSubmissionStatus] = useState(true)
  
  // Resistance training goal state
  const [resistanceTrainingGoal, setResistanceTrainingGoal] = useState<number>(0)
  const [isTestAccount, setIsTestAccount] = useState<boolean>(false)

  // Reset submission success state when dev week changes
  useEffect(() => {
    if (devMode) {
      setIsSubmissionSuccessful(false)
      setAlreadySubmittedThisWeek(false) // Reset date-based check in dev mode
      
      // Check if already submitted for the selected dev week
      const checkDevWeekSubmission = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const alreadySubmitted = await checkIfAlreadySubmitted(user.id, devWeek)
          setHasSubmittedForCurrentWeek(alreadySubmitted)
        }
      }
      
      checkDevWeekSubmission()
    } else {
      // When exiting dev mode, re-check the date-based submission status
      const recheckSubmissionStatus = async () => {
        const weeklySubmissionCheck = await hasUserSubmittedThisWeek()
        if (!weeklySubmissionCheck.error) {
          setAlreadySubmittedThisWeek(weeklySubmissionCheck.hasSubmitted)
        }
      }
      
      recheckSubmissionStatus()
    }
  }, [devWeek, devMode])

  // Image upload states for each day
  const [uploadingStates, setUploadingStates] = useState<{[key: string]: boolean}>({})
  const [uploadQueue, setUploadQueue] = useState<Array<{file: File, imageType: 'lumen' | 'food_log', dayNumber: number}>>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  
  // Image viewer modal state
  const [viewingImage, setViewingImage] = useState<{
    url: string
    title: string
  } | null>(null)
  
  // Signed URLs for displaying images
  const [signedUrls, setSignedUrls] = useState<{[key: string]: string}>({})

  // Load resistance training goal from profile
  const loadResistanceTrainingGoal = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('resistance_training_days_goal, client_status')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading resistance training goal:', error)
        return
      }

      setResistanceTrainingGoal(profileData?.resistance_training_days_goal || 0)
      setIsTestAccount((profileData as any)?.client_status === 'Test')
    } catch (error) {
      console.error('Error loading resistance training goal:', error)
    }
  }

  // Load user and calculate current week
  const loadUserAndCalculateWeek = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage('Please log in to access the form')
        setLoading(false)
        return
      }

      const calculatedWeek = await calculateCurrentWeek(user.id)
      const maxExistingWeek = await fetchMaxExistingWeek(user.id)
      // Display the later of AoE current week and next-after-highest existing week
      const targetWeek = Math.max(calculatedWeek, (maxExistingWeek || 0) + 1)
      setActiveWeek(targetWeek)
      setDevWeek(targetWeek)
      
      // Check if user already submitted for target week (patient row based)
      const alreadySubmitted = await checkIfAlreadySubmitted(user.id, targetWeek)
      setHasSubmittedForCurrentWeek(alreadySubmitted)
      
      // Check if user already submitted this week (date-based using same UTC+14 boundaries)
      setCheckingSubmissionStatus(true)
      const weeklySubmissionCheck = await hasUserSubmittedThisWeek()
      if (weeklySubmissionCheck.error) {
        console.error('Error checking weekly submission status:', weeklySubmissionCheck.error)
      } else {
        setAlreadySubmittedThisWeek(weeklySubmissionCheck.hasSubmitted)
      }
      setCheckingSubmissionStatus(false)
      
      // Load resistance training goal
      await loadResistanceTrainingGoal()
      
      // Load existing form data if available
      await loadExistingFormData(user.id, targetWeek)
      
    } catch (error) {
      console.error('Error loading user data:', error)
      setMessage('Error loading user data')
    } finally {
      setLoading(false)
    }
  }

  // Load existing form data for the current week
  const loadExistingFormData = async (userId: string, weekNumber: number) => {
    try {
      setIsLoading(true)
      const result = await getCheckinForWeek(weekNumber)
      
      if (result.data) {
        const existingData = result.data
        setFormData({
          date: existingData.date,
          week_number: weekNumber.toString(),
          weight: existingData.weight?.toString() || '',
          waist: existingData.waist?.toString() || '',
          resistance_training_days: existingData.resistance_training_days?.toString() || '',
          symptom_tracking_days: existingData.symptom_tracking_days?.toString() || '',
          detailed_symptom_notes: existingData.detailed_symptom_notes || '',
          purposeful_exercise_days: existingData.purposeful_exercise_days?.toString() || '',
          poor_recovery_days: existingData.poor_recovery_days?.toString() || '',
          energetic_constraints_reduction_ok: existingData.energetic_constraints_reduction_ok || false,
          // Load image URLs
          lumen_day1_image: existingData.lumen_day1_image || '',
          lumen_day2_image: existingData.lumen_day2_image || '',
          lumen_day3_image: existingData.lumen_day3_image || '',
          lumen_day4_image: existingData.lumen_day4_image || '',
          lumen_day5_image: existingData.lumen_day5_image || '',
          lumen_day6_image: existingData.lumen_day6_image || '',
          lumen_day7_image: existingData.lumen_day7_image || '',
          food_log_day1_image: existingData.food_log_day1_image || '',
          food_log_day2_image: existingData.food_log_day2_image || '',
          food_log_day3_image: existingData.food_log_day3_image || '',
          food_log_day4_image: existingData.food_log_day4_image || '',
          food_log_day5_image: existingData.food_log_day5_image || '',
          food_log_day6_image: existingData.food_log_day6_image || '',
          food_log_day7_image: existingData.food_log_day7_image || '',
          notes: '' // Notes aren't stored in health_data table
        })
      }
    } catch (error) {
      console.error('Error loading existing form data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize form on component mount
  useEffect(() => {
    loadUserAndCalculateWeek()
  }, [])

  // Update week number when activeWeek changes
  useEffect(() => {
    const currentWeek = devMode ? devWeek : activeWeek
    setFormData(prev => ({
      ...prev,
      week_number: currentWeek.toString()
    }))
  }, [activeWeek, devMode, devWeek])

  // Generate signed URLs for existing images when form data changes
  useEffect(() => {
    const imageFields = [
      'lumen_day1_image', 'lumen_day2_image', 'lumen_day3_image', 'lumen_day4_image', 
      'lumen_day5_image', 'lumen_day6_image', 'lumen_day7_image',
      'food_log_day1_image', 'food_log_day2_image', 'food_log_day3_image', 
      'food_log_day4_image', 'food_log_day5_image', 'food_log_day6_image', 'food_log_day7_image'
    ]

    imageFields.forEach(fieldName => {
      const imageUrl = formData[fieldName as keyof CheckinFormData] as string
      if (imageUrl) {
        const match = fieldName.match(/(\w+)_day(\d+)_image/)
        if (match) {
          const [, imageType, dayNumber] = match
          const uploadKey = `${imageType}_day${dayNumber}`
          if (!signedUrls[uploadKey]) {
            generateSignedUrl(imageUrl, uploadKey)
          }
        }
      }
    })
  }, [formData])

  // Form validation
  const validateForm = () => {
    const errors: {[key: string]: string} = {}
    
    // Weight validation - REQUIRED
    if (!formData.weight || !formData.weight.trim()) {
      errors.weight = 'Weight is required'
    } else if (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0) {
      errors.weight = 'Weight must be a positive number'
    }
    
    // Waist validation - REQUIRED
    if (!formData.waist || !formData.waist.trim()) {
      errors.waist = 'Waist measurement is required'
    } else if (isNaN(Number(formData.waist)) || Number(formData.waist) <= 0) {
      errors.waist = 'Waist measurement must be a positive number'
    }
    
    // Days purposeful exercise validation - REQUIRED
    if (!formData.purposeful_exercise_days || !formData.purposeful_exercise_days.trim()) {
      errors.purposeful_exercise_days = 'Days purposeful exercise is required'
    } else if (isNaN(Number(formData.purposeful_exercise_days)) ||
      Number(formData.purposeful_exercise_days) < 0 ||
      Number(formData.purposeful_exercise_days) > 7) {
      errors.purposeful_exercise_days = 'Days purposeful exercise must be between 0 and 7'
    }
    
    // Resistance training days validation - REQUIRED
    if (!formData.resistance_training_days || !formData.resistance_training_days.trim()) {
      errors.resistance_training_days = 'Resistance training days is required'
    } else if (isNaN(Number(formData.resistance_training_days)) || 
         Number(formData.resistance_training_days) < 0 || 
         Number(formData.resistance_training_days) > 7) {
      errors.resistance_training_days = 'Resistance training days must be between 0 and 7'
    }
    
    // Symptom tracking days validation - REQUIRED
    if (!formData.symptom_tracking_days || !formData.symptom_tracking_days.trim()) {
      errors.symptom_tracking_days = 'Symptom tracking days is required'
    } else if (isNaN(Number(formData.symptom_tracking_days)) ||
      Number(formData.symptom_tracking_days) < 0 ||
      Number(formData.symptom_tracking_days) > 7) {
      errors.symptom_tracking_days = 'Symptom tracking days must be between 0 and 7'
    }
    
    // Poor recovery days validation - REQUIRED
    if (!formData.poor_recovery_days || !formData.poor_recovery_days.trim()) {
      errors.poor_recovery_days = 'Poor recovery days is required'
    } else if (isNaN(Number(formData.poor_recovery_days)) || 
         Number(formData.poor_recovery_days) < 0 || 
         Number(formData.poor_recovery_days) > 7) {
      errors.poor_recovery_days = 'Poor recovery days must be between 0 and 7'
    }
    
    // Self reflection validation - REQUIRED
    if (!formData.notes || !formData.notes.trim()) {
      errors.notes = 'Self reflection is required'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setMessage('Please fix the errors above before submitting')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage('Please log in to submit the form')
        return
      }

      // Recompute target week at submit time to prevent stale submissions
      const freshCalculatedWeek = await calculateCurrentWeek(user.id)
      const freshMaxWeek = await fetchMaxExistingWeek(user.id)
      const computedTargetWeek = Math.max(freshCalculatedWeek, (freshMaxWeek || 0) + 1)
      const weekToSubmit = devMode ? devWeek : computedTargetWeek

      // Check if current day is within submission window (Monday-Wednesday)
      if (!isValidSubmissionDay(devMode)) {
        setMessage('Submissions only allowed Monday')
        setIsSubmitting(false)
        return
      }

      // Block early submission if AoE calendar week has not yet reached the displayed target
      if (!devMode && freshCalculatedWeek < computedTargetWeek) {
        setMessage('Submissions only allowed Monday')
        setIsSubmitting(false)
        return
      }

      // Check if user already submitted for current week
      const alreadySubmitted = await checkIfAlreadySubmitted(user.id, weekToSubmit)
      if (alreadySubmitted) {
        setMessage(`You already submitted for Week ${weekToSubmit}`)
        setIsSubmitting(false)
        return
      }

      // FUTURE FEATURE: Detect user's timezone (currently disabled)
      // const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      // Update form data with correct week number and AoE Monday date
      const computeAoEMondayForTarget = async (): Promise<string> => {
        // Patient Week 1 baseline
        const { data: p1 } = await supabase
          .from('health_data')
          .select('date')
          .eq('user_id', user.id)
          .eq('week_number', 1)
          .eq('data_entered_by', 'patient')
          .order('created_at', { ascending: true })
          .limit(1)
        if (p1 && p1.length > 0) {
          const base = getAoEMonday(new Date(p1[0].date))
          const d = new Date(base)
          d.setDate(d.getDate() + (weekToSubmit - 1) * 7)
          return toIsoDateUTC(d)
        }
        // Any Week 1 baseline
        const { data: a1 } = await supabase
          .from('health_data')
          .select('date')
          .eq('user_id', user.id)
          .eq('week_number', 1)
          .order('created_at', { ascending: true })
          .limit(1)
        if (a1 && a1.length > 0) {
          const base = getAoEMonday(new Date(a1[0].date))
          const d = new Date(base)
          d.setDate(d.getDate() + (weekToSubmit - 1) * 7)
          return toIsoDateUTC(d)
        }
        // Fallback: earliest row as baseline
        const { data: earliest } = await supabase
          .from('health_data')
          .select('date, week_number')
          .eq('user_id', user.id)
          .order('week_number', { ascending: true })
          .limit(1)
        if (earliest && earliest.length > 0) {
          const baselineDate = getAoEMonday(new Date(earliest[0].date))
          const baselineWeek = Number(earliest[0].week_number) || 0
          const d = new Date(baselineDate)
          d.setDate(d.getDate() + (weekToSubmit - baselineWeek) * 7)
          return toIsoDateUTC(d)
        }
        // If no baseline rows exist, assume this is Week 1 baseline
        const d = getAoEMonday(new Date())
        return toIsoDateUTC(d)
      }

      const submissionData = {
        ...formData,
        week_number: weekToSubmit.toString(),
        date: await computeAoEMondayForTarget()
      }

      const result = await saveWeeklyCheckin(submissionData)
      
      if (result.data) {
        setMessage(`✅ Week ${weekToSubmit} check-in submitted successfully!`)
        setIsSubmissionSuccessful(true)
        setHasSubmittedForCurrentWeek(true)
        setAlreadySubmittedThisWeek(true)
        
        // If not in dev mode, recalculate the current week
        if (!devMode) {
          const newCurrentWeek = await calculateCurrentWeek(user.id)
          const newMaxWeek = await fetchMaxExistingWeek(user.id)
          const nextTarget = Math.max(newCurrentWeek, (newMaxWeek || 0) + 1)
          setActiveWeek(nextTarget)
          setDevWeek(nextTarget)
          // Load data for the new target week if it exists
          await loadExistingFormData(user.id, nextTarget)
        }
    } else {
        setMessage(`Error: ${(result.error as any)?.message || 'Unknown error occurred'}`)
      }
    } catch (error) {
      console.error('Submission error:', error)
      setMessage('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle input changes
  const handleInputChange = (field: keyof ExtendedCheckinFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  // Add image to upload queue
  const addToUploadQueue = (file: File, imageType: 'lumen' | 'food_log', dayNumber: number) => {
    setUploadQueue(prev => [...prev, { file, imageType, dayNumber }])
  }

  // Process upload queue one at a time
  const processUploadQueue = useCallback(async () => {
    if (isProcessingQueue || uploadQueue.length === 0) return
    
    setIsProcessingQueue(true)
    
    // Process one item at a time
    const queueCopy = [...uploadQueue]
    setUploadQueue([]) // Clear the queue immediately to prevent re-triggers
    
    for (const { file, imageType, dayNumber } of queueCopy) {
      await handleSingleImageUpload(file, imageType, dayNumber)
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    setIsProcessingQueue(false)
  }, [uploadQueue, isProcessingQueue, devMode, devWeek, activeWeek, formData])

  // Handle individual image upload (internal function)
  const handleSingleImageUpload = async (
    file: File,
    imageType: 'lumen' | 'food_log',
    dayNumber: number
  ) => {
    const fieldName = `${imageType}_day${dayNumber}_image` as keyof CheckinFormData
    const uploadKey = `${imageType}_day${dayNumber}`
    
    try {
      setUploadingStates(prev => ({ ...prev, [uploadKey]: true }))
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to upload images')
      return
    }

      const currentWeek = devMode ? devWeek : activeWeek

      // Delete existing image if there is one
      const existingUrl = formData[fieldName] as string
      if (existingUrl) {
        await deleteImageByUrl(existingUrl)
      }

      // Upload new image
      const uploadResult = await uploadSingleImage(
        file,
        user.id,
        currentWeek,
        imageType,
        dayNumber
      )

      if (uploadResult.success && uploadResult.url) {
        // Update form data with new image URL
        setFormData(prev => ({
          ...prev,
          [fieldName]: uploadResult.url
        }))
        
        // Generate signed URL for immediate display
        generateSignedUrl(uploadResult.url, uploadKey)
      } else {
        alert(`Failed to upload image: ${uploadResult.error}`)
      }
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploadingStates(prev => ({ ...prev, [uploadKey]: false }))
    }
  }

  // Process queue when new items are added
  useEffect(() => {
    if (uploadQueue.length > 0 && !isProcessingQueue) {
      processUploadQueue()
    }
  }, [uploadQueue.length, isProcessingQueue, processUploadQueue])

  // Handle image removal
  const handleImageRemove = async (imageType: 'lumen' | 'food_log', dayNumber: number) => {
    const fieldName = `${imageType}_day${dayNumber}_image` as keyof CheckinFormData
    const uploadKey = `${imageType}_day${dayNumber}`
    
    try {
      setUploadingStates(prev => ({ ...prev, [uploadKey]: true }))
      
      const existingUrl = formData[fieldName] as string
      if (existingUrl) {
        await deleteImageByUrl(existingUrl)
      }

      // Clear the URL from form data and signed URLs
      setFormData(prev => ({
        ...prev,
        [fieldName]: ''
      }))
      setSignedUrls(prev => {
        const newUrls = { ...prev }
        delete newUrls[uploadKey]
        return newUrls
      })
    } catch (error) {
      console.error('Image removal error:', error)
      alert('Failed to remove image. Please try again.')
    } finally {
      setUploadingStates(prev => ({ ...prev, [uploadKey]: false }))
    }
  }

  // Generate signed URL for an image
  const generateSignedUrl = async (imageUrl: string, uploadKey: string) => {
    if (!imageUrl || signedUrls[uploadKey]) return
    
    try {
      const signedUrl = await getSignedImageUrl(imageUrl, 3600) // 1 hour expiry
      if (signedUrl && signedUrl !== imageUrl) {
        setSignedUrls(prev => ({ ...prev, [uploadKey]: signedUrl }))
    } else {
        // If it's already a public URL or signed URL creation failed, use the original
        setSignedUrls(prev => ({ ...prev, [uploadKey]: imageUrl }))
      }
    } catch (error) {
      console.error('Error generating signed URL:', error)
      // Fallback to original URL
      setSignedUrls(prev => ({ ...prev, [uploadKey]: imageUrl }))
    }
  }

  // Individual image upload component
  const ImageUploadSlot = ({ 
    imageType, 
    dayNumber, 
    dayName 
  }: { 
    imageType: 'lumen' | 'food_log', 
    dayNumber: number, 
    dayName: string 
  }) => {
    const fieldName = `${imageType}_day${dayNumber}_image` as keyof CheckinFormData
    const uploadKey = `${imageType}_day${dayNumber}`
    const imageUrl = formData[fieldName] as string
    const displayUrl = signedUrls[uploadKey] || imageUrl
    const isUploading = uploadingStates[uploadKey]
    const isRequired = imageType === 'lumen'
    const isInQueue = uploadQueue.some(item => item.imageType === imageType && item.dayNumber === dayNumber)

    // Generate signed URL when image URL is available
    useEffect(() => {
      if (imageUrl && !signedUrls[uploadKey]) {
        generateSignedUrl(imageUrl, uploadKey)
      }
    }, [imageUrl, uploadKey])

    return (
      <div className={`border rounded-lg p-4 transition-all ${
        imageUrl 
          ? 'border-green-300 bg-green-50' 
          : isUploading || isInQueue
          ? 'border-blue-300 bg-blue-50'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="font-medium text-gray-900">
              {dayName} ({imageType === 'lumen' ? 'Lumen' : 'Food Log'})
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </h4>
            <p className="text-xs text-gray-500">
              Day {dayNumber} - {isRequired ? 'Required' : 'Optional'}
            </p>
          </div>
          {/* Status indicator */}
          <div className="text-xs">
            {imageUrl && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Uploaded
              </span>
            )}
            {isUploading && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                📤 Uploading...
              </span>
            )}
            {isInQueue && !isUploading && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                ⏳ In Queue
              </span>
            )}
          </div>
        </div>

        {imageUrl ? (
          // Show existing image
          <div className="space-y-2">
            <div className="relative">
              {displayUrl ? (
                <img 
                  src={displayUrl} 
                  alt={`${dayName} ${imageType}`}
                  className="w-full h-32 object-cover rounded border shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setViewingImage({
                    url: displayUrl,
                    title: `${dayName} ${imageType === 'lumen' ? 'Lumen Screenshot' : 'Food Log Screenshot'}`
                  })}
                  title="Click to view full size"
                  onError={() => {
                    console.error('Image failed to load:', displayUrl)
                    // Try to regenerate signed URL on error
                    generateSignedUrl(imageUrl, uploadKey)
                  }}
                />
              ) : (
                <div className="w-full h-32 bg-gray-200 rounded border flex items-center justify-center">
                  <div className="text-gray-500 text-sm">Loading image...</div>
                </div>
              )}
              <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                ✓
              </div>
              <button
                onClick={() => handleImageRemove(imageType, dayNumber)}
                disabled={isUploading || isInQueue}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 disabled:bg-gray-400"
                title="Remove image"
              >
                ×
              </button>
              {/* View button overlay */}
              <button
                onClick={() => displayUrl && setViewingImage({
                  url: displayUrl,
                  title: `${dayName} ${imageType === 'lumen' ? 'Lumen Screenshot' : 'Food Log Screenshot'}`
                })}
                disabled={!displayUrl}
                className="absolute bottom-1 right-1 bg-blue-500 text-white rounded px-2 py-1 text-xs hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                title="Click to view full size"
              >
                👁️ View
              </button>
            </div>
            <div className="flex space-x-2">
              <label className="flex-1">
                <span className="sr-only">Replace {dayName} {imageType} image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      addToUploadQueue(file, imageType, dayNumber)
                    }
                  }}
                  disabled={isUploading || isInQueue}
                  className="hidden"
                />
                <div className={`w-full text-center py-2 px-3 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50 cursor-pointer transition-colors ${
                  (isUploading || isInQueue) ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}>
                  {isUploading ? 'Uploading...' : isInQueue ? 'Queued...' : 'Replace'}
                </div>
              </label>
            </div>
            {/* Debug info */}
            <div className="text-xs text-gray-500 mt-1">
              <div>Original URL: {imageUrl ? '✅ Set' : '❌ Empty'}</div>
              <div>Display URL: {displayUrl ? '✅ Ready' : '⏳ Loading...'}</div>
              {imageUrl && displayUrl && imageUrl !== displayUrl && (
                <div className="text-blue-600">🔐 Using signed URL</div>
              )}
            </div>
          </div>
        ) : (
          // Show upload area
          <div>
            <label className="block">
              <span className="sr-only">Upload {dayName} {imageType} image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    addToUploadQueue(file, imageType, dayNumber)
                  }
                }}
                disabled={isUploading || isInQueue}
                className="hidden"
              />
              <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                isUploading || isInQueue
                  ? 'border-blue-400 bg-blue-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}>
                {isUploading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600">Uploading...</span>
                  </div>
                ) : isInQueue ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-pulse rounded-full h-4 w-4 bg-yellow-400"></div>
                    <span className="text-sm text-yellow-600">Queued for upload...</span>
                  </div>
                ) : (
                  <div>
                    <div className="text-gray-400 mb-2">
                      <svg className="mx-auto h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div className="text-sm text-gray-600">
                      Click to upload
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      PNG, JPG, JPEG (max 10MB)
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>
        )}
      </div>
    )
  }

  if (loading || isLoading || checkingSubmissionStatus) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading form...</div>
        </div>
      </div>
    )
  }

  // Show success message if user already submitted this week (date-based check)
  // Skip this check in dev mode to allow testing
  if (alreadySubmittedThisWeek && !devMode) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        {/* Developer Mode Toggle (visible only for Test accounts) */}
        {isTestAccount && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">🛠️ Developer Mode</h3>
                <p className="text-sm text-gray-600">
                  {devMode ? "Manual week selection enabled" : "Enable this mode only if you cannot submit your Monday check-in due to system issues. This is a temporary feature to ensure access during any technical difficulties."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDevMode(!devMode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  devMode 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {devMode ? '✅ Dev Mode ON' : '⚪ Dev Mode OFF'}
              </button>
            </div>
            
            {/* Week Selection in Dev Mode */}
            {devMode && (
              <div className="mt-4 p-3 bg-yellow-100 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Week for Testing:
                </label>
                <select
                  value={devWeek}
                  onChange={(e) => setDevWeek(Number(e.target.value))}
                  className="p-2 border border-gray-300 rounded text-gray-900"
                >
                  {[...Array(40)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Week {i + 1}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-yellow-700 mt-2">
                  ⚠️ Testing mode - You can submit forms for any week
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        <div className="text-center py-8">
          <div className="mb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ✅ Your information has been submitted to Dr. Nick
          </h2>
          <p className="text-gray-600 mb-4">
            You've already submitted your weekly check-in. Updates have been made to your dashboard - check out your progress!
          </p>
          <div className="text-sm text-gray-500 mb-6">
            You cannot submit again until the next Monday.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  // Show success message if submission was successful
  if (isSubmissionSuccessful) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        {/* Developer Mode Toggle (visible only for Test accounts) */}
        {isTestAccount && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">🛠️ Developer Mode</h3>
                <p className="text-sm text-gray-600">
                  {devMode ? "Manual week selection enabled" : "Enable this mode only if you cannot submit your Monday check-in due to system issues. This is a temporary feature to ensure access during any technical difficulties."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDevMode(!devMode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  devMode 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {devMode ? '✅ Dev Mode ON' : '⚪ Dev Mode OFF'}
              </button>
            </div>
            
            {/* Week Selection in Dev Mode */}
            {devMode && (
              <div className="mt-4 p-3 bg-yellow-100 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Week for Testing:
                </label>
                <select
                  value={devWeek}
                  onChange={(e) => setDevWeek(Number(e.target.value))}
                  className="p-2 border border-gray-300 rounded text-gray-900"
                >
                  {[...Array(40)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Week {i + 1}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-yellow-700 mt-2">
                  ⚠️ Testing mode - You can submit forms for any week
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        <div className="text-center py-8">
          <div className="mb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ✅ Your information has been submitted to Dr. Nick
          </h2>
          <p className="text-gray-600 mb-4">
            Updates have been made to your dashboard - check out your progress!
          </p>
          <div className="text-sm text-gray-500 mb-6">
            You cannot submit again until next Monday
          </div>
          <button
            onClick={() => setIsSubmissionSuccessful(false)}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Form
          </button>
        </div>
      </div>
    )
  }

  // Show restriction message if not in valid submission window
  if (!isValidSubmissionDay(devMode)) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        {/* Developer Mode Toggle (visible only for Test accounts) */}
        {isTestAccount && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">🛠️ Developer Mode</h3>
                <p className="text-sm text-gray-600">
                  {devMode ? "Manual week selection enabled" : "Enable this mode only if you cannot submit your Monday check-in due to system issues. This is a temporary feature to ensure access during any technical difficulties."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDevMode(!devMode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  devMode 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {devMode ? '✅ Dev Mode ON' : '⚪ Dev Mode OFF'}
              </button>
            </div>
            
            {/* Week Selection in Dev Mode */}
            {devMode && (
              <div className="mt-4 p-3 bg-yellow-100 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Week for Testing:
                </label>
                <select
                  value={devWeek}
                  onChange={(e) => setDevWeek(Number(e.target.value))}
                  className="p-2 border border-gray-300 rounded text-gray-900"
                >
                  {[...Array(40)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Week {i + 1}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-yellow-700 mt-2">
                  ⚠️ Testing mode - You can submit forms for any week
                </p>
              </div>
            )}
          </div>
        )}

        {/* Restriction Message */}
        <div className="text-center py-8">
          <div className="mb-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Submissions only allowed Monday
          </h2>
          <p className="text-gray-600 mb-4">
            Please return during your monday check in window to submit your weekly check-in
          </p>

        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      
      {/* Developer Mode Toggle (visible only for Test accounts) */}
      {isTestAccount && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">🛠️ Developer Mode</h3>
              <p className="text-sm text-gray-600">
                {devMode ? "Manual week selection enabled" : "Enable this mode only if you cannot submit your Monday check-in due to system issues. This is a temporary feature to ensure access during any technical difficulties."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDevMode(!devMode)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                devMode 
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {devMode ? '✅ Dev Mode ON' : '⚪ Dev Mode OFF'}
            </button>
          </div>
          
          {/* Week Selection in Dev Mode */}
          {devMode && (
            <div className="mt-4 p-3 bg-yellow-100 rounded">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Week for Testing:
              </label>
              <select
                value={devWeek}
                onChange={(e) => setDevWeek(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded text-gray-900"
              >
                {[...Array(40)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Week {i + 1}
                  </option>
                ))}
              </select>
              <p className="text-sm text-yellow-700 mt-2">
                ⚠️ Testing mode - You can submit forms for any week
              </p>
            </div>
          )}

        </div>
      )}

      {/* Form Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
          📋 Week {devMode ? devWeek : activeWeek} Check-in
          </h2>
          <p className="text-gray-600">
          Your weekly progress update - all measurements should be numbers only
          </p>
        </div>

      {/* Success/Error Messages */}
        {message && (
          <div className={`mb-4 p-3 rounded ${
          message.includes('Error') || message.includes('fix the errors')
            ? 'bg-red-100 text-red-700 border border-red-300' 
            : 'bg-green-100 text-green-700 border border-green-300'
          }`}>
            {message}
          </div>
        )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Body Measurements */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">📊 Body Measurements</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                {`Weight (${getWeightUnitLabel(unitSystem)}) - Numbers Only `}<span className="text-red-500">*Required</span>
              </label>
              <input
                type="number"
                id="weight"
                step="0.01"
                min="0"
                required
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.weight ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="165.5"
              />
              {validationErrors.weight && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.weight}</p>
              )}
            </div>

            <div>
              <label htmlFor="waist" className="block text-sm font-medium text-gray-700 mb-1">
                {`Waist Circumference (${getLengthUnitLabel(unitSystem)}) - Numbers Only `}<span className="text-red-500">*Required</span>
              </label>
              <input
                  type="number"
                  id="waist"
                  step="0.01"
                  min="0"
                  required
                  value={formData.waist}
                  onChange={(e) => handleInputChange('waist', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.waist ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="32.5"
              />
              {validationErrors.waist && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.waist}</p>
              )}
              </div>
            </div>
          </div>

          {/* Exercise & Training */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">💪 Exercise & Training</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resistance Training - Left Half */}
            <div className="space-y-3">
              <div>
                <label htmlFor="resistance_training_days" className="block text-sm font-medium text-gray-700 mb-1">
                  Resistance Training Days (0-7) - Numbers Only <span className="text-red-500">*Required</span>
                </label>
                <input
                  type="number"
                  id="resistance_training_days"
                  min="0"
                  max="7"
                  value={formData.resistance_training_days}
                  onChange={(e) => handleInputChange('resistance_training_days', e.target.value)}
                  className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    validationErrors.resistance_training_days ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="3"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Goal: {resistanceTrainingGoal} days
                </p>
                {validationErrors.resistance_training_days && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.resistance_training_days}</p>
                )}
              </div>
            </div>

            {/* Purposeful Exercise - Right Half */}
            <div className="space-y-3">
              <div>
                <label htmlFor="purposeful_exercise_days" className="block text-sm font-medium text-gray-700 mb-1">
                  Days Strain Goal Met (0-7) - Numbers Only <span className="text-red-500">*Required</span>
                </label>
                <input
                  type="number"
                  id="purposeful_exercise_days"
                  min="0"
                  max="7"
                  required
                  value={formData.purposeful_exercise_days}
                  onChange={(e) => handleInputChange('purposeful_exercise_days', e.target.value)}
                  className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    validationErrors.purposeful_exercise_days ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="3"
                />
                {validationErrors.purposeful_exercise_days && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.purposeful_exercise_days}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Dr. Nick will define what this means for you. Please reach out if you need clarification on your specific exercise plan.
                </p>
              </div>
            </div>
          </div>
        </div>

          {/* Recovery & Nutrition */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">😴 Recovery & Nutrition</h3>
              
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label htmlFor="symptom_tracking_days" className="block text-sm font-medium text-gray-700 mb-1">
                Days of hunger/newfound mood disturbances, impaired focus, constipation, prolonged muscle soreness, menstrual irregularity, fatigue over the week (0-7) - Numbers Only <span className="text-red-500">*Required</span>
                </label>
              <input
                type="number"
                id="symptom_tracking_days"
                min="0"
                max="7"
                value={formData.symptom_tracking_days}
                onChange={(e) => handleInputChange('symptom_tracking_days', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.symptom_tracking_days ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="2"
                required
              />
              {validationErrors.symptom_tracking_days && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.symptom_tracking_days}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Hover over the label for details on what symptoms to track
              </p>
              </div>

              <div>
                <label htmlFor="poor_recovery_days" className="block text-sm font-medium text-gray-700 mb-1">
                Days with Poor Recovery (0-7) - Numbers Only <span className="text-red-500">*Required</span>
                </label>
              <input
                type="number"
                  id="poor_recovery_days"
                min="0"
                max="7"
                required
                  value={formData.poor_recovery_days}
                  onChange={(e) => handleInputChange('poor_recovery_days', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.poor_recovery_days ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="1"
              />
              {validationErrors.poor_recovery_days && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.poor_recovery_days}</p>
              )}
            </div>
          </div>

          {/* Detailed Symptom Notes - Full width below the two fields */}
          <div>
            <label htmlFor="detailed_symptom_notes" className="block text-sm font-medium text-gray-700 mb-1">
              Detailed Symptoms Notes <span className="text-gray-500">(Only fill this in if any days of hunger/newfound mood disturbances, etc...are endorsed)</span>
            </label>
            <textarea
              id="detailed_symptom_notes"
              rows={3}
              value={formData.detailed_symptom_notes}
              onChange={(e) => handleInputChange('detailed_symptom_notes', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Please provide additional details about any symptoms you experienced this week..."
            />
          </div>
        </div>

        {/* Energetic Constraints Question */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">⚡ Energetic Constraints</h3>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="energetic_constraints_reduction_ok"
                checked={formData.energetic_constraints_reduction_ok}
                onChange={(e) => handleInputChange('energetic_constraints_reduction_ok', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="energetic_constraints_reduction_ok" className="text-sm text-gray-700">
                <span className="font-medium">
                  Are you okay with me reducing your energetic constraints?
                </span>
                <span className="text-gray-500 block mt-1">
                  (which I'll consider depending on other check in metrics)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Self Reflection - Moved above Lumen Screenshots */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">🧠 Self Reflection</h3>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Self Reflection Of Your Choices/Behaviors Over The Last Week <span className="text-red-500">*Required</span>
            </label>
            <textarea
              id="notes"
              rows={4}
              required
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className={`w-full p-3 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                validationErrors.notes ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Reflect on your food choices, exercise habits, sleep patterns, stress levels, and any behaviors that impacted your progress this week..."
            />
            {validationErrors.notes && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.notes}</p>
            )}
          </div>
        </div>

        {/* Lumen Screenshots - Required */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
              📸 Lumen Screenshots <span className="text-red-500">*Required</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Upload your daily Lumen device screenshots for each day of the week
            </p>
            {/* Upload Instructions */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="text-blue-500 mt-0.5">💡</div>
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Upload Tips:</p>
                  <ul className="text-xs space-y-1">
                    <li>• You can upload multiple images quickly - they'll be processed automatically one at a time</li>
                    <li>• Images will show "In Queue" then "Uploading" then "✓ Uploaded" when complete</li>
                    <li>• Green border = uploaded successfully, Blue border = processing</li>
                    <li>• Max 10MB per image (PNG, JPG, JPEG supported)</li>
                  </ul>
                </div>
              </div>
            </div>
            {/* Queue Status */}
            {(uploadQueue.length > 0 || isProcessingQueue) && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600"></div>
                  <span className="text-sm text-yellow-700">
                    {uploadQueue.length > 0 
                      ? `${uploadQueue.length} image${uploadQueue.length > 1 ? 's' : ''} in upload queue...`
                      : 'Processing uploads...'
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dayNames.map((dayName, index) => (
              <ImageUploadSlot
                key={`lumen-${index + 1}`}
                imageType="lumen"
                dayNumber={index + 1}
                dayName={dayName}
              />
            ))}
          </div>
        </div>

        {/* Food Log Screenshots - Optional */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
              🍽️ Food Log Screenshots <span className="text-gray-500">Optional</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Upload additional food log screenshots if there are any discrepancies with your Lumen data
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dayNames.map((dayName, index) => (
              <ImageUploadSlot
                key={`food-log-${index + 1}`}
                imageType="food_log"
                dayNumber={index + 1}
                dayName={dayName}
              />
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
          type="submit"
          disabled={isSubmitting || isUploadingImages || Object.values(uploadingStates).some(Boolean)}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 font-medium"
        >
          {Object.values(uploadingStates).some(Boolean)
            ? '📤 Uploading Images...' 
            : isSubmitting 
            ? '💾 Saving Data...' 
            : `Submit Week ${devMode ? devWeek : activeWeek} Check-in`
            }
          </button>
      
        {/* Progress indicator */}
        {(isSubmitting || Object.values(uploadingStates).some(Boolean)) && (
          <div className="mt-3 text-center text-sm text-gray-600">
            {Object.values(uploadingStates).some(Boolean) && (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Uploading images...</span>
              </div>
            )}
            {isSubmitting && !Object.values(uploadingStates).some(Boolean) && (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Saving check-in data...</span>
              </div>
            )}
        </div>
        )}
      </div>
    </form>

    {/* Image Viewer Modal */}
    {viewingImage && (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden">
          {/* Modal Header */}
          <div className="bg-gray-100 px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">{viewingImage.title}</h3>
            <button
              onClick={() => setViewingImage(null)}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              title="Close"
            >
              ×
          </button>
        </div>

          {/* Modal Body */}
          <div className="p-4">
            <img
              src={viewingImage.url}
              alt={viewingImage.title}
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
      </div>

          {/* Modal Footer */}
          <div className="bg-gray-100 px-4 py-3 border-t flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Click outside or press × to close
            </div>
            <button
              onClick={() => setViewingImage(null)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
      </div>

        {/* Click outside to close */}
        <div 
          className="absolute inset-0 -z-10"
          onClick={() => setViewingImage(null)}
        ></div>
    </div>
    )}
  </div>
)
}