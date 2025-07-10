'use client'

import { useState, useEffect } from 'react'
import { 
  markSubmissionAsReviewed, 
  updateDrNickAnalysis,
  getWeeklyDataForCharts 
} from './healthService'
import { getSignedImageUrl } from './imageService'
import { supabase } from '../auth/AuthContext'
import ChartsDashboard from './ChartsDashboard'
import { QueueSubmission } from './DrNickQueue'

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
  // State management
  const [submissionChartData, setSubmissionChartData] = useState<any[]>([])
  const [signedUrls, setSignedUrls] = useState<{[key: string]: string}>({})
  const [viewingImage, setViewingImage] = useState<{url: string, title: string} | null>(null)
  
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
  
  // Nutrition compliance days state
  const [nutritionComplianceDays, setNutritionComplianceDays] = useState('0')
  
  // Sleep consistency score state
  const [sleepScore, setSleepScore] = useState('0')
  
  // Stored PDF states (downloaded by N8N from Whoop links)
  const [weeklyStoredPdf, setWeeklyStoredPdf] = useState<string | null>(submission.weekly_whoop_pdf || null)
  const [monthlyStoredPdf, setMonthlyStoredPdf] = useState<string | null>(submission.monthly_whoop_pdf || null)
  
  // Start Message state (placeholder for future dynamic message system)
  const [startMessage, setStartMessage] = useState('')
  
  // N8N Processing states
  const [weeklyProcessing, setWeeklyProcessing] = useState(false)
  const [monthlyProcessing, setMonthlyProcessing] = useState(false)
  
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
      'food_log_day4_image', 'food_log_day5_image', 'food_log_day6_image', 'food_log_day7_image'
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

  // Send Whoop link to N8N for processing
  const handleSendToN8N = async (type: 'weekly' | 'monthly') => {
    const whoopUrl = type === 'weekly' ? weeklyPdfUrl : monthlyPdfUrl
    
    if (!whoopUrl.trim()) {
      alert(`Please enter a ${type} Whoop link first`)
      return
    }

    // Save the Whoop URL to database immediately
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

    // Set processing state
    if (type === 'weekly') {
      setWeeklyProcessing(true)
    } else {
      setMonthlyProcessing(true)
    }

    try {
      // Your N8N webhook URL - REPLACE WITH YOUR ACTUAL WEBHOOK URL
      const webhookUrl = 'https://n8n.srv745688.hstgr.cloud/webhook/e21836ca-8d7c-4fef-b844-fc25070e97de'
      
      // Simple payload - just the essentials, N8N will query Supabase for the rest
      const payload = {
        submission_id: submission.id,
        type: type  // "weekly" or "monthly"
      }

      console.log('🚀 Sending webhook to N8N:', webhookUrl)
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
        alert(`${type} analysis sent to N8N for processing. This may take 30-60 seconds...`)
        // Note: Processing state will be cleared when we detect the analysis is complete
      } else {
        const errorText = await response.text()
        console.error('❌ N8N Error Response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }
    } catch (error) {
      console.error('🚨 N8N webhook error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      let errorMessage = 'Unknown error occurred'
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error - unable to reach N8N server. Check console for details.'
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      alert(`Failed to send ${type} analysis to N8N: ${errorMessage}`)
      
      // Reset processing state on error
      if (type === 'weekly') {
        setWeeklyProcessing(false)
      } else {
        setMonthlyProcessing(false)
      }
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
        .select('weight_change_goal_percent')
        .eq('id', submission.user_id)
        .single()
      
      if (error) {
        console.error('Error loading weight change goal:', error)
        return
      }
      
      setWeightChangeGoal(data.weight_change_goal_percent || '1.00')
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

  // Load current nutrition compliance days and weight change goal
  const loadSubmissionData = async () => {
    try {
      // Load weight change goal
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('weight_change_goal_percent')
        .eq('id', submission.user_id)
        .single()
      
      if (profileError) {
        console.error('Error loading profile data:', profileError)
      } else {
        setWeightChangeGoal(profileData.weight_change_goal_percent || '1.00')
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

  // Initialize component
  useEffect(() => {
    const initializeReview = async () => {
      setLoading(true)
      
      // Load chart data for the patient
      await loadSubmissionChartData(submission.user_id)
      
      // Generate signed URLs for images and PDFs
      await generateSignedUrls(submission)
      
      // Load weight change goal
      await loadWeightChangeGoal()
      
      // Load current nutrition compliance days and weight change goal
      await loadSubmissionData()
      
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
          setWeeklyProcessing(false)
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
          setMonthlyProcessing(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading review data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      
      {/* 1. Patient Submission Overview - Full Width */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Patient Submission Data - Week {submission.week_number}
        </h3>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-6 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-blue-700">Weight</label>
            <div className="text-2xl font-bold text-blue-900">{submission.weight || 'N/A'} lbs</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-green-700">Waist</label>
            <div className="text-2xl font-bold text-green-900">{submission.waist || 'N/A'} inches</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-purple-700">Days Purposeful Exercise</label>
            <div className="text-2xl font-bold text-purple-900">{submission.purposeful_exercise_days || 'N/A'}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-red-700">Days of Hunger</label>
            <div className="text-2xl font-bold text-red-900">{submission.symptom_tracking_days || 'N/A'}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-yellow-700">Poor Recovery Days</label>
            <div className="text-2xl font-bold text-yellow-900">{submission.poor_recovery_days || 'N/A'}</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-indigo-700">Sleep Score</label>
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
              <button
                onClick={handleSleepScoreUpdate}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition-colors"
                title="Update sleep consistency score"
              >
                Update
              </button>
            </div>
          </div>
          <div className="bg-pink-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-pink-700">Weight Goal %</label>
            <div className="flex items-center space-x-2">
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
                className="px-3 py-1 bg-pink-600 text-white rounded text-sm hover:bg-pink-700 transition-colors"
                title="Update weight change goal"
              >
                Update
              </button>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-orange-700">Nutrition Days</label>
            <div className="flex items-center space-x-2">
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
                className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                title="Update nutrition compliance days"
              >
                Update
              </button>
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
                      onClick={() => setViewingImage({
                        url: displayUrl,
                        title: `${day} Lumen Screenshot - Week ${submission.week_number}`
                      })}
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                      No Image
                    </div>
                  )}
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
                      onClick={() => setViewingImage({
                        url: displayUrl,
                        title: `${day} Food Log Screenshot - Week ${submission.week_number}`
                      })}
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                      No Image
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>


      </div>

      {/* 3. Monday Morning Start Message - Full Width (Placeholder) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-xl font-semibold text-gray-900 mb-6">📞 Monday Morning Start Message</h4>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">i</span>
                </div>
              </div>
              <div className="ml-3">
                <h5 className="text-sm font-medium text-blue-800">Future Feature - Dynamic Message System</h5>
                <div className="mt-1 text-sm text-blue-700">
                  <p>This section will automatically populate with patient-specific data including:</p>
                  <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
                    <li>Current plateau prevention metrics and loss percentages</li>
                    <li>Macronutrient compliance rates and protein goal tracking</li>
                    <li>Historical trend analysis and two-week averages</li>
                    <li>Personalized recommendations based on chart data</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Message Content
              <span className="text-xs text-gray-500 ml-2">(Currently manual - will be auto-populated in future)</span>
            </label>
            <textarea
              value={startMessage}
              onChange={(e) => setStartMessage(e.target.value)}
              rows={12}
              className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-900"
              placeholder="This will be the first message sent to the client on Monday morning, before the weekly and monthly analyses. Future implementation will auto-populate with dynamic patient data from charts and historical records.

Example template variables to be implemented:
- {{patientfirstname}} - Patient's first name
- {{currentlossrate}} - Current percentage loss rate
- {{proteingoal}} - Daily protein target
- {{compliancerate}} - Weekly macronutrient compliance
- {{waistloss}} - Total waist circumference change
- {{weeklytrend}} - Two-week average progress

For now, enter the message content manually..."
            />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h6 className="text-sm font-medium text-gray-700 mb-2">Message Flow Sequence:</h6>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">1. Start Message</span>
              <span className="text-gray-400">→</span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-medium">2. Weekly Analysis</span>
              <span className="text-gray-400">→</span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">3. Monday Analysis</span>
            </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    {weeklyProcessing ? 'Processing...' : 'Send to N8N'}
                  </button>
                  
                  {/* Status indicator */}
                  {weeklyProcessing && (
                    <div className="flex items-center text-purple-600">
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm">Processing...</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weekly Whoop PDF Upload
              </label>
              
              {/* Show stored PDF from N8N if available */}
              {weeklyStoredPdf && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    PDF Downloaded & Stored by N8N
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
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePdfUpload(file, 'weekly')
                  }}
                  disabled={weeklyPdfUploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weekly Analysis Notes
              </label>
              <textarea
                value={weeklyAnalysis}
                onChange={(e) => setWeeklyAnalysis(e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Enter your weekly analysis for this client..."
              />
            </div>
          </div>

          {/* Monthly Analysis Section */}
          <div className="space-y-4">
            <h5 className="text-lg font-medium text-gray-800 mb-4 border-b pb-2">Monthly Analysis</h5>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    {monthlyProcessing ? 'Processing...' : 'Send to N8N'}
                  </button>
                  
                  {/* Status indicator */}
                  {monthlyProcessing && (
                    <div className="flex items-center text-purple-600">
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm">Processing...</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Whoop PDF Upload
              </label>
              
              {/* Show stored PDF from N8N if available */}
              {monthlyStoredPdf && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    PDF Downloaded & Stored by N8N
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
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePdfUpload(file, 'monthly')
                  }}
                  disabled={monthlyPdfUploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Analysis Notes
              </label>
              <textarea
                value={monthlyAnalysis}
                onChange={(e) => setMonthlyAnalysis(e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Enter your monthly analysis for this client (if applicable)..."
              />
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

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl max-h-full bg-white rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">{viewingImage.title}</h3>
              <button
                onClick={() => setViewingImage(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="max-w-full max-h-[85vh] object-contain mx-auto"
              />
            </div>
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
    </div>
  )
} 