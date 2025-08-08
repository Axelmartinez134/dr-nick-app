'use client'

import { useState, useEffect } from 'react'
import { 
  getSubmissionsNeedingReview, 
  markSubmissionAsReviewed, 
  updateDrNickAnalysis,
  getSubmissionDetails,
  getWeeklyDataForCharts 
} from './healthService'
import { uploadSingleImage, getSignedImageUrl } from './imageService'
import { supabase } from '../auth/AuthContext'
import ChartsDashboard from './ChartsDashboard'

export interface QueueSubmission {
  id: string
  user_id: string
  date: string
  week_number: number
  weight: number | null
  waist: number | null
  resistance_training_days: number | null
  symptom_tracking_days: number | null
  detailed_symptom_notes: string | null
  purposeful_exercise_days: number | null
  poor_recovery_days: number | null
  sleep_consistency_score: number | null
  energetic_constraints_reduction_ok: boolean | null
  nutrition_compliance_days: number | null
  notes: string | null
  created_at: string
  // Image fields
  lumen_day1_image: string | null
  lumen_day2_image: string | null
  lumen_day3_image: string | null
  lumen_day4_image: string | null
  lumen_day5_image: string | null
  lumen_day6_image: string | null
  lumen_day7_image: string | null
  food_log_day1_image: string | null
  food_log_day2_image: string | null
  food_log_day3_image: string | null
  food_log_day4_image: string | null
  food_log_day5_image: string | null
  food_log_day6_image: string | null
  food_log_day7_image: string | null
  // Analysis fields
  weekly_whoop_pdf_url: string | null
  weekly_whoop_analysis: string | null
  weekly_ai_analysis: string | null
  weekly_whoop_pdf: string | null
  monthly_whoop_pdf_url: string | null
  monthly_whoop_analysis: string | null
  monthly_ai_analysis: string | null
  monthly_whoop_pdf: string | null
  // Grok analysis field
  grok_analysis_response: string | null
  // Monday message field
  monday_message_content: string | null
  // User info
  profiles: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
  }
  // System metadata
  data_entered_by?: string | null
}

// NEW: Props interface for DrNickQueue
interface DrNickQueueProps {
  onSubmissionSelect?: (submission: QueueSubmission) => void
}

export default function DrNickQueue({ onSubmissionSelect }: DrNickQueueProps) {
  const [queueSubmissions, setQueueSubmissions] = useState<QueueSubmission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<QueueSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submissionChartData, setSubmissionChartData] = useState<any[]>([])
  
  // Analysis form state
  const [weeklyAnalysis, setWeeklyAnalysis] = useState('')
  const [monthlyAnalysis, setMonthlyAnalysis] = useState('')
  const [weeklyPdfUploading, setWeeklyPdfUploading] = useState(false)
  const [monthlyPdfUploading, setMonthlyPdfUploading] = useState(false)
  const [weeklyPdfUrl, setWeeklyPdfUrl] = useState('')
  const [monthlyPdfUrl, setMonthlyPdfUrl] = useState('')
  
  // Image viewer
  const [viewingImage, setViewingImage] = useState<{url: string, title: string} | null>(null)
  const [signedUrls, setSignedUrls] = useState<{[key: string]: string}>({})

  // Load queue submissions
  const loadQueueSubmissions = async () => {
    try {
      setLoading(true)
      const { data, error } = await getSubmissionsNeedingReview()
      
      if (error) {
        setError(typeof error === 'string' ? error : (error as any)?.message || 'Failed to load submissions')
        return
      }
      
      setQueueSubmissions(data || [])
    } catch (err) {
      setError('Failed to load queue submissions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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

  // Generate signed URLs for images
  const generateSignedUrls = async (submission: QueueSubmission) => {
    const imageFields = [
      'lumen_day1_image', 'lumen_day2_image', 'lumen_day3_image', 'lumen_day4_image',
      'lumen_day5_image', 'lumen_day6_image', 'lumen_day7_image',
      'food_log_day1_image', 'food_log_day2_image', 'food_log_day3_image',
      'food_log_day4_image', 'food_log_day5_image', 'food_log_day6_image', 'food_log_day7_image'
    ]

    const newSignedUrls: {[key: string]: string} = {}
    
    for (const field of imageFields) {
      const imageUrl = submission[field as keyof QueueSubmission] as string
      if (imageUrl) {
        try {
          const signedUrl = await getSignedImageUrl(imageUrl)
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

  // Select submission for review
  const selectSubmission = async (submission: QueueSubmission) => {
    // NEW: If onSubmissionSelect prop is provided, use it (list-only mode)
    if (onSubmissionSelect) {
      onSubmissionSelect(submission)
      return
    }

    // Original behavior: side-by-side mode
    setSelectedSubmission(submission)
    setWeeklyAnalysis(submission.weekly_whoop_analysis || '')
    setMonthlyAnalysis(submission.monthly_whoop_analysis || '')
    setWeeklyPdfUrl(submission.weekly_whoop_pdf_url || '')
    setMonthlyPdfUrl(submission.monthly_whoop_pdf_url || '')
    
    // Load chart data and signed URLs
    await Promise.all([
      loadSubmissionChartData(submission.user_id),
      generateSignedUrls(submission)
    ])
  }

  // Handle PDF upload
  const handlePdfUpload = async (file: File, type: 'weekly' | 'monthly') => {
    try {
      if (type === 'weekly') {
        setWeeklyPdfUploading(true)
      } else {
        setMonthlyPdfUploading(true)
      }

      // For PDF uploads, we'll use a different approach since uploadSingleImage is for images
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

  // Save analysis and mark as reviewed
  const handleCompleteReview = async () => {
    if (!selectedSubmission) return

    try {
      // Update analysis
      const analysisData = {
        weekly_whoop_pdf_url: weeklyPdfUrl || undefined,
        weekly_whoop_analysis: weeklyAnalysis || undefined,
        monthly_whoop_pdf_url: monthlyPdfUrl || undefined,
        monthly_whoop_analysis: monthlyAnalysis || undefined,
      }

      const { error: updateError } = await updateDrNickAnalysis(selectedSubmission.id, analysisData)
      if (updateError) {
        alert('Failed to save analysis')
        return
      }

      // Mark as reviewed
      const { error: reviewError } = await markSubmissionAsReviewed(selectedSubmission.id)
      if (reviewError) {
        alert('Failed to mark as reviewed')
        return
      }

      // Refresh queue and close submission
      await loadQueueSubmissions()
      setSelectedSubmission(null)
      setSubmissionChartData([])
      setSignedUrls({})
      
      alert('Review completed successfully!')
    } catch (error) {
      console.error('Error completing review:', error)
      alert('Failed to complete review')
    }
  }

  useEffect(() => {
    loadQueueSubmissions()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading queue submissions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
        <button 
          onClick={loadQueueSubmissions}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Review Queue</h2>
        <button 
          onClick={loadQueueSubmissions}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Queue
        </button>
      </div>

      {queueSubmissions.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="text-green-800 text-lg">🎉 All caught up!</div>
          <div className="text-green-600 mt-2">No submissions pending review.</div>
        </div>
      ) : (
        <div className={onSubmissionSelect ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
          {/* Queue List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Pending Reviews ({queueSubmissions.length})
            </h3>
            
            <div className="space-y-3">
              {queueSubmissions.map((submission) => (
                <div 
                  key={submission.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSubmission?.id === submission.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  } ${ (submission.data_entered_by === 'system' || (submission.notes || '').startsWith('AUTO-CREATED')) ? 'border-l-4 border-l-indigo-500' : ''}`}
                  onClick={() => selectSubmission(submission)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {submission.profiles.first_name} {submission.profiles.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {submission.profiles.email}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Week {submission.week_number} • {new Date(submission.created_at).toLocaleDateString()} at {new Date(submission.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        {(submission.data_entered_by === 'system' || (submission.notes || '').startsWith('AUTO-CREATED')) && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                            MISSED CHECK-IN (SYSTEM) — Week {submission.week_number}
                          </span>
                        )}
                        {submission.energetic_constraints_reduction_ok && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ⚡ Constraints OK
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${onSubmissionSelect ? 'text-green-600' : 'text-blue-600'}`}>
                        {onSubmissionSelect ? '🔍 Open Full Review' : 'Click to Review'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Submission Review - Only show in side-by-side mode */}
          {!onSubmissionSelect && selectedSubmission && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Reviewing: {selectedSubmission.profiles.first_name} {selectedSubmission.profiles.last_name} - Week {selectedSubmission.week_number}
                </h3>

                {/* Client Submission Data */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight</label>
                    <div className="text-lg font-semibold">{selectedSubmission.weight || 'N/A'} lbs</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Waist</label>
                    <div className="text-lg font-semibold">{selectedSubmission.waist || 'N/A'} inches</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Days Purposeful Exercise</label>
                    <div className="text-lg font-semibold">{selectedSubmission.purposeful_exercise_days || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Days of Hunger</label>
                    <div className="text-lg font-semibold">{selectedSubmission.symptom_tracking_days || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Poor Recovery Days</label>
                    <div className="text-lg font-semibold">{selectedSubmission.poor_recovery_days || 'N/A'}</div>
                  </div>
                </div>

                {/* Notes */}
                {selectedSubmission.notes && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client Self-Reflection</label>
                    <div className="bg-gray-50 p-3 rounded border">
                      {selectedSubmission.notes}
                    </div>
                  </div>
                )}

                {/* Detailed Symptom Notes */}
                {selectedSubmission.detailed_symptom_notes && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Detailed Symptom Notes
                      <span className="text-xs text-gray-500 font-normal ml-2">(Related to Days of Hunger above)</span>
                    </label>
                    <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                      {selectedSubmission.detailed_symptom_notes}
                    </div>
                  </div>
                )}

                {/* Client Images */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Client Images</h4>
                  
                  {/* Lumen Images */}
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Lumen Screenshots (Required)</h5>
                    <div className="grid grid-cols-7 gap-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                        const fieldName = `lumen_day${index + 1}_image`
                        const imageUrl = selectedSubmission[fieldName as keyof QueueSubmission] as string
                        const displayUrl = signedUrls[fieldName] || imageUrl
                        
                        return (
                          <div key={day} className="text-center">
                            <div className="text-xs text-gray-600 mb-1">{day.slice(0, 3)}</div>
                            {displayUrl ? (
                              <img 
                                src={displayUrl}
                                alt={`${day} Lumen`}
                                className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => setViewingImage({
                                  url: displayUrl,
                                  title: `${day} Lumen Screenshot`
                                })}
                              />
                            ) : (
                              <div className="w-full h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">
                                No Image
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Food Log Images */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Food Log Screenshots (Optional)</h5>
                    <div className="grid grid-cols-7 gap-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                        const fieldName = `food_log_day${index + 1}_image`
                        const imageUrl = selectedSubmission[fieldName as keyof QueueSubmission] as string
                        const displayUrl = signedUrls[fieldName] || imageUrl
                        
                        return (
                          <div key={day} className="text-center">
                            <div className="text-xs text-gray-600 mb-1">{day.slice(0, 3)}</div>
                            {displayUrl ? (
                              <img 
                                src={displayUrl}
                                alt={`${day} Food Log`}
                                className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => setViewingImage({
                                  url: displayUrl,
                                  title: `${day} Food Log Screenshot`
                                })}
                              />
                            ) : (
                              <div className="w-full h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">
                                No Image
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Dr. Nick's Analysis Section */}
                <div className="border-t pt-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Your Analysis</h4>
                  
                  {/* Weekly Analysis */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Weekly Whoop PDF Upload
                      </label>
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
                        {weeklyPdfUrl && <div className="text-green-600">✓ Uploaded</div>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Weekly Analysis
                      </label>
                      <textarea
                        value={weeklyAnalysis}
                        onChange={(e) => setWeeklyAnalysis(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        placeholder="Enter your weekly analysis for this client..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monthly Whoop PDF Upload
                      </label>
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
                        {monthlyPdfUrl && <div className="text-green-600">✓ Uploaded</div>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monthly Analysis
                      </label>
                      <textarea
                        value={monthlyAnalysis}
                        onChange={(e) => setMonthlyAnalysis(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        placeholder="Enter your monthly analysis for this client (if applicable)..."
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={handleCompleteReview}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Complete Review & Remove from Queue
                    </button>
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                    >
                      Back to Queue
                    </button>
                  </div>
                </div>
              </div>

              {/* Charts Dashboard */}
              {submissionChartData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    {selectedSubmission.profiles.first_name} {selectedSubmission.profiles.last_name} - Progress Charts
                  </h4>
                  <ChartsDashboard 
                    patientId={selectedSubmission.user_id}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">{viewingImage.title}</h3>
              <button
                onClick={() => setViewingImage(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="max-w-full max-h-[80vh] object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 