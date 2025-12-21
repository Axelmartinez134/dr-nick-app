// src/app/components/health/ChartsDashboard.tsx
// Main dashboard combining all 5 charts for Dr. Nick's analysis

'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { getWeeklyDataForCharts, updateHealthRecord, getHistoricalSubmissionDetails, createHealthRecordForPatient, type WeeklyCheckin } from './healthService'
import { type QueueSubmission } from './DrNickQueue'
import { getPatientMetrics, type MetricsData } from './metricsService'
import { supabase } from '../auth/AuthContext'
import { fetchUnitSystem, formatLength, formatWeight, getLengthUnitLabel, getWeightUnitLabel, UnitSystem } from './unitUtils'
import BodyFatPercentageChart from './charts/BodyFatPercentageChart'
import VisceralFatLevelChart from './charts/VisceralFatLevelChart'
import SubcutaneousFatLevelChart from './charts/SubcutaneousFatLevelChart'
import BellyFatPercentChart from './charts/BellyFatPercentChart'
import RestingHeartRateChart from './charts/RestingHeartRateChart'
import TotalMuscleMassPercentChart from './charts/TotalMuscleMassPercentChart'
import MorningFatBurnChart from './charts/MorningFatBurnChart'
import NutritionComplianceChart from './charts/NutritionComplianceChart'
import StrainGoalMetChart from './charts/StrainGoalMetChart'
import WaistPlateauPreventionChart from './charts/WaistPlateauPreventionChart'
import ComplianceMetricsTable from './ComplianceMetricsTable'
import StickyNotes from './StickyNotes'
import { kilogramsToPounds, poundsToKilograms } from './unitCore'

// Patient Status Management Component
function PatientStatusManagement({ patientId, onBpTrackingChange }: { patientId?: string; onBpTrackingChange?: (enabled: boolean) => void }) {
  const [currentStatus, setCurrentStatus] = useState<string>('Current')
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [tracksBP, setTracksBP] = useState<boolean>(false)
  const [tracksBodyComp, setTracksBodyComp] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  // Delete patient confirmation modal state
  const [showDeletePatientModal, setShowDeletePatientModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingPatient, setDeletingPatient] = useState(false)

  // Load current Client status
  useEffect(() => {
    if (!patientId) return

    const loadPatientStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('client_status, unit_system, track_blood_pressure, track_body_composition')
          .eq('id', patientId)
          .single()

        if (error) throw error
        setCurrentStatus(data?.client_status || 'Current')
        setUnitSystem((data?.unit_system as UnitSystem) || 'imperial')
        setTracksBP(Boolean(data?.track_blood_pressure))
        setTracksBodyComp(Boolean((data as any)?.track_body_composition))
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

  const handleBodyCompTrackingChange = async (enabled: boolean) => {
    if (!patientId || enabled === tracksBodyComp) return
    setTracksBodyComp(enabled)
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/update-patient-body-composition-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, trackBodyComposition: enabled })
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setMessage(`✅ Body composition tracking ${enabled ? 'enabled' : 'disabled'}`)
      setMessageType('success')
    } catch (error) {
      setTracksBodyComp(!enabled)
      setMessage('❌ Failed to update Body Composition tracking')
      setMessageType('error')
      console.error('Body Composition tracking update error:', error)
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
              <option value="Maintenance">Maintenance</option>
              <option value="Nutraceutical">Nutraceutical</option>
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

      {/* Body Composition Tracking Toggle */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Track Body Composition</label>
            <p className="text-xs text-gray-500">Show Body Composition charts and enable weekly inputs in reviews. You can turn this off anytime; existing data stays saved.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleBodyCompTrackingChange(true)}
              disabled={saving}
              className={`px-3 py-2 rounded border ${tracksBodyComp ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              On
            </button>
            <button
              type="button"
              onClick={() => handleBodyCompTrackingChange(false)}
              disabled={saving}
              className={`px-3 py-2 rounded border ${!tracksBodyComp ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
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

      {/* Danger zone: delete entire client */}
      <div className="mt-6 border-t pt-4">
        <h4 className="text-sm font-semibold text-red-800 mb-2">Danger zone</h4>
        <p className="text-xs text-gray-600 mb-3">
          Permanently delete this client, their profile, and all check-in data. This action cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => { setShowDeletePatientModal(true); setDeleteConfirmText('') }}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          🗑️ Delete Entire Client
        </button>
      </div>

      {/* Delete patient confirmation modal */}
      {showDeletePatientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Client</h3>
            <p className="text-sm text-gray-700 mb-3">
              This will permanently delete the client profile and all associated health_data. Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              placeholder="Type DELETE to confirm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeletePatientModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                disabled={deletingPatient}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!patientId) return
                  if (deleteConfirmText !== 'DELETE') {
                    setMessage('❌ Please type DELETE to confirm')
                    setMessageType('error')
                    setTimeout(() => { setMessage(''); setMessageType('') }, 3000)
                    return
                  }
                  try {
                    setDeletingPatient(true)
                    const { data: { session } } = await supabase.auth.getSession()
                    const token = session?.access_token
                    if (!token) {
                      throw new Error('Unauthorized')
                    }
                    const resp = await fetch('/api/admin/delete-patient', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ patientId, confirm: 'DELETE' })
                    })
                    const result = await resp.json()
                    if (!resp.ok || !result.success) throw new Error(result.error || 'Failed to delete client')
                    // Reload to reflect deletion and return to list
                    window.location.reload()
                  } catch (err) {
                    console.error('Delete client failed:', err)
                    setDeletingPatient(false)
                    setMessage('❌ Failed to delete client')
                    setMessageType('error')
                    setTimeout(() => { setMessage(''); setMessageType('') }, 3000)
                  }
                }}
                className={`px-4 py-2 rounded-md text-white ${deleteConfirmText === 'DELETE' && !deletingPatient ? 'bg-red-600 hover:bg-red-700' : 'bg-red-400 cursor-not-allowed'}`}
                disabled={deleteConfirmText !== 'DELETE' || deletingPatient}
              >
                {deletingPatient ? 'Deleting...' : 'Delete Client'}
              </button>
            </div>
          </div>
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

// Lightweight inline component for editing Week 0 initial_weight
function InitialWeightEditor({ chartData, unitSystem, onSaved }: { chartData: WeeklyCheckin[]; unitSystem: UnitSystem; onSaved: () => void }) {
  const week0 = chartData.find(d => d.week_number === 0)
  const currentLbs = week0?.initial_weight ?? week0?.weight ?? null
  const displayVal = currentLbs !== null ? (unitSystem === 'metric' ? poundsToKilograms(currentLbs) : currentLbs) : null

  const [val, setVal] = useState<string>(displayVal !== null ? String(displayVal) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!week0?.id) return
    setSaving(true)
    try {
      const lbs = unitSystem === 'metric' ? (kilogramsToPounds(parseFloat(val)) ?? null) : (isNaN(parseFloat(val)) ? null : parseFloat(val))
      await updateHealthRecord(week0.id, { initial_weight: lbs })
      onSaved()
    } catch (e) {
      console.error('Failed to update initial weight:', e)
      alert('Failed to update initial weight')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-700">Initial Weight ({unitSystem === 'metric' ? 'kg' : 'lbs'})</label>
        <input
          type="number"
          step="0.01"
          className="w-28 px-2 py-1 border border-gray-300 rounded-md text-gray-900"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={unitSystem === 'metric' ? 'kg' : 'lbs'}
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
      >
        {saving ? 'Saving...' : 'Update Initial Weight'}
      </button>
    </div>
  )
}

  // Data Table Component - Different versions for Client vs Dr. Nick
function DataTable({ data, isDoctorView, onDataUpdate, patientId, onSubmissionSelect, unitSystem, tracksBP, tracksBodyComp }: { 
  data: WeeklyCheckin[], 
  isDoctorView: boolean,
  onDataUpdate?: () => void,
  patientId?: string,
  onSubmissionSelect?: (submission: QueueSubmission) => void,
  unitSystem: UnitSystem,
  tracksBP: boolean,
  tracksBodyComp: boolean
}) {
  const [editingCell, setEditingCell] = useState<{ recordId: string, field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  // Delete row modal state
  const [showDeleteRowModal, setShowDeleteRowModal] = useState(false)
  const [rowToDelete, setRowToDelete] = useState<string | null>(null)
  const [rowDeleteConfirm, setRowDeleteConfirm] = useState('')
  const [deletingRow, setDeletingRow] = useState(false)

  // Add Week modal state
  const [showAddWeekModal, setShowAddWeekModal] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)
  const [newWeekForm, setNewWeekForm] = useState<{
    week_number: number | ''
    date: string
    weight: string
    waist: string
    systolic_bp: string
    diastolic_bp: string
    visceral_fat_level: string
    subcutaneous_fat_level: string
    belly_fat_percent: string
    resting_heart_rate: string
    total_muscle_mass_percent: string
    symptom_tracking_days: string
    detailed_symptom_notes: string
    purposeful_exercise_days: string
    resistance_training_days: string
    poor_recovery_days: string
    sleep_consistency_score: string
    nutrition_compliance_days: string
    morning_fat_burn_percent: string
    body_fat_percentage: string
    notes: string
  }>({
    week_number: '',
    date: '',
    weight: '',
    waist: '',
    systolic_bp: '',
    diastolic_bp: '',
    visceral_fat_level: '',
    subcutaneous_fat_level: '',
    belly_fat_percent: '',
    resting_heart_rate: '',
    total_muscle_mass_percent: '',
    symptom_tracking_days: '',
    detailed_symptom_notes: '',
    purposeful_exercise_days: '',
    resistance_training_days: '',
    poor_recovery_days: '',
    sleep_consistency_score: '',
    nutrition_compliance_days: '',
    morning_fat_burn_percent: '',
    body_fat_percentage: '',
    notes: ''
  })

  const existingWeeks = new Set(data.map(d => d.week_number))
  const weekOptions = Array.from({ length: 100 }, (_, i) => i + 1).filter(w => !existingWeeks.has(w))

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
          {field === 'date' ? (
            <input
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-36 px-2 py-1 text-xs border rounded text-gray-900"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit()
                if (e.key === 'Escape') handleCancelEdit()
              }}
            />
          ) : isLongText ? (
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

    // Special handling for date field: show M/D/YYYY, click to edit
    if (field === 'date') {
      const iso = value || ''
      const display = (() => {
        if (!iso) return '—'
        const parts = String(iso).split('T')[0].split('-')
        if (parts.length === 3) {
          const [y, m, d] = parts
          const mm = Number(m)
          const dd = Number(d)
          if (mm && dd && y) return `${mm}/${dd}/${y}`
        }
        return String(iso)
      })()

      return (
        <span
          className={isDoctorView ? "cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded" : ""}
          onClick={() => handleCellClick(record.id!, field, String(iso).split('T')[0])}
          title={isDoctorView ? "Click to edit" : ""}
        >
          {display}
        </span>
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
      <p className="text-gray-600 mb-2">
        {isDoctorView 
          ? "Click any cell to edit Client data. This table shows the raw data used to generate the progress charts above."
          : "This table shows the raw data used to generate your progress charts above"
        }
      </p>
      {isDoctorView && (
        <p className="text-xs text-gray-500 mb-3">
          This sets the start point for "📊 Weight Loss Trend vs. Projections". If incorrect, the chart will look misconfigured.
        </p>
      )}
      {isDoctorView && patientId && (
        <div className="flex items-center justify-start gap-3 mb-3 flex-wrap">
          <InitialWeightEditor
            chartData={data}
            unitSystem={unitSystem}
            onSaved={onDataUpdate || (() => {})}
          />
          <button
            type="button"
            onClick={() => { setShowAddWeekModal(true); setAddError(null); setAddSuccess(null) }}
            className="px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 text-sm"
          >
            + Add Week
          </button>
        </div>
      )}
      {!isDoctorView && missedCount > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {`Note: Your dashboard includes ${missedCount} week${missedCount === 1 ? '' : 's'} marked 'no data' to reflect missed check-ins. This keeps your charts aligned week-to-week.`}
        </p>
      )}
      
      <div className="overflow-x-auto">
        {isDoctorView && patientId && null}
        {addSuccess && (
          <div className="mb-3 p-2 rounded bg-green-100 text-green-800 text-sm">{addSuccess}</div>
        )}
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Week</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{`Weight (${getWeightUnitLabel(unitSystem)})`}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{`Waist (${getLengthUnitLabel(unitSystem)})`}</th>
              {isDoctorView && tracksBP && (
                <>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Systolic (mmHg)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Diastolic (mmHg)</th>
                </>
              )}
              {tracksBodyComp && (
                <>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Visceral Fat Level</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Subcutaneous Fat Level</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Belly Fat (%)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total Muscle Mass (%)</th>
                </>
              )}
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Days of Low EA Symptons</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Detailed Symptom Notes</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Days Strain Goal Met</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Resistance Training Days Goal Met</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Poor Recovery Days</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sleep Consistency Score</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Resting HR (bpm)</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nutrition Days Goal Met</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Morning Fat Burn %</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Body Fat %</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Self Reflection</th>
              {isDoctorView && (
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              )}
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
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'date', record.date || (record.created_at ? String(record.created_at).split('T')[0] : ''))}
                </td>
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

                {/* Body Composition columns - client view shows read-only, admin can edit */}
                {tracksBodyComp && (
                  <>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {renderCell(record, 'visceral_fat_level', (record as any).visceral_fat_level)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {renderCell(record, 'subcutaneous_fat_level', (record as any).subcutaneous_fat_level)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {renderCell(record, 'belly_fat_percent', (record as any).belly_fat_percent)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {renderCell(record, 'total_muscle_mass_percent', (record as any).total_muscle_mass_percent)}
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
                  {renderCell(record, 'resting_heart_rate', (record as any).resting_heart_rate)}
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
                {isDoctorView && (
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => { setRowToDelete(record.id!); setRowDeleteConfirm(''); setShowDeleteRowModal(true) }}
                      className="text-red-600 hover:text-red-800"
                      title="Delete this row"
                    >
                      🗑️ Delete
                    </button>
                  </td>
                )}
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
      {/* Delete row confirmation modal */}
      {showDeleteRowModal && rowToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Row</h3>
            <p className="text-sm text-gray-700 mb-3">This will permanently delete the selected check-in row. Type <span className="font-mono font-semibold">DELETE</span> to confirm.</p>
            <input
              type="text"
              value={rowDeleteConfirm}
              onChange={(e) => setRowDeleteConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              placeholder="Type DELETE to confirm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteRowModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                disabled={deletingRow}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (rowDeleteConfirm !== 'DELETE') return
                  try {
                    setDeletingRow(true)
                    const { data: { session } } = await supabase.auth.getSession()
                    const token = session?.access_token
                    if (!token) {
                      throw new Error('Unauthorized')
                    }
                    const resp = await fetch('/api/admin/delete-health-row', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ rowId: rowToDelete, confirm: 'DELETE' })
                    })
                    const result = await resp.json()
                    if (!resp.ok || !result.success) throw new Error(result.error || 'Failed to delete row')
                    setShowDeleteRowModal(false)
                    setRowToDelete(null)
                    setRowDeleteConfirm('')
                    if (onDataUpdate) onDataUpdate()
                  } catch (err) {
                    console.error('Delete row failed:', err)
                    alert('Failed to delete row')
                  } finally {
                    setDeletingRow(false)
                  }
                }}
                className={`px-4 py-2 rounded-md text-white ${rowDeleteConfirm === 'DELETE' && !deletingRow ? 'bg-red-600 hover:bg-red-700' : 'bg-red-400 cursor-not-allowed'}`}
                disabled={rowDeleteConfirm !== 'DELETE' || deletingRow}
              >
                {deletingRow ? 'Deleting...' : 'Delete Row'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Week modal */}
      {isDoctorView && patientId && showAddWeekModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Week</h3>
              <button className="text-gray-600 hover:text-gray-800" onClick={() => setShowAddWeekModal(false)}>✕</button>
            </div>

            {addError && (
              <div className="mb-3 p-2 rounded bg-red-100 text-red-800 text-sm">{addError}</div>
            )}
            {addSuccess && (
              <div className="mb-3 p-2 rounded bg-green-100 text-green-800 text-sm">{addSuccess}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week Number</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.week_number === '' ? '' : newWeekForm.week_number}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, week_number: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                >
                  <option value="">Select week (1-100)</option>
                  {weekOptions.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.date}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{`Weight (${getWeightUnitLabel(unitSystem)})`}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder={unitSystem === 'metric' ? 'kg' : 'lbs'}
                  value={newWeekForm.weight}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, weight: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{`Waist (${getLengthUnitLabel(unitSystem)})`}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder={unitSystem === 'metric' ? 'cm' : 'inches'}
                  value={newWeekForm.waist}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, waist: e.target.value }))}
                />
              </div>

              {tracksBP && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Systolic (mmHg)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="60"
                      max="250"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="e.g., 120"
                      value={newWeekForm.systolic_bp}
                      onChange={(e) => setNewWeekForm(prev => ({ ...prev, systolic_bp: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diastolic (mmHg)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="40"
                      max="150"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="e.g., 80"
                      value={newWeekForm.diastolic_bp}
                      onChange={(e) => setNewWeekForm(prev => ({ ...prev, diastolic_bp: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {tracksBodyComp && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visceral Fat Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="e.g., 10.50"
                      value={newWeekForm.visceral_fat_level}
                      onChange={(e) => setNewWeekForm(prev => ({ ...prev, visceral_fat_level: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subcutaneous Fat Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="e.g., 20.00"
                      value={newWeekForm.subcutaneous_fat_level}
                      onChange={(e) => setNewWeekForm(prev => ({ ...prev, subcutaneous_fat_level: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Belly Fat % (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="e.g., 32.25"
                      value={newWeekForm.belly_fat_percent}
                      onChange={(e) => setNewWeekForm(prev => ({ ...prev, belly_fat_percent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Muscle Mass % (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="e.g., 41.75"
                      value={newWeekForm.total_muscle_mass_percent}
                      onChange={(e) => setNewWeekForm(prev => ({ ...prev, total_muscle_mass_percent: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* RHR field is independent and always visible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resting Heart Rate (20-120 bpm)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="20"
                  max="120"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder="e.g., 58"
                  value={newWeekForm.resting_heart_rate}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, resting_heart_rate: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days of Low EA Symptoms (0-7)</label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.symptom_tracking_days}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, symptom_tracking_days: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Symptom Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  rows={3}
                  value={newWeekForm.detailed_symptom_notes}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, detailed_symptom_notes: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days Strain Goal Met (0-7)</label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.purposeful_exercise_days}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, purposeful_exercise_days: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resistance Training Days Goal Met (0-7)</label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.resistance_training_days}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, resistance_training_days: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poor Recovery Days (0-7)</label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.poor_recovery_days}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, poor_recovery_days: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sleep Consistency Score (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.sleep_consistency_score}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, sleep_consistency_score: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nutrition Days Goal Met (0-7)</label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.nutrition_compliance_days}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, nutrition_compliance_days: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Morning Fat Burn % (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.morning_fat_burn_percent}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, morning_fat_burn_percent: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Fat % (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={newWeekForm.body_fat_percentage}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, body_fat_percentage: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Self Reflection</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  rows={3}
                  value={newWeekForm.notes}
                  onChange={(e) => setNewWeekForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                onClick={() => setShowAddWeekModal(false)}
                disabled={addSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                onClick={async () => {
                  if (!patientId) return
                  setAddError(null)
                  setAddSaving(true)
                  try {
                    // Race-condition safe: service re-validates week uniqueness
                    const { error } = await createHealthRecordForPatient(patientId, {
                      week_number: typeof newWeekForm.week_number === 'number' ? newWeekForm.week_number : undefined,
                      date: newWeekForm.date || undefined,
                      weight: newWeekForm.weight === '' ? undefined : parseFloat(newWeekForm.weight),
                      waist: newWeekForm.waist === '' ? undefined : parseFloat(newWeekForm.waist),
                      systolic_bp: newWeekForm.systolic_bp === '' ? undefined : parseInt(newWeekForm.systolic_bp),
                      diastolic_bp: newWeekForm.diastolic_bp === '' ? undefined : parseInt(newWeekForm.diastolic_bp),
                      visceral_fat_level: newWeekForm.visceral_fat_level === '' ? undefined : parseFloat(newWeekForm.visceral_fat_level),
                      subcutaneous_fat_level: newWeekForm.subcutaneous_fat_level === '' ? undefined : parseFloat(newWeekForm.subcutaneous_fat_level),
                      belly_fat_percent: newWeekForm.belly_fat_percent === '' ? undefined : parseFloat(newWeekForm.belly_fat_percent),
                      total_muscle_mass_percent: newWeekForm.total_muscle_mass_percent === '' ? undefined : parseFloat(newWeekForm.total_muscle_mass_percent),
                      resting_heart_rate: newWeekForm.resting_heart_rate === '' ? undefined : parseInt(newWeekForm.resting_heart_rate),
                      symptom_tracking_days: newWeekForm.symptom_tracking_days === '' ? undefined : parseInt(newWeekForm.symptom_tracking_days),
                      detailed_symptom_notes: newWeekForm.detailed_symptom_notes || undefined,
                      purposeful_exercise_days: newWeekForm.purposeful_exercise_days === '' ? undefined : parseInt(newWeekForm.purposeful_exercise_days),
                      resistance_training_days: newWeekForm.resistance_training_days === '' ? undefined : parseInt(newWeekForm.resistance_training_days),
                      poor_recovery_days: newWeekForm.poor_recovery_days === '' ? undefined : parseInt(newWeekForm.poor_recovery_days),
                      sleep_consistency_score: newWeekForm.sleep_consistency_score === '' ? undefined : parseInt(newWeekForm.sleep_consistency_score),
                      nutrition_compliance_days: newWeekForm.nutrition_compliance_days === '' ? undefined : parseInt(newWeekForm.nutrition_compliance_days),
                      morning_fat_burn_percent: newWeekForm.morning_fat_burn_percent === '' ? undefined : parseFloat(newWeekForm.morning_fat_burn_percent),
                      body_fat_percentage: newWeekForm.body_fat_percentage === '' ? undefined : parseFloat(newWeekForm.body_fat_percentage),
                      notes: newWeekForm.notes || undefined,
                    })
                    if (error) {
                      setAddError(typeof error === 'string' ? error : (((error as any)?.message) || 'Failed to create week'))
                    } else {
                      setAddSuccess('Week created successfully')
                      if (onDataUpdate) await onDataUpdate()
                      setShowAddWeekModal(false)
                      // Auto-hide success after a short delay
                      setTimeout(() => setAddSuccess(null), 2000)
                    }
                  } catch (err: any) {
                    setAddError(err?.message || 'Failed to create week')
                  } finally {
                    setAddSaving(false)
                  }
                }}
                disabled={addSaving}
              >
                {addSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChartsDashboard({ patientId, onSubmissionSelect, selectedWeekNumber }: ChartsDashboardProps) {
  // Feature flag: persist time range preferences (disabled per latest requirement)
  const persistRangePrefs = false
  const [chartData, setChartData] = useState<WeeklyCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  // Global time range UI state (Step 5: UI only; Step 6: persistence)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const [rangeEnd, setRangeEnd] = useState<number | null>(null)
  const [rangePrefsLoaded, setRangePrefsLoaded] = useState<boolean>(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null)
  const activeThumbRef = useRef<'start' | 'end' | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const rangeStartRef = useRef<number>(1)
  const rangeEndRef = useRef<number>(1)
  
  // Metrics state (patient view only)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  
  // Weight change goal editing (doctor view only)
  const [weightChangeGoal, setWeightChangeGoal] = useState('1.00')
  const [goalLoading, setGoalLoading] = useState(false)
  const [proteinGoalGrams, setProteinGoalGrams] = useState<string>('150')
  
  // Resistance training goal editing (doctor view only)
  const [resistanceTrainingGoal, setResistanceTrainingGoal] = useState(0)
  const [resistanceGoalLoading, setResistanceGoalLoading] = useState(false)
  
  // Client name for display
  const [patientName, setPatientName] = useState<string>('')
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [tracksBP, setTracksBP] = useState<boolean>(false)
  const [tracksBodyComp, setTracksBodyComp] = useState<boolean>(false)

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
      // Load BP and Body Composition tracking flags
      ;(async () => {
        try {
          if (isDoctorView && patientId) {
            const { data } = await supabase
              .from('profiles')
              .select('track_blood_pressure, track_body_composition')
              .eq('id', patientId)
              .single()
            setTracksBP(Boolean(data?.track_blood_pressure))
            setTracksBodyComp(Boolean((data as any)?.track_body_composition))
          } else {
            // current user
            const { data: userData } = await supabase.auth.getUser()
            const uid = userData?.user?.id
            if (uid) {
              const { data } = await supabase
                .from('profiles')
                .select('track_blood_pressure, track_body_composition')
                .eq('id', uid)
                .single()
              setTracksBP(Boolean(data?.track_blood_pressure))
              setTracksBodyComp(Boolean((data as any)?.track_body_composition))
            }
          }
        } catch {}
      })()
    }
  }, [mounted, patientId, isDoctorView])

  // Realtime: auto-refresh charts/data when new health_data rows are inserted/updated
  useEffect(() => {
    if (!mounted) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    ;(async () => {
      try {
        let targetUserId = patientId || null as string | null
        if (!targetUserId) {
          const { data: auth } = await supabase.auth.getUser()
          targetUserId = auth?.user?.id || null
        }
        if (!targetUserId || cancelled) return

        channel = supabase
          .channel(`health-data-${targetUserId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'health_data',
            filter: `user_id=eq.${targetUserId}`
          }, () => { void loadChartData() })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'health_data',
            filter: `user_id=eq.${targetUserId}`
          }, () => { void loadChartData() })
          .subscribe()
      } catch {}
    })()

    return () => {
      cancelled = true
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
  }, [mounted, patientId])

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
        .select('weight_change_goal_percent, resistance_training_days_goal, protein_goal_grams')
        .eq('id', patientId)
        .single()
      
      if (profileError) {
        console.error('Error loading profile data:', profileError)
      } else {
        setWeightChangeGoal(profileData.weight_change_goal_percent || '1.00')
        setResistanceTrainingGoal(profileData.resistance_training_days_goal || 0)
        setProteinGoalGrams(String((profileData as any)?.protein_goal_grams ?? 150))
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

  const handleProteinGoalUpdate = async () => {
    if (!isDoctorView || !patientId) return
    const rounded = Math.round(parseFloat(proteinGoalGrams))
    const val = isNaN(rounded) ? 150 : rounded
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ protein_goal_grams: val })
        .eq('id', patientId)
      if (error) {
        console.error('Error updating protein goal:', error)
        alert('Failed to update protein goal')
        return
      }
      setProteinGoalGrams(String(val))
      alert('Protein goal updated successfully!')
    } catch (err) {
      console.error('Error updating protein goal:', err)
      alert('Failed to update protein goal')
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

  // Calculate total weight loss
  if (stats.initialWeight && stats.currentWeight) {
    stats.totalWeightLoss = Math.round((stats.initialWeight - stats.currentWeight) * 10) / 10
  }

  // Range helpers and effects MUST be declared before any early return to keep hooks order stable
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  const handleStartChange = (val: number) => {
    const maxW = stats.currentWeek || 0
    const end = rangeEnd ?? maxW
    const next = clamp(val, 0, end)
    setRangeStart(next)
    rangeStartRef.current = next
  }
  const handleEndChange = (val: number) => {
    const maxW = stats.currentWeek || 0
    const start = rangeStart ?? 0
    const next = clamp(val, start, maxW)
    setRangeEnd(next)
    rangeEndRef.current = next
  }

  // Initialize range only AFTER persisted prefs have been attempted (prioritize persisted over default)
  useEffect(() => {
    if (!rangePrefsLoaded) return
    if (stats.currentWeek >= 0) {
      setRangeStart(prev => (prev === null ? 0 : prev))
      setRangeEnd(prev => (prev === null ? stats.currentWeek : Math.min(prev, stats.currentWeek)))
    }
  }, [stats.currentWeek, rangePrefsLoaded])

  // Keep refs in sync with state so drag logic always clamps against latest values
  useEffect(() => {
    if (rangeStart !== null) rangeStartRef.current = rangeStart
  }, [rangeStart])
  useEffect(() => {
    if (rangeEnd !== null) rangeEndRef.current = rangeEnd
  }, [rangeEnd])

  // Load persisted range preferences (per account) - disabled when persistRangePrefs is false
  useEffect(() => {
    if (!mounted || rangePrefsLoaded || stats.currentWeek <= 0) return
    if (!persistRangePrefs) { setRangePrefsLoaded(true); return }
    ;(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth?.user?.id
        if (!uid) { setRangePrefsLoaded(true); return }
        const { data, error } = await supabase
          .from('profiles')
          .select('dashboard_preferences')
          .eq('id', uid)
          .single()
        if (!error && data && (data as any).dashboard_preferences) {
          const dp: any = (data as any).dashboard_preferences
          const cw = dp?.chart_display_weeks
          if (cw && typeof cw.start === 'number' && typeof cw.end === 'number') {
            const maxW = stats.currentWeek || 0
            const startClamped = clamp(Math.floor(cw.start), 0, Math.max(0, Math.floor(cw.end)))
            const endClamped = clamp(Math.floor(cw.end), startClamped, maxW)
            setRangeStart(startClamped)
            setRangeEnd(endClamped)
          }
        } else {
          try {
            const saved = localStorage.getItem(`cdw:${uid}`)
            if (saved) {
              const cw = JSON.parse(saved)
              if (cw && typeof cw.start === 'number' && typeof cw.end === 'number') {
                const maxW = stats.currentWeek || 0
                const startClamped = clamp(Math.floor(cw.start), 0, Math.max(0, Math.floor(cw.end)))
                const endClamped = clamp(Math.floor(cw.end), startClamped, maxW)
                setRangeStart(startClamped)
                setRangeEnd(endClamped)
              }
            }
          } catch {}
        }
      } catch (e) {
        try {
          const { data: auth } = await supabase.auth.getUser()
          const uid = auth?.user?.id
          if (uid) {
            const saved = localStorage.getItem(`cdw:${uid}`)
            if (saved) {
              const cw = JSON.parse(saved)
              if (cw && typeof cw.start === 'number' && typeof cw.end === 'number') {
                const maxW = stats.currentWeek || 0
                const startClamped = clamp(Math.floor(cw.start), 0, Math.max(0, Math.floor(cw.end)))
                const endClamped = clamp(Math.floor(cw.end), startClamped, maxW)
                setRangeStart(startClamped)
                setRangeEnd(endClamped)
              }
            }
          }
        } catch {}
      } finally {
        setRangePrefsLoaded(true)
      }
    })()
  }, [mounted, rangePrefsLoaded, stats.currentWeek, persistRangePrefs])

  // Debounced save of range preferences (disabled when persistRangePrefs is false)
  useEffect(() => {
    if (!mounted) return
    if (stats.currentWeek <= 0) return
    if (rangeStart === null || rangeEnd === null) return
    if (!persistRangePrefs) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth?.user?.id
        if (!uid) return
        const { data: prof } = await supabase
          .from('profiles')
          .select('dashboard_preferences')
          .eq('id', uid)
          .single()
        const existing = (prof as any)?.dashboard_preferences || {}
        const nextPrefs = { ...existing, chart_display_weeks: { start: rangeStart, end: rangeEnd } }
        await supabase
          .from('profiles')
          .update({ dashboard_preferences: nextPrefs })
          .eq('id', uid)
        // Also store locally for fast load/fallback
        try {
          localStorage.setItem(`cdw:${uid}`, JSON.stringify({ start: rangeStart, end: rangeEnd }))
        } catch {}
      } catch (e) {
        // On error (e.g., RLS), still store locally so the range persists for the user
        try {
          const { data: auth } = await supabase.auth.getUser()
          const uid = auth?.user?.id
          if (uid) localStorage.setItem(`cdw:${uid}`, JSON.stringify({ start: rangeStart, end: rangeEnd }))
        } catch {}
      }
    }, 700)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [mounted, rangeStart, rangeEnd, stats.currentWeek, persistRangePrefs])

  // Reset range when switching patients in doctor view (defaults will re-apply)
  useEffect(() => {
    if (!isDoctorView) return
    setRangeStart(null)
    setRangeEnd(null)
  }, [isDoctorView, patientId])

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
        {/* Global Time Range (UI only in Step 5) */}
        <div className="mt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-md font-semibold text-gray-900">Time range</h3>
              <p className="text-sm text-gray-600">Applies to all charts below</p>
            </div>
            {(() => {
              const maxW = stats.currentWeek || 0
              const start = rangeStart ?? 0
              const end = rangeEnd ?? maxW
              const denom = Math.max(1, maxW)
              const startPct = Math.max(0, Math.min(100, (start / denom) * 100))
              const endPct = Math.max(0, Math.min(100, (end / denom) * 100))
              return (
                <div className="w-full md:w-[520px]">
                  <div className="flex items-center gap-3">
                    {/* Start numeric input */}
                    <input
                      type="number"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      min={0}
                      max={end}
                      value={start}
                      onChange={(e) => handleStartChange(parseInt(e.target.value || '0', 10))}
                    />
                    {/* Combined slider */}
                    <div
                      className="relative flex-1 h-8 select-none"
                    >
                      {/* Base track */}
                      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded bg-gray-200"></div>
                      {/* Selected range fill */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded bg-blue-500"
                        style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
                      />
                      {/* Interaction layer: chooses nearest thumb, jumps on down, drags with capture */}
                      <div
                        className="absolute inset-0"
                        style={{ zIndex: 30, touchAction: 'none', cursor: 'pointer' }}
                        onPointerDown={(e) => {
                          const el = e.currentTarget as HTMLDivElement
                          const rect = el.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const width = Math.max(1, rect.width)
                          const pct = Math.max(0, Math.min(100, (x / width) * 100))
                          const maxW = stats.currentWeek || 0
                          const clickedWeek = maxW <= 0 ? 0 : Math.max(0, Math.min(maxW, Math.round((pct / 100) * maxW)))
                          const startPos = (startPct / 100) * width
                          const endPos = (endPct / 100) * width
                          const HIT = 14
                          let chosen: 'start' | 'end'
                          if (Math.abs(x - startPos) <= HIT) {
                            chosen = 'start'
                          } else if (Math.abs(x - endPos) <= HIT) {
                            chosen = 'end'
                          } else if (x < startPos) {
                            chosen = 'start'
                          } else if (x > endPos) {
                            chosen = 'end'
                          } else {
                            const mid = (startPos + endPos) / 2
                            chosen = x < mid ? 'start' : 'end'
                          }
                          setActiveThumb(chosen)
                          activeThumbRef.current = chosen
                          isDraggingRef.current = true
                          const startNow = rangeStartRef.current
                          const endNow = rangeEndRef.current
                          if (chosen === 'start') {
                            const newStart = Math.max(0, Math.min(clickedWeek, endNow))
                            handleStartChange(newStart)
                          } else {
                            const newEnd = Math.max(startNow, Math.min(clickedWeek, maxW))
                            handleEndChange(newEnd)
                          }
                          try { (el as any).setPointerCapture?.((e as any).pointerId) } catch {}
                        }}
                        onPointerMove={(e) => {
                          if (!isDraggingRef.current) return
                          e.preventDefault()
                          const chosen = activeThumbRef.current
                          if (!chosen) return
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const width = Math.max(1, rect.width)
                          const pct = Math.max(0, Math.min(100, (x / width) * 100))
                          const maxW = stats.currentWeek || 0
                          const draggedWeek = maxW <= 0 ? 0 : Math.max(0, Math.min(maxW, Math.round((pct / 100) * maxW)))
                          const startNow = rangeStartRef.current
                          const endNow = rangeEndRef.current
                          if (chosen === 'start') {
                            const newStart = Math.max(0, Math.min(draggedWeek, endNow))
                            handleStartChange(newStart)
                          } else if (chosen === 'end') {
                            const newEnd = Math.max(startNow, Math.min(draggedWeek, maxW))
                            handleEndChange(newEnd)
                          }
                        }}
                        onPointerUp={(e) => {
                          try { (e.currentTarget as any).releasePointerCapture?.((e as any).pointerId) } catch {}
                          isDraggingRef.current = false
                          activeThumbRef.current = null
                          setActiveThumb(null)
                        }}
                        onPointerCancel={(e) => {
                          try { (e.currentTarget as any).releasePointerCapture?.((e as any).pointerId) } catch {}
                          isDraggingRef.current = false
                          activeThumbRef.current = null
                          setActiveThumb(null)
                        }}
                      />
                      {/* Start thumb (full width; gated by pointer-events) */}
                      <input
                        type="range"
                        min={0}
                        max={maxW}
                        step={1}
                        value={start}
                        onChange={(e) => handleStartChange(parseInt(e.target.value || '0', 10))}
                        onKeyDown={(e) => {
                          const key = e.key
                          const big = e.shiftKey || (e as any).metaKey
                          const step = big ? 5 : 1
                          if (key === 'ArrowLeft' || key === 'ArrowDown') {
                            e.preventDefault()
                            handleStartChange(start - step)
                          } else if (key === 'ArrowRight' || key === 'ArrowUp') {
                            e.preventDefault()
                            handleStartChange(start + step)
                          }
                        }}
                        className="absolute left-0 right-0 w-full h-8 appearance-none bg-transparent cursor-pointer"
                        style={{ WebkitAppearance: 'none' as any, zIndex: 20, pointerEvents: 'none' }}
                      />
                      {/* End thumb (full width; gated by pointer-events) */}
                      <input
                        type="range"
                        min={0}
                        max={maxW}
                        step={1}
                        value={end}
                        onChange={(e) => handleEndChange(parseInt(e.target.value || String(maxW), 10))}
                        onKeyDown={(e) => {
                          const key = e.key
                          const big = e.shiftKey || (e as any).metaKey
                          const step = big ? 5 : 1
                          if (key === 'ArrowLeft' || key === 'ArrowDown') {
                            e.preventDefault()
                            handleEndChange(end - step)
                          } else if (key === 'ArrowRight' || key === 'ArrowUp') {
                            e.preventDefault()
                            handleEndChange(end + step)
                          }
                        }}
                        className="absolute left-0 right-0 w-full h-8 appearance-none bg-transparent cursor-pointer"
                        style={{ WebkitAppearance: 'none' as any, zIndex: 20, pointerEvents: 'none' }}
                      />
                    </div>
                    {/* End numeric input */}
                    <input
                      type="number"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      min={start}
                      max={maxW}
                      value={end}
                      onChange={(e) => handleEndChange(parseInt(e.target.value || String(maxW), 10))}
                    />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Move Missed Check-ins Indicator down to the data table area (client view only) */}

      {/* Goals Editing - Doctor View Only */}
      {isDoctorView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Weight Change Goal - Left Side */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  🍗 Daily Protein Goal (grams)
                </h3>
                <p className="text-gray-600">
                  Set the daily protein target for {patientName || 'this client'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Goal Grams
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={proteinGoalGrams}
                      onChange={(e) => setProteinGoalGrams(e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium">g</span>
                  </div>
                </div>
                <button
                  onClick={handleProteinGoalUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Update Goal
                </button>
              </div>
            </div>
          </div>

          {/* Weight Change Goal */}
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

          {/* Resistance Training Goal + Blood Pressure Inputs */}
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

              {/* Body Composition inline editor for selected week (doctor view only) */}
              {tracksBodyComp && typeof selectedWeekNumber === 'number' && selectedWeekNumber >= 0 && isDoctorView && (
                <div className="mt-4 flex flex-wrap items-end gap-4 border-t pt-4">
                  {/* Visceral Fat Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visceral Fat Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(chartData.find(d => d.week_number === (selectedWeekNumber ?? -1)) as any)?.visceral_fat_level ?? ''}
                      onChange={async (e) => {
                        const rec = chartData.find(d => d.week_number === (selectedWeekNumber ?? -1))
                        if (!rec?.id) return
                        await updateHealthRecord(rec.id, { visceral_fat_level: e.target.value === '' ? null : parseFloat(e.target.value) } as any)
                        await loadChartData()
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="e.g., 10.50"
                    />
                  </div>
                  {/* Subcutaneous Fat Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subcutaneous Fat Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(chartData.find(d => d.week_number === (selectedWeekNumber ?? -1)) as any)?.subcutaneous_fat_level ?? ''}
                      onChange={async (e) => {
                        const rec = chartData.find(d => d.week_number === (selectedWeekNumber ?? -1))
                        if (!rec?.id) return
                        await updateHealthRecord(rec.id, { subcutaneous_fat_level: e.target.value === '' ? null : parseFloat(e.target.value) } as any)
                        await loadChartData()
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="e.g., 20.00"
                    />
                  </div>
                  {/* Belly Fat % */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Belly Fat %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(chartData.find(d => d.week_number === (selectedWeekNumber ?? -1)) as any)?.belly_fat_percent ?? ''}
                      onChange={async (e) => {
                        const rec = chartData.find(d => d.week_number === (selectedWeekNumber ?? -1))
                        if (!rec?.id) return
                        await updateHealthRecord(rec.id, { belly_fat_percent: e.target.value === '' ? null : parseFloat(e.target.value) } as any)
                        await loadChartData()
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="e.g., 32.25"
                    />
                  </div>
                  {/* Resting Heart Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resting HR (bpm)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="20"
                      max="120"
                      value={(chartData.find(d => d.week_number === (selectedWeekNumber ?? -1)) as any)?.resting_heart_rate ?? ''}
                      onChange={async (e) => {
                        const rec = chartData.find(d => d.week_number === (selectedWeekNumber ?? -1))
                        if (!rec?.id) return
                        await updateHealthRecord(rec.id, { resting_heart_rate: e.target.value === '' ? null : parseInt(e.target.value) } as any)
                        await loadChartData()
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="e.g., 58"
                    />
                  </div>
                  {/* Total Muscle Mass % */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Muscle Mass %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(chartData.find(d => d.week_number === (selectedWeekNumber ?? -1)) as any)?.total_muscle_mass_percent ?? ''}
                      onChange={async (e) => {
                        const rec = chartData.find(d => d.week_number === (selectedWeekNumber ?? -1))
                        if (!rec?.id) return
                        await updateHealthRecord(rec.id, { total_muscle_mass_percent: e.target.value === '' ? null : parseFloat(e.target.value) } as any)
                        await loadChartData()
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="e.g., 41.75"
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
        
        {/* Compute ranged data for charts and table */}
        {(() => { return null })()}
        {/**
         * Apply selected range to all visualizations below. Week 0 will be included
         * only if it falls within the selected range (or is explicitly provided by the data).
         */}
        {(() => {
          return null
        })()}

        {/* Row 1: Weight-Related Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WeightProjectionChart 
            data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData}
            unitSystem={unitSystem}
            initialWeek0Weight={stats.initialWeight || null}
            maxWeek={stats.currentWeek}
          />
          <PlateauPreventionChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
        </div>

        {/* Row 2A: Weight Trend (Full Width) */}
        <div className="grid grid-cols-1">
          <WeightTrendChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} unitSystem={unitSystem} />
        </div>

        {/* Row 2B: Waist Charts (Left: Waist Trend, Right: Plateau Prevention) */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WaistTrendChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} unitSystem={unitSystem} />
          <WaistPlateauPreventionChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
        </div>

        {/* Row 2.5: Blood Pressure Charts (conditional) */}
        {tracksBP && (
          <div className="grid lg:grid-cols-2 gap-6">
            <SystolicBloodPressureChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
            <DiastolicBloodPressureChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
          </div>
        )}

        {/* Row 3: New Dr. Nick Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <MorningFatBurnChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
          <BodyFatPercentageChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
        </div>

        {/* Row 3.5: Body Composition Section (conditional charts, excluding RHR) */}
        {tracksBodyComp && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <VisceralFatLevelChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
              <SubcutaneousFatLevelChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <BellyFatPercentChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
              <TotalMuscleMassPercentChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
            </div>
          </div>
        )}

        {/* RHR chart belongs with Metabolic Health and is always independent */}
        <div className="grid grid-cols-1">
          <RestingHeartRateChart data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} />
        </div>

        {/* Removed Nutrition/Strain charts here – now rendered inside Compliance Metrics section */}
        {/* Removed Sleep chart here – now rendered inside Compliance Metrics section */}

        {/* Compliance Metrics Table */}
        <div className="grid grid-cols-1">
          <ComplianceMetricsTable patientId={patientId} rangeStart={rangeStart ?? undefined as any} rangeEnd={rangeEnd ?? undefined as any} />
        </div>

        {/* Data Table - Different for Client vs Dr. Nick */}
        <DataTable 
          data={(rangeStart !== null && rangeEnd !== null) ? chartData.filter(d => d.week_number >= rangeStart && d.week_number <= rangeEnd) : chartData} 
          isDoctorView={isDoctorView}
          onDataUpdate={loadChartData}
          patientId={patientId}
          onSubmissionSelect={onSubmissionSelect}
          unitSystem={unitSystem}
          tracksBP={tracksBP}
          tracksBodyComp={tracksBodyComp}
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