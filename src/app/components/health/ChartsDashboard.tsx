// src/app/components/health/ChartsDashboard.tsx
// Main dashboard combining all 5 charts for Dr. Nick's analysis

'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { getWeeklyDataForCharts, updateHealthRecord, getHistoricalSubmissionDetails, type WeeklyCheckin } from './healthService'
import { type QueueSubmission } from './DrNickQueue'
import { getPatientMetrics, type MetricsData } from './metricsService'
import { supabase } from '../auth/AuthContext'
import { fetchUnitSystem, formatLength, formatWeight, getLengthUnitLabel, getWeightUnitLabel, UnitSystem } from './unitUtils'
import BodyFatPercentageChart from './charts/BodyFatPercentageChart'
import MorningFatBurnChart from './charts/MorningFatBurnChart'
import ComplianceMetricsTable from './ComplianceMetricsTable'
import StickyNotes from './StickyNotes'

// Patient Status Management Component
function PatientStatusManagement({ patientId, onBpTrackingChange }: { patientId?: string; onBpTrackingChange?: (enabled: boolean) => void }) {
  const [currentStatus, setCurrentStatus] = useState<string>('Current')
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [tracksBP, setTracksBP] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  // Load current Client status
  useEffect(() => {
    if (!patientId) return

    const loadPatientStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('client_status, unit_system, track_blood_pressure')
          .eq('id', patientId)
          .single()

        if (error) throw error
        setCurrentStatus(data?.client_status || 'Current')
        setUnitSystem((data?.unit_system as UnitSystem) || 'imperial')
        setTracksBP(Boolean(data?.track_blood_pressure))
      } catch (error) {
        console.error('Error loading patient status:', error)
        setCurrentStatus('Current')
      }
    }

    loadPatientStatus()
  }, [patientId])

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!patientId || newStatus === currentStatus) return

    // Optimistic update
    setCurrentStatus(newStatus)
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/update-patient-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          clientStatus: newStatus
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage(`✅ Status updated to ${newStatus}`)
        setMessageType('success')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      // Revert on error
      setCurrentStatus(currentStatus)
      setMessage(`❌ Failed to update status`)
      setMessageType('error')
      console.error('Status update error:', error)
    }

    setSaving(false)

    // Clear message after 3 seconds
    setTimeout(() => {
      setMessage('')
      setMessageType('')
    }, 3000)
  }

  const handleUnitChange = async (newUnit: UnitSystem) => {
    if (!patientId || newUnit === unitSystem) return
    setUnitSystem(newUnit)
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/update-patient-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, unitSystem: newUnit })
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setMessage(`✅ Units updated to ${newUnit === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lbs, inches)'}`)
      setMessageType('success')
    } catch (error) {
      setUnitSystem(unitSystem)
      setMessage('❌ Failed to update units')
      setMessageType('error')
      console.error('Unit update error:', error)
    }
    setSaving(false)
    setTimeout(() => {
      setMessage('')
      setMessageType('')
    }, 3000)
  }

  const handleBpTrackingChange = async (enabled: boolean) => {
    if (!patientId || enabled === tracksBP) return
    setTracksBP(enabled)
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/update-patient-bp-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, trackBloodPressure: enabled })
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setMessage(`✅ Blood pressure tracking ${enabled ? 'enabled' : 'disabled'}`)
      setMessageType('success')
      if (onBpTrackingChange) onBpTrackingChange(enabled)
    } catch (error) {
      setTracksBP(!enabled)
      setMessage('❌ Failed to update BP tracking')
      setMessageType('error')
      console.error('BP tracking update error:', error)
    }
    setSaving(false)
    setTimeout(() => {
      setMessage('')
      setMessageType('')
    }, 3000)
  }

  if (!patientId) return null

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        👤 Client Status Management
      </h3>
      
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Current Status:
          </label>
          <div className="relative">
            <select
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={saving}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 disabled:bg-gray-100"
            >
              <option value="Current">Current</option>
              <option value="Past">Past</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Test">Test</option>
            </select>
            {saving && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Measurement System:
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleUnitChange('imperial')}
              disabled={saving}
              className={`px-3 py-2 rounded border ${unitSystem === 'imperial' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              Imperial (lbs, inches)
            </button>
            <button
              type="button"
              onClick={() => handleUnitChange('metric')}
              disabled={saving}
              className={`px-3 py-2 rounded border ${unitSystem === 'metric' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              Metric (kg, cm)
            </button>
          </div>
        </div>
      </div>

      {/* Blood Pressure Tracking Toggle */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Track Blood Pressure</label>
            <p className="text-xs text-gray-500">Show BP charts and enable weekly BP inputs in reviews. You can turn this off anytime; existing BP data stays saved.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleBpTrackingChange(true)}
              disabled={saving}
              className={`px-3 py-2 rounded border ${tracksBP ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              On
            </button>
            <button
              type="button"
              onClick={() => handleBpTrackingChange(false)}
              disabled={saving}
              className={`px-3 py-2 rounded border ${!tracksBP ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              Off
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mt-3 p-2 rounded text-sm ${
          messageType === 'success' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}

// Props interface
interface ChartsDashboardProps {
  patientId?: string // Optional patient ID for Dr. Nick's use
  onSubmissionSelect?: (submission: QueueSubmission) => void // Optional handler for historical review
  selectedWeekNumber?: number // Optional week context when viewing from review queue
}

// Table Tooltip Component (adapted from ChartTooltip pattern)
function TableTooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)

  if (!content) return <>{children}</>

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      
      {isVisible && (
        <div className="absolute z-10 max-w-sm p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg top-0 left-full ml-2">
          <div className="text-gray-100">{content}</div>
          {/* Arrow pointing left */}
          <div className="absolute top-4 left-0 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-gray-900 transform -translate-x-full"></div>
        </div>
      )}
    </div>
  )
}

// Dynamic imports for charts (client-side only)
const WeightTrendChart = dynamic(() => import('./charts/WeightTrendChart'), { ssr: false })
const WaistTrendChart = dynamic(() => import('./charts/WaistTrendChart'), { ssr: false })
const WeightProjectionChart = dynamic(() => import('./charts/WeightProjectionChart'), { ssr: false })
const PlateauPreventionChart = dynamic(() => import('./charts/PlateauPreventionChart'), { ssr: false })
const SleepConsistencyChart = dynamic(() => import('./charts/SleepConsistencyChart'), { ssr: false })
const SystolicBloodPressureChart = dynamic(() => import('./charts/SystolicBloodPressureChart'), { ssr: false }) as any
const DiastolicBloodPressureChart = dynamic(() => import('./charts/DiastolicBloodPressureChart'), { ssr: false }) as any

  // Data Table Component - Different versions for Client vs Dr. Nick
function DataTable({ data, isDoctorView, onDataUpdate, patientId, onSubmissionSelect, unitSystem, tracksBP }: { 
  data: WeeklyCheckin[], 
  isDoctorView: boolean,
  onDataUpdate?: () => void,
  patientId?: string,
  onSubmissionSelect?: (submission: QueueSubmission) => void,
  unitSystem: UnitSystem,
  tracksBP: boolean
}) {
  const [editingCell, setEditingCell] = useState<{ recordId: string, field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Helper to format created_at date as M/D/YYYY without timezone conversion
  const formatCreatedAtDate = (createdAt?: string): string => {
    if (!createdAt) return '—'
    const datePart = String(createdAt).split('T')[0]
    const parts = datePart.split('-')
    if (parts.length !== 3) return '—'
    const year = Number(parts[0])
    const month = Number(parts[1])
    const day = Number(parts[2])
    if (!year || !month || !day) return '—'
    return `${month}/${day}/${year}`
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isDoctorView ? "📋 Client Check-in Data (Editable)" : "📋 Your Check-in Data"}
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No check-in data available yet</p>
          <p className="text-sm">
            {isDoctorView 
              ? "Client data will appear here after weekly check-ins are completed"
              : "Your data will appear here after completing weekly check-ins"
            }
          </p>
        </div>
      </div>
    )
  }

  // Sort data by week number for display (ascending order - Week 0 at top, new weeks added to bottom)
  const sortedData = [...data].sort((a, b) => a.week_number - b.week_number)

  // Missed check-ins count (patient view only)
  const missedCount = !isDoctorView
    ? sortedData.filter(d => d.week_number > 0 && (d as any).data_entered_by === 'system').length
    : 0

  // Handle cell editing for Dr. Nick and viewing for patients
  const handleCellClick = (recordId: string, field: string, currentValue: any) => {
    // Allow patients to view notes and detailed symptom notes, but prevent editing other fields
    if (!isDoctorView && field !== 'notes' && field !== 'detailed_symptom_notes') return
    
    setEditingCell({ recordId, field })
    setEditValue(currentValue?.toString() || '')
  }

  const handleSaveEdit = async () => {
    if (!editingCell || !onDataUpdate) return

    setSaving(true)
    try {
      const updates = { [editingCell.field]: editValue === '' ? null : editValue }
      await updateHealthRecord(editingCell.recordId, updates)
      onDataUpdate() // Refresh the data
      setEditingCell(null)
    } catch (error) {
      console.error('Error updating record:', error)
      alert('Failed to update record')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  // Handle historical submission review (for Dr. Nick only)
  const handleHistoricalReview = async (weekNumber: number) => {
    if (!isDoctorView || !patientId || !onSubmissionSelect) return
    
    try {
      const { data: historicalData, error } = await getHistoricalSubmissionDetails(patientId, weekNumber)
      
      if (error || !historicalData) {
        console.error('Error fetching historical submission:', error)
        alert('Could not load historical submission data')
        return
      }
      
      // Data is already transformed correctly by getHistoricalSubmissionDetails
      // It follows the exact same pattern as current review queue
      const submissionData: QueueSubmission = {
        id: historicalData.id || '',
        user_id: historicalData.user_id || '',
        date: historicalData.date || '',
        week_number: historicalData.week_number || 0,
        weight: historicalData.weight || null,
        waist: historicalData.waist || null,
        resistance_training_days: historicalData.resistance_training_days || null,
        symptom_tracking_days: historicalData.symptom_tracking_days || null,
        detailed_symptom_notes: historicalData.detailed_symptom_notes || null,
        purposeful_exercise_days: historicalData.purposeful_exercise_days || null,
        poor_recovery_days: historicalData.poor_recovery_days || null,
        sleep_consistency_score: historicalData.sleep_consistency_score || null,
        energetic_constraints_reduction_ok: historicalData.energetic_constraints_reduction_ok || null,
        nutrition_compliance_days: historicalData.nutrition_compliance_days || null,
        notes: historicalData.notes || null,
        created_at: historicalData.created_at || '',
        // Image fields (may not exist for imported data)
        lumen_day1_image: historicalData.lumen_day1_image || null,
        lumen_day2_image: historicalData.lumen_day2_image || null,
        lumen_day3_image: historicalData.lumen_day3_image || null,
        lumen_day4_image: historicalData.lumen_day4_image || null,
        lumen_day5_image: historicalData.lumen_day5_image || null,
        lumen_day6_image: historicalData.lumen_day6_image || null,
        lumen_day7_image: historicalData.lumen_day7_image || null,
        food_log_day1_image: historicalData.food_log_day1_image || null,
        food_log_day2_image: historicalData.food_log_day2_image || null,
        food_log_day3_image: historicalData.food_log_day3_image || null,
        food_log_day4_image: historicalData.food_log_day4_image || null,
        food_log_day5_image: historicalData.food_log_day5_image || null,
        food_log_day6_image: historicalData.food_log_day6_image || null,
        food_log_day7_image: historicalData.food_log_day7_image || null,
        // Analysis fields (important to preserve if they exist)
        weekly_whoop_pdf_url: historicalData.weekly_whoop_pdf_url || null,
        weekly_whoop_analysis: historicalData.weekly_whoop_analysis || null,
        weekly_ai_analysis: historicalData.weekly_ai_analysis || null,
        weekly_whoop_pdf: historicalData.weekly_whoop_pdf || null,
        monthly_whoop_pdf_url: historicalData.monthly_whoop_pdf_url || null,
        monthly_whoop_analysis: historicalData.monthly_whoop_analysis || null,
        monthly_ai_analysis: historicalData.monthly_ai_analysis || null,
        monthly_whoop_pdf: historicalData.monthly_whoop_pdf || null,
        // Grok analysis field (preserve if exists)
        grok_analysis_response: historicalData.grok_analysis_response || null,
        // Monday message field (preserve if exists)
        monday_message_content: historicalData.monday_message_content || null,
        // Profiles data is already correctly formatted
        profiles: historicalData.profiles
      }
      
      // Call the submission handler (same as current review queue)
      onSubmissionSelect(submissionData)
      
    } catch (error) {
      console.error('Failed to load historical submission:', error)
      alert('Failed to load historical submission data')
    }
  }

  const renderCell = (record: WeeklyCheckin, field: string, value: any, isLongText = false) => {
    const isEditing = editingCell?.recordId === record.id && editingCell?.field === field
    
    if (isEditing) {
      // For patients viewing notes - read-only expanded view
      if (!isDoctorView && (field === 'notes' || field === 'detailed_symptom_notes')) {
        return (
          <div className="flex items-start gap-1">
            <textarea
              value={value || ''}
              readOnly
              className="w-48 px-2 py-1 text-xs border rounded resize-none bg-gray-50 text-gray-900"
              rows={3}
              autoFocus
            />
            <button
              onClick={handleCancelEdit}
              className="text-gray-600 hover:text-gray-800 text-xs"
              title="Close"
            >
              ✕
            </button>
          </div>
        )
      }

      // For Dr. Nick - full edit functionality
      return (
        <div className="flex items-start gap-1">
          {isLongText ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-48 px-2 py-1 text-xs border rounded resize-none text-gray-900"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleSaveEdit()
                if (e.key === 'Escape') handleCancelEdit()
              }}
              placeholder={field === 'detailed_symptom_notes' ? "Enter detailed symptom notes..." : "Enter self-reflection notes..."}
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-20 px-2 py-1 text-xs border rounded"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit()
                if (e.key === 'Escape') handleCancelEdit()
              }}
            />
          )}
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="text-green-600 hover:text-green-800 text-xs"
            title={isLongText ? "Ctrl+Enter to save" : "Enter to save"}
          >
            ✓
          </button>
          <button
            onClick={handleCancelEdit}
            className="text-red-600 hover:text-red-800 text-xs"
          >
            ✕
          </button>
        </div>
      )
    }

    // Special handling for notes field
    if (field === 'notes') {
      if (!value) {
        const placeholder = (
          <span className="text-gray-400 italic">No reflection</span>
        )
        
        return isDoctorView ? (
          <span
            className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded block"
            onClick={() => handleCellClick(record.id!, field, value)}
            title="Click to edit"
          >
            {placeholder}
          </span>
        ) : placeholder
      }

      const truncatedText = value.length > 30 ? value.substring(0, 30) + "..." : value
      const displayElement = (
        <span className="block">
          {truncatedText}
        </span>
      )

      // Both patients and Dr. Nick can click to view
      return (
        <span
          className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded block"
          onClick={() => handleCellClick(record.id!, field, value)}
          title={isDoctorView ? "Click to edit" : "Click to view"}
        >
          {displayElement}
        </span>
      )
    }

    // Special handling for detailed_symptom_notes field
    if (field === 'detailed_symptom_notes') {
      if (!value) {
        const placeholder = (
          <span className="text-gray-400 italic">No symptoms noted</span>
        )
        
        return isDoctorView ? (
          <span
            className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded block"
            onClick={() => handleCellClick(record.id!, field, value)}
            title="Click to edit"
          >
            {placeholder}
          </span>
        ) : placeholder
      }

      const truncatedText = value.length > 30 ? value.substring(0, 30) + "..." : value
      const displayElement = (
        <span className="block">
          {truncatedText}
        </span>
      )

      // Both patients and Dr. Nick can click to view
      return (
        <span
          className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded block"
          onClick={() => handleCellClick(record.id!, field, value)}
          title={isDoctorView ? "Click to edit" : "Click to view"}
        >
          {displayElement}
        </span>
      )
    }

    // Unit-aware formatting for weight/waist
    if (field === 'weight') {
      const num = typeof value === 'number' ? value : (value ? parseFloat(String(value)) : null)
      return (
        <span
          className={isDoctorView ? "cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded" : ""}
          onClick={() => handleCellClick(record.id!, field, value)}
          title={isDoctorView ? "Click to edit" : ""}
        >
          {formatWeight(num, unitSystem)}
        </span>
      )
    }
    if (field === 'waist') {
      const num = typeof value === 'number' ? value : (value ? parseFloat(String(value)) : null)
      return (
        <span
          className={isDoctorView ? "cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded" : ""}
          onClick={() => handleCellClick(record.id!, field, value)}
          title={isDoctorView ? "Click to edit" : ""}
        >
          {formatLength(num, unitSystem)}
        </span>
      )
    }

    // Regular field handling
    const displayValue = value !== null && value !== undefined ? value.toString() : '—'
    
    return (
      <span
        className={isDoctorView ? "cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded" : ""}
        onClick={() => handleCellClick(record.id!, field, value)}
        title={isDoctorView ? "Click to edit" : ""}
      >
        {displayValue}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {isDoctorView ? "📋 Client Check-in Data (Editable)" : "📋 Your Check-in Data"}
      </h3>
      <p className="text-gray-600 mb-4">
        {isDoctorView 
          ? "Click any cell to edit Client data. This table shows the raw data used to generate the progress charts above."
          : "This table shows the raw data used to generate your progress charts above"
        }
      </p>
      {!isDoctorView && missedCount > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {`Note: Your dashboard includes ${missedCount} week${missedCount === 1 ? '' : 's'} marked 'no data' to reflect missed check-ins. This keeps your charts aligned week-to-week.`}
        </p>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Week</th>
              {isDoctorView && (
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
              )}
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{`Weight (${getWeightUnitLabel(unitSystem)})`}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{`Waist (${getLengthUnitLabel(unitSystem)})`}</th>
              {isDoctorView && tracksBP && (
                <>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Systolic (mmHg)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Diastolic (mmHg)</th>
                </>
              )}
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Days of Low EA Symptons</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Detailed Symptom Notes</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Days Strain Goal Met</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Resistance Training Days Goal Met</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Poor Recovery Days</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sleep Consistency Score</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nutrition Days Goal Met</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Morning Fat Burn %</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Body Fat %</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Self Reflection</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((record, index) => (
              <tr key={record.id || index} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {isDoctorView && patientId && onSubmissionSelect ? (
                    <button
                      onClick={() => handleHistoricalReview(record.week_number)}
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full transition-all hover:scale-105 hover:shadow-sm cursor-pointer ${
                        record.week_number === 0 
                          ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' 
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                      title="Click to review this week's submission"
                    >
                      {record.week_number === 0 ? 'Week 0' : `Week ${record.week_number}`}
                    </button>
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      record.week_number === 0 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {record.week_number === 0 ? 'Week 0' : `Week ${record.week_number}`}
                    </span>
                  )}
                </td>
                {isDoctorView && (
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatCreatedAtDate(record.created_at)}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'weight', record.weight)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'waist', record.waist)}
                </td>
                {isDoctorView && tracksBP && (
                  <>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {renderCell(record, 'systolic_bp', (record as any).systolic_bp)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {renderCell(record, 'diastolic_bp', (record as any).diastolic_bp)}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'symptom_tracking_days', record.symptom_tracking_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'detailed_symptom_notes', record.detailed_symptom_notes, true)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'purposeful_exercise_days', record.purposeful_exercise_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'resistance_training_days', record.resistance_training_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'poor_recovery_days', record.poor_recovery_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'sleep_consistency_score', record.sleep_consistency_score)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'nutrition_compliance_days', record.nutrition_compliance_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <TableTooltip content="Your morning fat burn efficiency measured through monthly metabolic analysis">
                    {renderCell(record, 'morning_fat_burn_percent', record.morning_fat_burn_percent)}
                  </TableTooltip>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <TableTooltip content="Your body fat percentage from precise Fit 3-D body composition scans">
                    {renderCell(record, 'body_fat_percentage', record.body_fat_percentage)}
                  </TableTooltip>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'notes', record.notes, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p><strong>Note:</strong> Week 0 represents your baseline measurements. Sleep scores, Morning Fat %, and Body Fat % are tracked throughout your program.</p>
        <p><strong>Morning Fat %:</strong> Monthly metabolic analysis showing fat burning efficiency. <strong>Body Fat %:</strong> Periodic body composition scans tracking your progress.</p>
        {isDoctorView ? (
          <p className="text-blue-600 mt-1">
            <strong>Dr. Nick:</strong> Click any cell to edit values. For notes, use Ctrl+Enter to save. Press Escape to cancel edits.
          </p>
        ) : (
          <p className="text-blue-600 mt-1">
            <strong>Tip:</strong> Click on any self reflection entry to view the full text.
          </p>
        )}
      </div>
    </div>
  )
}

export default function ChartsDashboard({ patientId, onSubmissionSelect, selectedWeekNumber }: ChartsDashboardProps) {
  const [chartData, setChartData] = useState<WeeklyCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  // Metrics state (patient view only)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  
  // Weight change goal editing (doctor view only)
  const [weightChangeGoal, setWeightChangeGoal] = useState('1.00')
  const [goalLoading, setGoalLoading] = useState(false)
  
  // Resistance training goal editing (doctor view only)
  const [resistanceTrainingGoal, setResistanceTrainingGoal] = useState(0)
  const [resistanceGoalLoading, setResistanceGoalLoading] = useState(false)
  
  // Client name for display
  const [patientName, setPatientName] = useState<string>('')
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [tracksBP, setTracksBP] = useState<boolean>(false)

  // Determine if this is Dr. Nick's view (when patientId is provided)
  const isDoctorView = !!patientId

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load data on mount and when patientId changes
  useEffect(() => {
    if (mounted) {
      loadChartData()
       loadMetrics() // Load metrics for both Client and doctor views
      if (isDoctorView) {
        loadSubmissionData()
        loadPatientName()
      }
      // Load unit system
      ;(async () => {
        const u = await fetchUnitSystem(patientId)
        setUnitSystem(u)
      })()
      // Load BP tracking flag
      ;(async () => {
        try {
          if (isDoctorView && patientId) {
            const { data } = await supabase
              .from('profiles')
              .select('track_blood_pressure')
              .eq('id', patientId)
              .single()
            setTracksBP(Boolean(data?.track_blood_pressure))
          } else {
            // current user
            const { data: userData } = await supabase.auth.getUser()
            const uid = userData?.user?.id
            if (uid) {
              const { data } = await supabase
                .from('profiles')
                .select('track_blood_pressure')
                .eq('id', uid)
                .single()
              setTracksBP(Boolean(data?.track_blood_pressure))
            }
          }
        } catch {}
      })()
    }
  }, [mounted, patientId, isDoctorView])

  // Function to load chart data
  const loadChartData = async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await getWeeklyDataForCharts(patientId)

    if (fetchError) {
      setError((fetchError as Error).message || 'Failed to load chart data')
    } else {
      setChartData(data || [])
    }

    setLoading(false)
  }

  // Function to load metrics data (both Client and doctor views)
  const loadMetrics = async () => {
    setMetricsLoading(true)
    try {
      // For Client view, patientId is undefined, so getPatientMetrics will use current user from auth context
      // For doctor view, patientId is passed to get metrics for the specific Client
      const metricsData = await getPatientMetrics(patientId)
      setMetrics(metricsData)
    } catch (error) {
      console.error('Error loading metrics:', error)
      setMetrics({
        totalWeightLossPercentage: null,
        weeklyWeightLossPercentage: null,
        weightChangeGoalPercent: null,
        hasEnoughData: false,
        dataPoints: 0,
        performanceMs: 0,
        error: 'Failed to load metrics data'
      })
    } finally {
      setMetricsLoading(false)
    }
  }

  // Function to load weight change goal and resistance training goal (doctor view only)
  // Load current goals data (exact copy of working DrNickSubmissionReview pattern)
  const loadSubmissionData = async () => {
    if (!isDoctorView || !patientId) return
    
    try {
      // Load weight change goal and resistance training goal
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('weight_change_goal_percent, resistance_training_days_goal')
        .eq('id', patientId)
        .single()
      
      if (profileError) {
        console.error('Error loading profile data:', profileError)
      } else {
        setWeightChangeGoal(profileData.weight_change_goal_percent || '1.00')
        setResistanceTrainingGoal(profileData.resistance_training_days_goal || 0)
      }
      
    } catch (err) {
      console.error('Failed to load submission data:', err)
    }
  }

  // Load Client name separately  
  const loadPatientName = async () => {
    if (!isDoctorView || !patientId) return
    
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('id', patientId)
        .single()
      
      if (error) {
        console.error('Error loading patient name:', error)
        return
      }
      
      // Set Client name (try full_name first, then first_name + last_name, fallback to "this client")
      const name = profileData?.full_name || 
                   (profileData?.first_name && profileData?.last_name 
                     ? `${profileData.first_name} ${profileData.last_name}` 
                     : profileData?.first_name || 'this client')
      setPatientName(name)
      
    } catch (err) {
       console.error('Failed to load patient name:', err)
    }
  }

  // Function to update weight change goal (doctor view only)
  const handleGoalUpdate = async () => {
    if (!isDoctorView || !patientId) return
    
    const goalPercent = parseFloat(weightChangeGoal)
    if (isNaN(goalPercent) || goalPercent < 0.1 || goalPercent > 5.0) {
      alert('Goal must be between 0.10% and 5.00%')
      return
    }

    setGoalLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ weight_change_goal_percent: goalPercent })
        .eq('id', patientId)
      
      if (error) {
        console.error('Error updating weight change goal:', error)
        alert('Failed to update weight change goal')
        return
      }
      
      // Format to 2 decimal places
      setWeightChangeGoal(goalPercent.toFixed(2))
      alert('Weight change goal updated successfully!')
    } catch (err) {
      console.error('Error updating weight change goal:', err)
      alert('Failed to update weight change goal')
    } finally {
      setGoalLoading(false)
    }
  }

  // Function to update resistance training goal (doctor view only)
  const handleResistanceGoalUpdate = async () => {
    if (!isDoctorView || !patientId) return
    
    if (isNaN(resistanceTrainingGoal) || resistanceTrainingGoal < 0 || resistanceTrainingGoal > 7) {
      alert('Goal must be between 0 and 7 days')
      return
    }

    setResistanceGoalLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ resistance_training_days_goal: resistanceTrainingGoal })
        .eq('id', patientId)
      
      if (error) {
        console.error('Error updating resistance training goal:', error)
        alert('Failed to update resistance training goal')
        return
      }
      
      alert('Resistance training goal updated successfully!')
    } catch (err) {
      console.error('Error updating resistance training goal:', err)
      alert('Failed to update resistance training goal')
    } finally {
      setResistanceGoalLoading(false)
    }
  }

  // Don't render until mounted (avoids SSR mismatch)
  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading dashboard...</div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate summary statistics
  const stats = {
    totalWeeks: chartData.length,
    currentWeek: chartData.length > 0 ? Math.max(...chartData.map(d => d.week_number)) : 0,
    hasWeek0: chartData.some(d => d.week_number === 0),
    initialWeight: (() => {
      // First try to find Week 0 with weight
      const week0WithWeight = chartData.find(d => d.week_number === 0 && d.weight);
      if (week0WithWeight?.weight) return week0WithWeight.weight;
      
      // Then try Week 0 with initial_weight
      const week0WithInitial = chartData.find(d => d.week_number === 0 && d.initial_weight);
      if (week0WithInitial?.initial_weight) return week0WithInitial.initial_weight;
      
      // Finally, try the earliest week with weight data
      const earliestWithWeight = chartData
        .filter(d => d.weight)
        .sort((a, b) => a.week_number - b.week_number)[0];
      return earliestWithWeight?.weight || null;
    })(),
    currentWeight: (() => {
      // Get the most recent week with weight data
      const latestWithWeight = chartData
        .filter(d => d.weight)
        .sort((a, b) => b.week_number - a.week_number)[0];
      return latestWithWeight?.weight || null;
    })(),
    totalWeightLoss: 0,

  }

  // Missed check-ins (auto-created by system) - patient view only indicator
  const missedCheckins = !isDoctorView
    ? chartData.filter(d => d.week_number > 0 && (d as any).data_entered_by === 'system').length
    : 0

  // Calculate total weight loss
  if (stats.initialWeight && stats.currentWeight) {
    stats.totalWeightLoss = Math.round((stats.initialWeight - stats.currentWeight) * 10) / 10
  }

  // Debug logging (temporary - remove after testing)
  if (chartData.length > 0) {
    console.log('ChartsDashboard Debug:', {
      totalRecords: chartData.length,
      initialWeight: stats.initialWeight,
      currentWeight: stats.currentWeight,
      totalWeightLoss: stats.totalWeightLoss,
      hasWeek0: stats.hasWeek0,
      sampleData: chartData.slice(0, 3).map(d => ({
        week: d.week_number,
        weight: d.weight,
        initial_weight: d.initial_weight,
        date: d.date
      }))
    });
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading chart data...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Metrics Hero Cards - Both Client and Doctor Views */}
      {metrics && metrics.hasEnoughData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Total Weight Loss % - Primary KPI */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-blue-900">Total Weight Loss</h3>
              <div className="text-2xl">🎯</div>
            </div>
            <div className="text-3xl font-bold text-blue-800 mb-1">
              {metrics.totalWeightLossPercentage !== null 
                ? `${metrics.totalWeightLossPercentage.toFixed(2)}%` 
                : '--'
              }
            </div>
            <p className="text-sm text-blue-600">
              Since starting {isDoctorView ? 'their journey' : 'your journey'}
            </p>
          </div>

          {/* Weekly Weight Loss % */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-green-900">Weekly Progress</h3>
              <div className="text-2xl">📈</div>
            </div>
            <div className="text-3xl font-bold text-green-800 mb-1">
              {metrics.weeklyWeightLossPercentage !== null 
                ? `${metrics.weeklyWeightLossPercentage.toFixed(2)}%` 
                : '--'
              }
            </div>
            <p className="text-sm text-green-600">
              Week-over-week change
            </p>
          </div>

          {/* NEW: Weight Change Goal */}
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-purple-900">Current Aggregate Week over week Weight Change Goal (%)</h3>
              <div className="text-2xl">🎯</div>
            </div>
            <div className="text-3xl font-bold text-purple-800 mb-1">
              {metrics.weightChangeGoalPercent !== null 
                ? `${metrics.weightChangeGoalPercent.toFixed(2)}%` 
                : '1.00%'
              }
            </div>
            <p className="text-sm text-purple-600">
              Dr. Nick&apos;s target for {isDoctorView ? 'them' : 'you'}
            </p>
          </div>

        </div>
      )}
      
      {/* Header with Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isDoctorView ? "📊 Dr. Nick's Progress Charts" : "📊 My Progress"}
          </h2>
          <p className="text-gray-600">
            {isDoctorView 
              ? "Comprehensive visual analysis of Client progress over time"
              : "Track your journey and see your progress over time"
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Summary Stats - Different for Doctor vs Patient */}
        {isDoctorView ? (
          // Doctor View - Show stats (removed Total Data Points and Week 0 Setup cards)
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.currentWeek}</div>
              <div className="text-sm text-blue-800">Current Week</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.initialWeight ? (unitSystem === 'metric' ? `${(Math.round((stats.initialWeight * 0.45359237) * 100) / 100).toFixed(2)} kg` : `${stats.initialWeight.toFixed(2)} lbs`) : 'N/A'}
              </div>
              <div className="text-sm text-purple-800">Starting Weight</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">
                {stats.currentWeight ? (unitSystem === 'metric' ? `${(Math.round((stats.currentWeight * 0.45359237) * 100) / 100).toFixed(2)} kg` : `${stats.currentWeight.toFixed(2)} lbs`) : 'N/A'}
              </div>
              <div className="text-sm text-indigo-800">Current Weight</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.totalWeightLoss > 0 ? (unitSystem === 'metric' ? `-${(Math.round((stats.totalWeightLoss * 0.45359237) * 100) / 100).toFixed(2)} kg` : `-${stats.totalWeightLoss.toFixed(2)} lbs`) : 'N/A'}
              </div>
              <div className="text-sm text-orange-800">Total Loss</div>
            </div>
          </div>
        ) : (
          // Client View - Remove Total Data Points and Week 0 Setup
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.currentWeek}</div>
              <div className="text-sm text-blue-800">Current Week</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.initialWeight
                  ? (unitSystem === 'metric'
                      ? `${(Math.round((stats.initialWeight * 0.45359237) * 100) / 100).toFixed(2)} kg`
                      : `${stats.initialWeight.toFixed(2)} lbs`)
                  : 'N/A'}
              </div>
              <div className="text-sm text-purple-800">Starting Weight</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">
                {stats.currentWeight
                  ? (unitSystem === 'metric'
                      ? `${(Math.round((stats.currentWeight * 0.45359237) * 100) / 100).toFixed(2)} kg`
                      : `${stats.currentWeight.toFixed(2)} lbs`)
                  : 'N/A'}
              </div>
              <div className="text-sm text-indigo-800">Current Weight</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.totalWeightLoss > 0
                  ? (unitSystem === 'metric'
                      ? `-${(Math.round((stats.totalWeightLoss * 0.45359237) * 100) / 100).toFixed(2)} kg`
                      : `-${stats.totalWeightLoss.toFixed(2)} lbs`)
                  : 'N/A'}
              </div>
              <div className="text-sm text-orange-800">Total Loss</div>
            </div>
          </div>
        )}


      </div>

      {/* Move Missed Check-ins Indicator down to the data table area (client view only) */}

      {/* Goals Editing - Doctor View Only */}
      {isDoctorView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Weight Change Goal - Left Side */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  🎯 Client Weight Change Goal
                </h3>
                <p className="text-gray-600">
                  Set the target week-over-week weight loss<br />
                   percentage for {patientName || 'this client'}
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Goal Percentage
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.10"
                      max="5.00"
                      value={weightChangeGoal}
                      onChange={(e) => setWeightChangeGoal(e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={goalLoading}
                    />
                    <span className="text-gray-700 font-medium">%</span>
                  </div>
                </div>
                
                <button
                  onClick={handleGoalUpdate}
                  disabled={goalLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {goalLoading ? 'Updating...' : 'Update Goal'}
                </button>
              </div>
            </div>
          </div>

          {/* Resistance Training Goal + Blood Pressure Inputs - Right Side */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    🏋️ Client Strength Days Target Goal
                  </h3>
                  <p className="text-gray-600">
                    Set the target resistance training days per week<br />
                     for {patientName || 'this client'}
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Goal Days
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="7"
                        value={resistanceTrainingGoal}
                        onChange={(e) => setResistanceTrainingGoal(parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-md text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={resistanceGoalLoading}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleResistanceGoalUpdate}
                    disabled={resistanceGoalLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {resistanceGoalLoading ? 'Updating...' : 'Update Goal'}
                  </button>
                </div>
              </div>

              {/* BP Inputs inline with goals ONLY when reviewing a specific week (review queue) */}
              {tracksBP && typeof selectedWeekNumber === 'number' && selectedWeekNumber >= 0 && isDoctorView && (
                <div className="flex items-end gap-4 border-t pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Systolic (mmHg)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={(chartData.find(d => d.week_number === (selectedWeekNumber ?? -1)) as any)?.systolic_bp ?? ''}
                      onChange={async (e) => {
                        const rec = chartData.find(d => d.week_number === (selectedWeekNumber ?? -1))
                        if (!rec?.id) return
                        await updateHealthRecord(rec.id, { systolic_bp: e.target.value === '' ? null : parseInt(e.target.value) })
                        await loadChartData()
                      }}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="e.g., 120"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diastolic (mmHg)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={(chartData.find(d => d.week_number === (selectedWeekNumber ?? -1)) as any)?.diastolic_bp ?? ''}
                      onChange={async (e) => {
                        const rec = chartData.find(d => d.week_number === (selectedWeekNumber ?? -1))
                        if (!rec?.id) return
                        await updateHealthRecord(rec.id, { diastolic_bp: e.target.value === '' ? null : parseInt(e.target.value) })
                        await loadChartData()
                      }}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="e.g., 80"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid - Always render charts, they handle empty data themselves */}
      <div className="space-y-6">
        
        {/* Row 1: Weight-Related Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WeightProjectionChart data={chartData} unitSystem={unitSystem} />
          <PlateauPreventionChart data={chartData} />
        </div>

        {/* Row 2: Basic Trend Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WeightTrendChart data={chartData} unitSystem={unitSystem} />
          <WaistTrendChart data={chartData} unitSystem={unitSystem} />
        </div>

        {/* Row 2.5: Blood Pressure Charts (conditional) */}
        {tracksBP && (
          <div className="grid lg:grid-cols-2 gap-6">
            <SystolicBloodPressureChart data={chartData} />
            <DiastolicBloodPressureChart data={chartData} />
          </div>
        )}

        {/* Row 3: Sleep Chart (Full Width) */}
        <div className="grid grid-cols-1">
          <SleepConsistencyChart data={chartData} />
        </div>

        {/* Row 4: New Dr. Nick Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <MorningFatBurnChart data={chartData} />
          <BodyFatPercentageChart data={chartData} />
        </div>

        {/* Compliance Metrics Table */}
        <div className="grid grid-cols-1">
          <ComplianceMetricsTable patientId={patientId} />
        </div>

        {/* Data Table - Different for Client vs Dr. Nick */}
        <DataTable 
          data={chartData} 
          isDoctorView={isDoctorView}
          onDataUpdate={loadChartData}
          patientId={patientId}
          onSubmissionSelect={onSubmissionSelect}
          unitSystem={unitSystem}
          tracksBP={tracksBP}
        />

        {/* Removed duplicate bottom missed-checkins note: now rendered inside DataTable header */}

        {/* Chart Refresh Button */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <button
              onClick={loadChartData}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Charts'}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Click to reload the latest data from the database
            </p>
          </div>
        </div>

      </div>

      {/* Data status info */}
      {chartData.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-6">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Charts Ready for Data
            </h3>
            <p className="text-gray-600 mb-4">
              The charts above will populate automatically as data is entered.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg max-w-md mx-auto">
              <h4 className="font-medium text-blue-900 mb-2">To Get Started:</h4>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>1. Dr. Nick sets up Week 0 with initial weight</li>
                <li>2. Client completes weekly check-ins (Weeks 1+)</li>
                <li>3. Dr. Nick adds sleep and recovery data</li>
                <li>4. Charts automatically populate with data</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Client Status Management - Dr. Nick Only */}
      {isDoctorView && (
        <PatientStatusManagement patientId={patientId} onBpTrackingChange={(enabled) => setTracksBP(enabled)} />
      )}

      {/* Floating Sticky Notes - Dr. Nick Only */}
      <StickyNotes 
        patientId={patientId}
        patientName={undefined}
      />

    </div>
  )
}