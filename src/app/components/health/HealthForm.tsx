// src/app/components/health/HealthForm.tsx
// Weekly health check-in form with smart week detection, developer mode, and individual image uploads

'use client'

import { useState, useEffect, useCallback } from 'react'
import { saveWeeklyCheckin, getCheckinForWeek, type CheckinFormData } from './healthService'
import { supabase } from '../auth/AuthContext'
import { uploadSingleImage, deleteImageByUrl, getSignedImageUrl } from './imageService'

// Extended CheckinFormData interface to include notes
interface ExtendedCheckinFormData extends CheckinFormData {
  notes?: string
}

// Smart week calculation based on existing submissions and grace period
const calculateCurrentWeek = async (userId: string): Promise<number> => {
  try {
    const { data: submissions, error } = await supabase
      .from('health_data')
      .select('week_number')
      .eq('user_id', userId)
      .order('week_number', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error fetching submissions:', error)
      return 1
    }

    if (!submissions || submissions.length === 0) {
      return 1 // First submission
    }

    const lastWeek = submissions[0].week_number
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Grace period: Allow submitting current week until Wednesday (day 3)
    // After Wednesday, move to next week
    if (dayOfWeek >= 3) {
      return lastWeek + 1
    } else {
      // Before Wednesday - can still submit for current week
      return lastWeek
    }
  } catch (error) {
    console.error('Error calculating current week:', error)
    return 1
  }
}

// Day names for labeling
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function HealthForm() {
  // Form state
  const [formData, setFormData] = useState<ExtendedCheckinFormData>({
    date: new Date().toISOString().split('T')[0],
    week_number: '1',
    weight: '',
    waist: '',
    resistance_training_days: '',
    focal_heart_rate_training: '',
    hunger_days: '',
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
      setActiveWeek(calculatedWeek)
      setDevWeek(calculatedWeek)
      
      // Load existing form data if available
      await loadExistingFormData(user.id, calculatedWeek)
      
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
          focal_heart_rate_training: existingData.focal_heart_rate_training || '',
          hunger_days: existingData.hunger_days?.toString() || '',
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
    
    // Weight validation
    if (formData.weight && (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0)) {
      errors.weight = 'Weight must be a positive number'
    }
    
    // Waist validation
    if (formData.waist && (isNaN(Number(formData.waist)) || Number(formData.waist) <= 0)) {
      errors.waist = 'Waist measurement must be a positive number'
    }
    
    // Resistance training days validation
    if (formData.resistance_training_days && 
        (isNaN(Number(formData.resistance_training_days)) || 
         Number(formData.resistance_training_days) < 0 || 
         Number(formData.resistance_training_days) > 7)) {
      errors.resistance_training_days = 'Resistance training days must be between 0 and 7'
    }
    
    // Focal heart rate training validation
    if (formData.focal_heart_rate_training && 
        (isNaN(Number(formData.focal_heart_rate_training)) || 
         Number(formData.focal_heart_rate_training) < 0)) {
      errors.focal_heart_rate_training = 'Focal heart rate training must be a positive number'
    }
    
    // Hunger days validation
    if (formData.hunger_days && 
        (isNaN(Number(formData.hunger_days)) || 
         Number(formData.hunger_days) < 0 || 
         Number(formData.hunger_days) > 7)) {
      errors.hunger_days = 'Hunger days must be between 0 and 7'
    }
    
    // Poor recovery days validation
    if (formData.poor_recovery_days && 
        (isNaN(Number(formData.poor_recovery_days)) || 
         Number(formData.poor_recovery_days) < 0 || 
         Number(formData.poor_recovery_days) > 7)) {
      errors.poor_recovery_days = 'Poor recovery days must be between 0 and 7'
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

      // Use dev week if in dev mode, otherwise use calculated week
      const weekToSubmit = devMode ? devWeek : activeWeek

      // Check if user is trying to submit for a future week (unless in dev mode)
      if (!devMode && weekToSubmit > activeWeek) {
        setMessage(`Cannot submit for Week ${weekToSubmit}. Current week is ${activeWeek}.`)
        return
      }

      // Update form data with correct week number
      const submissionData = {
        ...formData,
        week_number: weekToSubmit.toString()
      }

      const result = await saveWeeklyCheckin(submissionData)
      
      if (result.data) {
        setMessage(`✅ Week ${weekToSubmit} check-in submitted successfully!`)
        
        // If not in dev mode, recalculate the current week
        if (!devMode) {
          const newCurrentWeek = await calculateCurrentWeek(user.id)
          setActiveWeek(newCurrentWeek)
          setDevWeek(newCurrentWeek)
          
          // Load data for the new current week if it exists
          await loadExistingFormData(user.id, newCurrentWeek)
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

  if (loading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading form...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      
      {/* Developer Mode Toggle */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">🛠️ Developer Mode</h3>
            <p className="text-sm text-gray-600">
              {devMode ? "Manual week selection enabled" : "Smart week calculation active"}
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
              {[...Array(20)].map((_, i) => (
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
        
        {/* Current Week Display */}
        <div className="mt-4 p-3 bg-blue-50 rounded">
          <p className="text-sm">
            <strong>Current Week:</strong> {devMode ? devWeek : activeWeek}
          </p>
          {!devMode && (
            <p className="text-xs text-gray-500 mt-1">
              💡 Smart calculation based on your submission history with 3-day grace period
            </p>
          )}
        </div>
      </div>

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
                Weight (lbs) - Numbers Only
              </label>
              <input
                type="number"
                id="weight"
                step="0.1"
                min="0"
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
                Waist Circumference (inches) - Numbers Only
              </label>
              <input
                  type="number"
                  id="waist"
                  step="0.1"
                  min="0"
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
              
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="resistance_training_days" className="block text-sm font-medium text-gray-700 mb-1">
                Resistance Training Days (0-7) - Numbers Only
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
              />
              {validationErrors.resistance_training_days && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.resistance_training_days}</p>
              )}
              </div>

              <div>
                <label htmlFor="focal_heart_rate_training" className="block text-sm font-medium text-gray-700 mb-1">
                Focal Heart Rate Training (minutes) - Numbers Only
                </label>
                <input
                type="number"
                  id="focal_heart_rate_training"
                min="0"
                  value={formData.focal_heart_rate_training}
                  onChange={(e) => handleInputChange('focal_heart_rate_training', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.focal_heart_rate_training ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="45"
              />
              {validationErrors.focal_heart_rate_training && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.focal_heart_rate_training}</p>
              )}
                <p className="text-xs text-gray-500 mt-1">
                Total minutes of heart rate training this week
                </p>
              </div>
            </div>
          </div>

          {/* Recovery & Nutrition */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">😴 Recovery & Nutrition</h3>
              
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="hunger_days" className="block text-sm font-medium text-gray-700 mb-1">
                Days with Excessive Hunger (0-7) - Numbers Only
                </label>
              <input
                type="number"
                  id="hunger_days"
                min="0"
                max="7"
                  value={formData.hunger_days}
                  onChange={(e) => handleInputChange('hunger_days', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.hunger_days ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="2"
              />
              {validationErrors.hunger_days && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.hunger_days}</p>
              )}
              </div>

              <div>
                <label htmlFor="poor_recovery_days" className="block text-sm font-medium text-gray-700 mb-1">
                Days with Poor Recovery (0-7) - Numbers Only
                </label>
              <input
                type="number"
                  id="poor_recovery_days"
                min="0"
                max="7"
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
              Self Reflection Of Your Choices/Behaviors Over The Last Week
            </label>
            <textarea
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Reflect on your food choices, exercise habits, sleep patterns, stress levels, and any behaviors that impacted your progress this week..."
            />
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