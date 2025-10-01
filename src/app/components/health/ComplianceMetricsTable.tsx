// src/app/components/health/ComplianceMetricsTable.tsx
// Table component for displaying compliance metrics

'use client'

import { useState, useEffect } from 'react'
import { getComplianceMetrics, ComplianceMetrics } from './complianceMetricsService'
import NutritionComplianceChart from './charts/NutritionComplianceChart'
import StrainGoalMetChart from './charts/StrainGoalMetChart'
import SleepConsistencyChart from './charts/SleepConsistencyChart'
import { getWeeklyDataForCharts, type WeeklyCheckin } from './healthService'
import { supabase } from '../auth/AuthContext'

interface ComplianceMetricsTableProps {
  patientId?: string // Optional patient ID for Dr. Nick's use
}

// Compliance Metrics Tooltip Component
function MetricsTooltip({ title, formula, explanation, interpretation, children }: { 
  title: string
  formula: string
  explanation: string
  interpretation: string
  children: React.ReactNode 
}) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block w-full">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help w-full"
      >
        {children}
      </div>
      
      {isVisible && (
        <div className="absolute z-10 w-80 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2">
          <div className="font-semibold text-blue-300 mb-2">{title}</div>
          
          <div className="mb-2">
            <div className="font-medium text-green-300 mb-1">Formula:</div>
            <div className="font-mono text-xs bg-gray-800 p-2 rounded">{formula}</div>
          </div>
          
          <div className="mb-2">
            <div className="font-medium text-yellow-300 mb-1">What it measures:</div>
            <div className="text-gray-300">{explanation}</div>
          </div>
          
          <div>
            <div className="font-medium text-purple-300 mb-1">Why it matters:</div>
            <div className="text-gray-300">{interpretation}</div>
          </div>
          
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

export default function ComplianceMetricsTable({ patientId }: ComplianceMetricsTableProps) {
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [proteinGoal, setProteinGoal] = useState<number | null>(null)
  const [chartData, setChartData] = useState<WeeklyCheckin[]>([])

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
      // Load compliance metrics
      const metricsData = await getComplianceMetrics(patientId)
      setMetrics(metricsData)

      // Load protein goal from profiles table
      let currentUserId = patientId
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        currentUserId = user?.id
      }

      if (currentUserId) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('protein_goal_grams')
          .eq('id', currentUserId)
          .single()
        
        if (profileError) {
          console.error('Error loading protein goal:', profileError)
          setProteinGoal(150) // Default fallback
        } else {
          setProteinGoal(profileData?.protein_goal_grams || 150)
        }
      }

      // Load weekly data for embedded charts
      const { data: weekly } = await getWeeklyDataForCharts(patientId)
      setChartData(weekly || [])
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
      setProteinGoal(150) // Default fallback
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
        {isDoctorView ? "📊 Client Compliance Metrics" : "📊 Your Compliance Metrics"}
      </h3>
      <p className="text-gray-600 mb-6">
        {isDoctorView 
          ? "Key performance indicators for this Client's program compliance and progress"
          : "Key performance indicators tracking your program compliance and health goals"
        }
        <span className="text-sm text-blue-600 ml-2">💡 Hover over each metric for detailed explanations</span>
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
              ? "Client needs to complete more weekly check-ins for meaningful metrics"
              : "Complete more weekly check-ins to see your compliance metrics"
            }
          </div>
        </div>
      ) : (
        <>
          
          {/* Nutrition KPI + Chart (Full Width) */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <MetricsTooltip
              title="Average Days Nutrition Goal Met"
              formula={`Daily Protein Goal: ${proteinGoal || 150}g (±3g) | Valid Range: ${(proteinGoal || 150) - 3}g - ${(proteinGoal || 150) + 3}g | Weekly Score: (Compliant Days ÷ 7) × 100`}
              explanation={`Compliance is BINARY for each day: either you hit your daily protein goal of ${proteinGoal || 150}g within ±3g range, or you didn't. Even being off by 5g means that day was non-compliant. This measures how many days per week you stayed within ${(proteinGoal || 150) - 3}g to ${(proteinGoal || 150) + 3}g protein intake.`}
              interpretation="Your protein goal is the highest priority of all nutrition recommendations. Hitting protein within the ±3g range every day is critical for maintaining muscle mass, controlling hunger, and preventing overeating on carbs/fats. This binary compliance system ensures precision in your nutrition execution."
            >
              <div className="bg-green-50 p-4 rounded-lg hover:bg-green-100 transition-colors">
                <h3 className="text-sm font-medium text-green-700 mb-2">% AVERAGE DAYS NUTRITION GOAL MET</h3>
                <div className="text-2xl font-bold text-green-900">
                  {metrics.nutritionGoalMet !== null 
                    ? `${metrics.nutritionGoalMet.toFixed(1)}%` 
                    : 'N/A'
                  }
                </div>
              </div>
            </MetricsTooltip>
            <NutritionComplianceChart data={chartData} />
          </div>

          {/* Strain KPI + Chart (Full Width) */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <MetricsTooltip
              title="Average Days Strain Target Goal Met"
              formula="(Purposeful Exercise Days ÷ 7 Days per Week) × 100"
              explanation="This tracks how consistently you're meeting your weekly exercise targets. It measures the percentage of days you completed purposeful physical activity versus your goal."
              interpretation="Regular exercise is crucial for maintaining muscle mass during weight loss, improving metabolic health, and optimizing body composition. Consistency is more important than intensity - aim for steady progress."
            >
              <div className="bg-blue-50 p-4 rounded-lg hover:bg-blue-100 transition-colors">
                <h3 className="text-sm font-medium text-blue-700 mb-2">% AVERAGE DAYS STRAIN TARGET GOAL MET</h3>
                <div className="text-2xl font-bold text-blue-900">
                  {metrics.strainTargetGoalMet !== null 
                    ? `${metrics.strainTargetGoalMet.toFixed(1)}%` 
                    : 'N/A'
                  }
                </div>
              </div>
            </MetricsTooltip>
            <StrainGoalMetChart data={chartData} />
          </div>

          {/* Poor Recovery KPI + Chart (Full Width) */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <MetricsTooltip
              title="Average Days Poor Recovery"
              formula="(Poor Recovery Days ÷ Total Days Tracked) × 100"
              explanation="This measures how often you experience poor recovery, which includes inadequate sleep, high stress, or feeling unrecovered. It's calculated across all your check-in periods."
              interpretation="Lower percentages are better. Poor recovery can sabotage weight loss efforts by affecting hormones, increasing cravings, and reducing motivation. Focus on sleep quality, stress management, and adequate rest between workouts."
            >
              <div className="bg-yellow-50 p-4 rounded-lg hover:bg-yellow-100 transition-colors">
                <h3 className="text-sm font-medium text-yellow-700 mb-2">% AVERAGE DAYS POOR RECOVERY</h3>
                <div className="text-2xl font-bold text-yellow-900">
                  {metrics.poorRecoveryPercentage !== null 
                    ? `${metrics.poorRecoveryPercentage.toFixed(1)}%` 
                    : 'N/A'
                  }
                </div>
              </div>
            </MetricsTooltip>
            <SleepConsistencyChart data={chartData} />
          </div>

          {/* Waist/Height Goal KPI removed per request (now reflected in Waist Trend chart pill) */}

        </>
      )}
    </div>
  )
} 