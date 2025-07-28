// src/app/components/health/mondayMessageService.ts
// Monday Morning Message generation service

import { supabase } from '../auth/AuthContext'
import { getWeeklyDataForCharts, calculateLossPercentageRate } from './healthService'

export interface MondayMessageVariables {
  patient_first_name: string
  plateau_prevention_rate: number
  plateau_prevention_status: string
  trend_direction: 'trending up' | 'trending down' | 'stable'
  trend_description: 'actually speeding up' | 'slowing down' | 'maintaining pace'
  current_week_number: number
  week_count: number
  week_average_loss_rate: number
  overall_loss_rate_percent: number
  goal_loss_rate_percent: number
  total_waist_loss_inches: string
  protein_goal_grams: number
  protein_goal_lower_bound: number
  protein_goal_upper_bound: number
  weekly_compliance_percent: number
}

// Template for Monday morning message
const MESSAGE_TEMPLATE = `Good evening, {{patient_first_name}}.

I hope your week went well!

[We currently have you biased towards higher fat/lower carb which we will continue to maintain until I notice two concurrent weeks of you waking up in fat burn ('1' or a '2') every single morning. As that is achieved (which means your body has made exceptional progress is achieving competency in at least one end of the metabolic flexibility spectrum - oxidizing fat) throughout my constantly adapting plan for you, I will shift you slowly towards more and more carbs and less and less fat, trending upwards throughout your plan until you are very efficient at burning whatever you eat, fat or carbs, when within the context of negative energy balance. As this happens, every metabolic health parameter we have stored from your lab results you shared with me will improve.]

As it relates to your macronutrient targets (energy intake), I continue to input them in for the coming day the night prior and will also continue to adjust them downwards as you lose weight (because if I do not adjust them downwards throughout your plan, your weight loss will eventually stall and plateau) but before I do that, I *always* look for very specific checkpoints to occur: no hunger reported from you for a few weeks, you consistently hitting the macronutrient goals, consistent sleep cycle times (I don't care so much about recovery scores as that is not within your direct control…but your sleep times are within your direct control), and a consistent low intensity exercise regimen.

Looking at your updated and current "plateau prevention" data, you are currently at a {{plateau_prevention_rate}}% rate of loss over time {{plateau_prevention_status}} and you are {{trend_direction}} relative to last week, meaning that your rate of progress (for weight loss, but we can change this graph to waist circumference loss if you would like) is {{trend_description}} when considering the {{current_week_number}} week average of your weekly progress. Most currently, your {{week_count}} week average rate of loss is {{week_average_loss_rate}}% loss of your body weight per week. The four pillars of metabolic health all influence this number: nutrition, exercise, recovery, and stress management.

This changes weekly, please read thoroughly and respond to any questions I ask you within this:
_ _ _ _ _ _ _ _ _ _ _ _ _ _

You are currently losing weight *OVERALL* (since we started) at a rate of {{overall_loss_rate_percent}}% (your goal that you and I set together when you started was {{goal_loss_rate_percent}}% per week) of your total weight per week and are {{total_waist_loss_inches}} inches total on your waist. The "📊 Weight Loss Trend vs. Projections" columns of your dashboard will show you your estimated weight for whatever week in the future you'd like to know, given the current overall rate of weight loss I've shared with you.

Each and every one of us can only prioritize certain things in our lives so much compared to other more pressing demands and I never want to push you towards improvement of your metabolic health at a rate faster than you are comfortable with or, more importantly, feel that you cannot sustain long term so if you are happy with your current rate of progress then we do not need to change anything. If you would like to improve and accelerate your current rate of progress, I have a few recommendations for you.

The highest priority of all recommendations is continue to be compliant with your daily protein goal of {{protein_goal_grams}} grams (+/- 3 grams). Any daily protein intake of you outside of this range ({{protein_goal_lower_bound}} grams to {{protein_goal_upper_bound}} grams) is considered a failure of achieving the daily protein goal and, with it, the nutrition goal for the day (even if you have managed to stay within your net carb and fat allotments). I cannot overstate how important achieving this range of protein daily is. Otherwise, considering your daily net carb and fat goals, it is most ideal to stay under their daily recommendations but if satiety isn't present on any given day with lower than recommended carbs/fats and you are feeling particularly hungry, I would recommend you eat all the carbs/fats recommended (up to 3 grams above) as long as you have made sure that you will also eat all grams of your recommended daily protein goal (above) on that same day. Eating under your daily protein goal will leave you feeling hungry and MUCH more likely to overeat on fat and carbs. Considering these protein/carb/fat recommendations, your weekly macronutrient compliance this week was {{weekly_compliance_percent}}%. Improving, and then maintaining, weekly macronutrient compliance given the contribution that it plays in your overall compliance (% average days goal met on your Interface) would absolutely help accelerate your rate of progress.`

// Calculate all variables needed for the message
export async function calculateMessageVariables(
  userId: string, 
  weekNumber: number,
  nutritionComplianceDays: number
): Promise<MondayMessageVariables> {
  try {
    // Get patient profile data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, protein_goal_grams, weight_change_goal_percent')
      .eq('id', userId)
      .single()

    if (profileError) throw new Error('Failed to load patient profile')

    // Get historical health data
    const { data: healthData, error: healthError } = await getWeeklyDataForCharts(userId)
    if (healthError) throw new Error('Failed to load health data')

    if (!healthData || healthData.length === 0) {
      throw new Error('No health data available for calculations')
    }

    // Sort data by week number
    const sortedData = [...healthData].sort((a, b) => a.week_number - b.week_number)

    // Extract patient first name
    const patient_first_name = profileData.full_name?.split(' ')[0] || 'Patient'

    // Get Week 0 and current week data
    const weekZero = sortedData.find(d => d.week_number === 0)
    const currentWeek = sortedData.find(d => d.week_number === weekNumber)

    if (!currentWeek) throw new Error('Current week data not found')

    // Helper function to find last valid weight entry before a given week
    const findLastValidWeight = (beforeWeek: number) => {
      const validEntries = sortedData
        .filter(d => d.week_number < beforeWeek && d.weight !== null && d.weight !== undefined)
        .sort((a, b) => b.week_number - a.week_number) // Sort descending to get most recent first
      return validEntries.length > 0 ? validEntries[0] : null
    }

    // Calculate plateau prevention rate (current week loss rate)
    let plateau_prevention_rate = 0
    const lastValidWeightEntry = findLastValidWeight(weekNumber)
    
    if (lastValidWeightEntry?.weight && currentWeek.weight) {
      plateau_prevention_rate = calculateLossPercentageRate(currentWeek.weight, lastValidWeightEntry.weight)
      // Cap extreme rates (anything over 5% weekly is likely an error)
      if (Math.abs(plateau_prevention_rate) > 5) {
        plateau_prevention_rate = 0 // Reset to 0 if unrealistic
      }
    }

    // Calculate trend direction and description
    let trend_direction: 'trending up' | 'trending down' | 'stable' = 'stable'
    let trend_description: 'actually speeding up' | 'slowing down' | 'maintaining pace' = 'maintaining pace'
    
    if (weekNumber > 2 && currentWeek.weight) {
      // Find the two most recent valid weight entries before current week
      const recentValidEntries = sortedData
        .filter(d => d.week_number < weekNumber && d.weight !== null && d.weight !== undefined)
        .sort((a, b) => b.week_number - a.week_number) // Most recent first
        .slice(0, 2) // Get last 2 entries

      if (recentValidEntries.length >= 2) {
        const mostRecent = recentValidEntries[0] // Previous week with data
        const beforeThat = recentValidEntries[1] // Week before previous
        
        const currentLossRate = calculateLossPercentageRate(currentWeek.weight, mostRecent.weight)
        const previousLossRate = calculateLossPercentageRate(mostRecent.weight, beforeThat.weight)
        
        // Cap extreme rates for trend analysis
        if (Math.abs(currentLossRate) <= 5 && Math.abs(previousLossRate) <= 5) {
          if (currentLossRate > previousLossRate * 1.2) {
            trend_direction = 'trending up'
            trend_description = 'actually speeding up'
          } else if (currentLossRate < previousLossRate * 0.8) {
            trend_direction = 'trending down'
            trend_description = 'slowing down'
          }
        }
      }
    }

    // Calculate week count and average loss rate using plateau prevention chart method
    // Get all weeks with valid weight data
    const allWeeks = sortedData
      .filter(entry => entry.weight !== null && entry.weight !== undefined)
      .sort((a, b) => a.week_number - b.week_number)
    
    // Calculate individual week losses for all weeks (same as plateau prevention chart)
    const individualLosses: { week: number; individualLoss: number }[] = []
    
    for (let i = 1; i < allWeeks.length; i++) {
      const currentWeekData = allWeeks[i]
      const previousWeekData = allWeeks[i - 1]
      
      if (currentWeekData.weight && previousWeekData.weight && currentWeekData.week_number > 0) {
        // Individual week loss = ((previousWeight - currentWeight) / previousWeight) × 100
        // This matches the plateau prevention chart calculation exactly
        const individualLoss = ((previousWeekData.weight - currentWeekData.weight) / previousWeekData.weight) * 100
        
        individualLosses.push({
          week: currentWeekData.week_number,
          individualLoss: individualLoss
        })
      }
    }
    
    // Get the most recent weeks up to 4 weeks (current week + previous 3 weeks = 4 total)
    const currentWeekIndex = individualLosses.findIndex(loss => loss.week === weekNumber)
    let availableWeeks: typeof individualLosses = []
    
    if (currentWeekIndex >= 0) {
      // Take current week + up to 3 previous weeks
      const startIndex = Math.max(0, currentWeekIndex - 3)
      availableWeeks = individualLosses.slice(startIndex, currentWeekIndex + 1)
    }
    
    // Calculate dynamic week count and average
    const week_count = availableWeeks.length
    let week_average_loss_rate = 0
    
    if (week_count > 0) {
      const sum = availableWeeks.reduce((acc, loss) => acc + loss.individualLoss, 0)
      week_average_loss_rate = sum / week_count
    }

    // Calculate overall loss rate percentage
    let overall_loss_rate_percent = 0
    if (weekZero?.weight && currentWeek.weight && weekNumber > 0) {
      const totalLossPercent = ((weekZero.weight - currentWeek.weight) / weekZero.weight) * 100
      overall_loss_rate_percent = totalLossPercent / weekNumber
    }

    // Get goal loss rate from profile
    const goal_loss_rate_percent = profileData.weight_change_goal_percent || 1.0

    // Calculate total waist loss
    let total_waist_loss_inches = 'down 0'
    if (weekZero?.waist && currentWeek.waist) {
      const waistLoss = weekZero.waist - currentWeek.waist
      total_waist_loss_inches = waistLoss > 0 ? `down ${waistLoss.toFixed(1)}` : `up ${Math.abs(waistLoss).toFixed(1)}`
    }

    // Get protein goal and calculate bounds
    const protein_goal_grams = profileData.protein_goal_grams || 150
    const protein_goal_lower_bound = protein_goal_grams - 3
    const protein_goal_upper_bound = protein_goal_grams + 3

    // Calculate weekly compliance percentage
    const weekly_compliance_percent = Math.round((nutritionComplianceDays / 7) * 100 * 10) / 10

    // Generate plateau prevention status text
    let plateau_prevention_status: string
    if (plateau_prevention_rate > 0.5) {
      plateau_prevention_status = 'which is greater than 0% (making progress)'
    } else if (plateau_prevention_rate > 0) {
      plateau_prevention_status = 'which is slightly above 0% (minimal progress)'
    } else if (plateau_prevention_rate === 0) {
      plateau_prevention_status = '(no weight change this week)'
    } else {
      plateau_prevention_status = 'which indicates weight gain this week'
    }

    return {
      patient_first_name,
      plateau_prevention_rate: Math.round(plateau_prevention_rate * 100) / 100,
      plateau_prevention_status,
      trend_direction,
      trend_description,
      current_week_number: weekNumber,
      week_count,
      week_average_loss_rate: Math.round(week_average_loss_rate * 100) / 100, // Round to 2 decimal places
      overall_loss_rate_percent: Math.round(overall_loss_rate_percent * 100) / 100,
      goal_loss_rate_percent,
      total_waist_loss_inches,
      protein_goal_grams,
      protein_goal_lower_bound,
      protein_goal_upper_bound,
      weekly_compliance_percent
    }

  } catch (error) {
    console.error('Error calculating message variables:', error)
    throw error
  }
}

// Generate the complete Monday message
export async function generateMondayMessage(
  userId: string, 
  weekNumber: number,
  nutritionComplianceDays: number
): Promise<string> {
  try {
    const variables = await calculateMessageVariables(userId, weekNumber, nutritionComplianceDays)
    
    // Replace all template variables
    let message = MESSAGE_TEMPLATE
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`
      message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value.toString())
    })
    
    return message
  } catch (error) {
    console.error('Error generating Monday message:', error)
    throw error
  }
}

// Save Monday message to database
export async function saveMondayMessage(submissionId: string, content: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('health_data')
      .update({ monday_message_content: content })
      .eq('id', submissionId)

    if (error) throw error
  } catch (error) {
    console.error('Error saving Monday message:', error)
    throw error
  }
}

// Load existing Monday message
export async function loadMondayMessage(submissionId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('health_data')
      .select('monday_message_content')
      .eq('id', submissionId)
      .single()

    if (error) throw error
    return data?.monday_message_content || ''
  } catch (error) {
    console.error('Error loading Monday message:', error)
    return ''
  }
} 