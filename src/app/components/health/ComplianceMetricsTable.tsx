// src/app/components/health/ComplianceMetricsTable.tsx
// Table component for displaying compliance metrics

'use client'

import { useState, useEffect } from 'react'
import { getComplianceMetrics, ComplianceMetrics } from './complianceMetricsService'

interface ComplianceMetricsTableProps {
  patientId?: string // Optional patient ID for Dr. Nick's use
}

export default function ComplianceMetricsTable({ patientId }: ComplianceMetricsTableProps) {
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Determine if this is Dr. Nick's view
  const isDoctorView = !!patientId

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load metrics data
  useEffect(() => {
    if (mounted) {
      loadMetrics()
    }
  }, [mounted, patientId])

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const metricsData = await getComplianceMetrics(patientId)
      setMetrics(metricsData)
    } catch (error) {
      console.error('Error loading compliance metrics:', error)
      setMetrics({
        nutritionGoalMet: null,
        strainTargetGoalMet: null,
        poorRecoveryPercentage: null,
        waistHeightGoalDistance: null,
        hasEnoughData: false,
        dataPoints: 0,
        performanceMs: 0,
        error: error instanceof Error ? error.message : 'Failed to load metrics'
      })
    } finally {
      setLoading(false)
    }
  }

  // Don't render until mounted (avoids SSR mismatch)
  if (!mounted) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-4">
          <div className="text-gray-600">Loading compliance metrics...</div>
        </div>
      </div>
    )
  }

  // Helper function to format metric values
  const formatMetricValue = (value: number | null, suffix: string = '') => {
    if (value === null || value === undefined) return '—'
    return `${value.toFixed(2)}${suffix}`
  }

  // Helper function to get color based on metric performance
  const getMetricColor = (metricType: string, value: number | null) => {
    if (value === null) return 'text-gray-500'
    
    switch (metricType) {
      case 'strain':
        // Higher is better (green for 80%+, yellow for 60-79%, red for <60%)
        if (value >= 80) return 'text-green-700'
        if (value >= 60) return 'text-yellow-700'
        return 'text-red-700'
      
      case 'recovery':
        // Lower is better (green for <10%, yellow for 10-20%, red for >20%)
        if (value < 10) return 'text-green-700'
        if (value <= 20) return 'text-yellow-700'
        return 'text-red-700'
      
      case 'waist':
        // Closer to 0 is better (goal is 0.5 ratio)
        const distance = Math.abs(value)
        if (distance <= 0.05) return 'text-green-700'
        if (distance <= 0.1) return 'text-yellow-700'
        return 'text-red-700'
      
      default:
        return 'text-gray-700'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {isDoctorView ? "📊 Patient Compliance Metrics" : "📊 Your Compliance Metrics"}
      </h3>
      <p className="text-gray-600 mb-6">
        {isDoctorView 
          ? "Key performance indicators for this patient's program compliance and progress"
          : "Key performance indicators tracking your program compliance and health goals"
        }
      </p>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-600">Calculating compliance metrics...</div>
        </div>
      ) : metrics?.error ? (
        <div className="text-center py-8">
          <div className="text-red-600">{metrics.error}</div>
        </div>
      ) : !metrics?.hasEnoughData ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Not enough data for compliance calculations</div>
          <div className="text-sm text-gray-400 mt-1">
            {isDoctorView 
              ? "Patient needs to complete more weekly check-ins for meaningful metrics"
              : "Complete more weekly check-ins to see your compliance metrics"
            }
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            📊 Your Compliance Metrics
          </h2>
          
          {/* Top Row - Nutrition Goal Met (Full Width) */}
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-green-700 mb-2">% AVERAGE DAYS NUTRITION GOAL MET</h3>
              <div className="text-2xl font-bold text-green-900">
                {metrics.nutritionGoalMet !== null 
                  ? `${metrics.nutritionGoalMet.toFixed(1)}%` 
                  : 'N/A'
                }
              </div>
              <p className="text-xs text-green-600 mt-1">
                (Nutrition Days ÷ 7) × 100
              </p>
            </div>
          </div>

          {/* Bottom Row - Other Metrics (3 Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Strain Target Goal Met */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-700 mb-2">% AVERAGE DAYS STRAIN TARGET GOAL MET</h3>
              <div className="text-2xl font-bold text-blue-900">
                {metrics.strainTargetGoalMet !== null 
                  ? `${metrics.strainTargetGoalMet.toFixed(1)}%` 
                  : 'N/A'
                }
              </div>
              <p className="text-xs text-blue-600 mt-1">
                (Exercise Days ÷ 7) × 100
              </p>
            </div>

            {/* Poor Recovery Percentage */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-700 mb-2">% AVERAGE DAYS POOR RECOVERY</h3>
              <div className="text-2xl font-bold text-yellow-900">
                {metrics.poorRecoveryPercentage !== null 
                  ? `${metrics.poorRecoveryPercentage.toFixed(1)}%` 
                  : 'N/A'
                }
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                (Recovery Days ÷ Total Days) × 100
              </p>
            </div>

            {/* Waist/Height Goal Distance */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-700 mb-2">DISTANCE FROM WAIST/HEIGHT GOAL</h3>
              <div className="text-2xl font-bold text-blue-900">
                {metrics.waistHeightGoalDistance !== null 
                  ? (metrics.waistHeightGoalDistance >= 0 
                      ? `+${metrics.waistHeightGoalDistance.toFixed(3)}` 
                      : metrics.waistHeightGoalDistance.toFixed(3))
                  : 'N/A'
                }
              </div>
              <p className="text-xs text-blue-600 mt-1">
                (Current Waist ÷ Height) - 0.5
              </p>
            </div>
          </div>

        </>
      )}
    </div>
  )
} 