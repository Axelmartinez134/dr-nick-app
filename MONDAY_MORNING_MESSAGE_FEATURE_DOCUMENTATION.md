# 📞 MONDAY MORNING MESSAGE FEATURE - COMPLETE DOCUMENTATION
## Dr. Nick's Health Tracker - Automated Personalized Message System

---

## **📋 TABLE OF CONTENTS**
1. [Feature Overview](#feature-overview)
2. [Implementation Architecture](#implementation-architecture)
3. [Database Schema](#database-schema)
4. [Template & Calculations](#template--calculations)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Usage Instructions](#usage-instructions)
7. [Development History](#development-history)
8. [Future Enhancements](#future-enhancements)

---

## **🎯 FEATURE OVERVIEW**

### **Purpose**
The Monday Morning Message feature generates personalized, data-driven messages that Dr. Nick sends to patients every Monday morning. These messages contain:
- Current plateau prevention metrics
- Progress analysis and trend descriptions  
- Overall weight loss statistics
- Protein goal compliance tracking
- Personalized recommendations based on real patient data

### **Key Benefits**
- **Automated Personalization**: Uses actual patient data for calculations
- **Consistent Communication**: Standardized weekly touchpoint  
- **Data-Driven Insights**: Real-time analysis of patient progress
- **Time Saving**: Reduces manual message composition time
- **Accurate Calculations**: Handles complex weight loss percentage calculations

---

## **🏗️ IMPLEMENTATION ARCHITECTURE**

### **File Structure**
```
src/app/components/health/
├── mondayMessageService.ts           # Core service with calculations
├── hooks/useMondayMessageAutoSave.tsx  # Auto-save functionality
└── DrNickSubmissionReview.tsx        # UI integration
```

### **Core Components**

#### **1. mondayMessageService.ts**
- **Purpose**: Contains all calculation logic and message generation
- **Key Functions**:
  - `calculateMessageVariables()` - Computes all placeholder values
  - `generateMondayMessage()` - Creates final message from template
  - `saveMondayMessage()` - Stores message to database
  - `loadMondayMessage()` - Retrieves existing message

#### **2. useMondayMessageAutoSave.tsx**
- **Purpose**: Provides auto-save functionality with status indicators
- **Features**: 
  - 2-second debounced saving
  - Status tracking: "Typing..." → "Saving..." → "Saved ✓"
  - Error handling and retry logic

#### **3. DrNickSubmissionReview.tsx Integration**
- **Purpose**: UI components and user interaction
- **Features**:
  - "🔄 Generate Fresh Message" button with cache clearing
  - Auto-save status display
  - Load existing messages on component mount

---

## **🗄️ DATABASE SCHEMA**

### **Required Columns**

#### **profiles Table**
```sql
-- Added for Monday Message feature
protein_goal_grams INTEGER DEFAULT 150;
-- Existing columns used:
full_name TEXT;
weight_change_goal_percent DECIMAL;
```

#### **health_data Table**  
```sql
-- Added for Monday Message feature
monday_message_content TEXT;
-- Existing columns used:
user_id UUID;
week_number INTEGER;
weight DECIMAL;
waist DECIMAL;
initial_weight DECIMAL;
```

### **Migration SQL**
```sql
-- Add protein goal to profiles table  
ALTER TABLE profiles ADD COLUMN protein_goal_grams INTEGER DEFAULT 150;
COMMENT ON COLUMN profiles.protein_goal_grams IS 'Daily protein target in grams for this patient';

-- Add Monday message storage to health_data table
ALTER TABLE health_data ADD COLUMN monday_message_content TEXT;
COMMENT ON COLUMN health_data.monday_message_content IS 'Generated Monday morning message content for this weekly submission';

-- Set default protein goals for existing patients
UPDATE profiles SET protein_goal_grams = 150 WHERE protein_goal_grams IS NULL;
```

---

## **📝 TEMPLATE & CALCULATIONS**

### **Complete Message Template**
```
Good evening, {{patient_first_name}}.

I hope your week went well!

[We currently have you biased towards higher fat/lower carb which we will continue to maintain until I notice two concurrent weeks of you waking up in fat burn ('1' or a '2') every single morning. As that is achieved (which means your body has made exceptional progress is achieving competency in at least one end of the metabolic flexibility spectrum - oxidizing fat) throughout my constantly adapting plan for you, I will shift you slowly towards more and more carbs and less and less fat, trending upwards throughout your plan until you are very efficient at burning whatever you eat, fat or carbs, when within the context of negative energy balance. As this happens, every metabolic health parameter we have stored from your lab results you shared with me will improve.]

As it relates to your macronutrient targets (energy intake), I continue to input them in for the coming day the night prior and will also continue to adjust them downwards as you lose weight (because if I do not adjust them downwards throughout your plan, your weight loss will eventually stall and plateau) but before I do that, I *always* look for very specific checkpoints to occur: no hunger reported from you for a few weeks, you consistently hitting the macronutrient goals, consistent sleep cycle times (I don't care so much about recovery scores as that is not within your direct control…but your sleep times are within your direct control), and a consistent low intensity exercise regimen.

Looking at your updated and current "plateau prevention" data, you are currently at a {{plateau_prevention_rate}}% rate of loss over time {{plateau_prevention_status}} and you are {{trend_direction}} relative to last week, meaning that your rate of progress (for weight loss, but we can change this graph to waist circumference loss if you would like) is {{trend_description}} when considering the {{current_week_number}} week average of your weekly progress. Most currently, your {{current_week_number}} week average rate of loss is {{four_week_average_loss_rate}}% loss of your body weight per week. The four pillars of metabolic health all influence this number: nutrition, exercise, recovery, and stress management.

This changes weekly, please read thoroughly and respond to any questions I ask you within this:
_ _ _ _ _ _ _ _ _ _ _ _ _ _

You are currently losing weight *OVERALL* (since we started) at a rate of {{overall_loss_rate_percent}}% (your goal that you and I set together when you started was {{goal_loss_rate_percent}}% per week) of your total weight per week and are {{total_waist_loss_inches}} inches total on your waist. The "📊 Weight Loss Trend vs. Projections" columns of your dashboard will show you your estimated weight for whatever week in the future you'd like to know, given the current overall rate of weight loss I've shared with you.

Each and every one of us can only prioritize certain things in our lives so much compared to other more pressing demands and I never want to push you towards improvement of your metabolic health at a rate faster than you are comfortable with or, more importantly, feel that you cannot sustain long term so if you are happy with your current rate of progress then we do not need to change anything. If you would like to improve and accelerate your current rate of progress, I have a few recommendations for you.

The highest priority of all recommendations is continue to be compliant with your daily protein goal of {{protein_goal_grams}} grams (+/- 3 grams). Any daily protein intake of you outside of this range ({{protein_goal_lower_bound}} grams to {{protein_goal_upper_bound}} grams) is considered a failure of achieving the daily protein goal and, with it, the nutrition goal for the day (even if you have managed to stay within your net carb and fat allotments). I cannot overstate how important achieving this range of protein daily is. Otherwise, considering your daily net carb and fat goals, it is most ideal to stay under their daily recommendations but if satiety isn't present on any given day with lower than recommended carbs/fats and you are feeling particularly hungry, I would recommend you eat all the carbs/fats recommended (up to 3 grams above) as long as you have made sure that you will also eat all grams of your recommended daily protein goal (above) on that same day. Eating under your daily protein goal will leave you feeling hungry and MUCH more likely to overeat on fat and carbs. Considering these protein/carb/fat recommendations, your weekly macronutrient compliance this week was {{weekly_compliance_percent}}%. Improving, and then maintaining, weekly macronutrient compliance given the contribution that it plays in your overall compliance (% average days goal met on the spreadsheet included below) would absolutely help accelerate your rate of progress.
```

### **Placeholder Variables & Calculations**

#### **Basic Patient Information**
- **`{{patient_first_name}}`**
  - **Source**: `profiles.full_name`
  - **Calculation**: `profileData.full_name?.split(' ')[0] || 'Patient'`
  - **Example**: "Test" from "Test Patient"

#### **Plateau Prevention Metrics**
- **`{{plateau_prevention_rate}}`**
  - **Purpose**: Current week weight loss percentage
  - **Calculation**: 
    ```typescript
    const lastValidWeightEntry = findLastValidWeight(weekNumber)
    if (lastValidWeightEntry?.weight && currentWeek.weight) {
      plateau_prevention_rate = calculateLossPercentageRate(currentWeek.weight, lastValidWeightEntry.weight)
      // Cap extreme rates (anything over 5% weekly)
      if (Math.abs(plateau_prevention_rate) > 5) {
        plateau_prevention_rate = 0
      }
    }
    ```
  - **Example**: "3.52"

- **`{{plateau_prevention_status}}`**
  - **Purpose**: Contextual description of the rate
  - **Calculation**:
    ```typescript
    if (plateau_prevention_rate > 0.5) {
      plateau_prevention_status = 'which is greater than 0% (making progress)'
    } else if (plateau_prevention_rate > 0) {
      plateau_prevention_status = 'which is slightly above 0% (minimal progress)'
    } else if (plateau_prevention_rate === 0) {
      plateau_prevention_status = '(no weight change this week)'
    } else {
      plateau_prevention_status = 'which indicates weight gain this week'
    }
    ```
  - **Example**: "which is greater than 0% (making progress)"

#### **Trend Analysis**
- **`{{trend_direction}}`**
  - **Options**: 'trending up' | 'trending down' | 'stable'
  - **Calculation**: Compares current loss rate vs previous loss rate
    ```typescript
    if (currentLossRate > previousLossRate * 1.2) {
      trend_direction = 'trending up'
    } else if (currentLossRate < previousLossRate * 0.8) {
      trend_direction = 'trending down'  
    } else {
      trend_direction = 'stable'
    }
    ```

- **`{{trend_description}}`**
  - **Options**: 'actually speeding up' | 'slowing down' | 'maintaining pace'
  - **Calculation**: Correlates with trend_direction
  - **Example**: "maintaining pace"

#### **Time Period Variables**
- **`{{current_week_number}}`**
  - **Source**: Current submission week number
  - **Calculation**: Direct from `submission.week_number`
  - **Example**: "23"

#### **Average Loss Calculations**
- **`{{four_week_average_loss_rate}}`**
  - **Purpose**: Average loss rate over recent 4 weeks (or available weeks)
  - **Calculation**:
    ```typescript
    const weeksToAverage = Math.min(weekNumber, 4)
    const validWeightEntries = sortedData
      .filter(d => d.week_number > weekNumber - weeksToAverage && d.week_number <= weekNumber)
      .filter(d => d.weight !== null && d.weight !== undefined)
    
    const lossRates = []
    for (let i = 1; i < validWeightEntries.length; i++) {
      const lossRate = calculateLossPercentageRate(current.weight, previous.weight)
      if (Math.abs(lossRate) <= 5) { // Filter extreme rates
        lossRates.push(lossRate)
      }
    }
    four_week_average_loss_rate = lossRates.reduce((sum, rate) => sum + rate, 0) / lossRates.length
    ```

#### **Overall Progress Metrics**
- **`{{overall_loss_rate_percent}}`**
  - **Purpose**: Average weekly loss rate since starting (Week 0)
  - **Calculation**:
    ```typescript
    if (weekZero?.weight && currentWeek.weight && weekNumber > 0) {
      const totalLossPercent = ((weekZero.weight - currentWeek.weight) / weekZero.weight) * 100
      overall_loss_rate_percent = totalLossPercent / weekNumber
    }
    ```
  - **Example**: "0.78"

- **`{{goal_loss_rate_percent}}`**
  - **Source**: `profiles.weight_change_goal_percent`
  - **Calculation**: Direct database value
  - **Example**: "5"

- **`{{total_waist_loss_inches}}`**
  - **Purpose**: Total waist circumference change since Week 0
  - **Calculation**:
    ```typescript
    if (weekZero?.waist && currentWeek.waist) {
      const waistLoss = weekZero.waist - currentWeek.waist
      total_waist_loss_inches = waistLoss > 0 ? `down ${waistLoss.toFixed(1)}` : `up ${Math.abs(waistLoss).toFixed(1)}`
    }
    ```
  - **Example**: "down 24.0"

#### **Protein Goal Variables**
- **`{{protein_goal_grams}}`**
  - **Source**: `profiles.protein_goal_grams`
  - **Default**: 150
  - **Example**: "150"

- **`{{protein_goal_lower_bound}}`**
  - **Calculation**: `protein_goal_grams - 3`
  - **Example**: "147"

- **`{{protein_goal_upper_bound}}`**
  - **Calculation**: `protein_goal_grams + 3`
  - **Example**: "153"

#### **Compliance Metrics**
- **`{{weekly_compliance_percent}}`**
  - **Purpose**: Nutrition compliance percentage for current week
  - **Source**: Dr. Nick's manual input (nutrition compliance days)
  - **Calculation**: `(nutritionComplianceDays / 7) * 100`
  - **Example**: "57.1"

---

## **🚨 TROUBLESHOOTING GUIDE**

### **Common Issues & Solutions**

#### **1. Contradictory Plateau Prevention Text**
**Symptoms**: Message shows "0% rate MUCH greater than 0%" or similar illogical statements
**Root Cause**: Using old cached template before fixes were implemented
**Solution**: 
- Click "🔄 Generate Fresh Message" to clear cache and regenerate
- Check that `plateau_prevention_status` variable is being calculated correctly

#### **2. Extreme Loss Rates (>5% weekly)**
**Symptoms**: Message shows unrealistic loss rates like "6.48% per week"
**Root Cause**: 
- Null weights in recent weeks causing calculation errors
- Data entry errors (weight fluctuations due to scale differences)
**Solution**:
- System automatically caps rates >5% to 0%
- Verify weight data accuracy in recent submissions
- Check for null weight entries that break calculations

#### **3. Cached Message Loading Instead of Fresh Generation**
**Symptoms**: Old message content appears even after clicking "Generate Message"
**Root Cause**: System loading existing `monday_message_content` from database
**Solution**:
- "🔄 Generate Fresh Message" button now clears cache first
- Alternatively, clear cache manually: `UPDATE health_data SET monday_message_content = NULL WHERE id = '[submission_id]'`

#### **4. Missing or Null Weight Data**
**Symptoms**: Variables show as 0 or undefined, calculations fail
**Root Cause**: Patient hasn't entered weight for current week or recent weeks
**Solution**:
- System uses `findLastValidWeight()` function to find most recent valid entry
- Ensure patients consistently enter weight data
- Check Week 0 baseline data exists

#### **5. Import/Build Errors**
**Symptoms**: Module not found errors, TypeScript errors
**Root Cause**: Incorrect import paths or missing function exports
**Solution**:
- Verify import paths: `import { generateMondayMessage, loadMondayMessage, saveMondayMessage } from './mondayMessageService'`
- Check that all functions are properly exported from mondayMessageService.ts
- Clear build cache: `rm -rf .next && npm run build`

### **Debugging Tools**

#### **Console Logging**
The generate function includes detailed logging:
```javascript
console.log('Clearing existing Monday message cache...')
console.log('Generating fresh Monday message with latest data...')
console.log('Fresh Monday message generated successfully')
```

#### **Browser Developer Tools**
- Check Network tab for API calls to Supabase
- Monitor Console for error messages during generation
- Inspect auto-save status in UI

#### **Database Queries for Debugging**
```sql
-- Check patient's weight data
SELECT week_number, weight, waist, date 
FROM health_data 
WHERE user_id = '[patient_id]' 
ORDER BY week_number;

-- Check existing Monday message
SELECT week_number, monday_message_content 
FROM health_data 
WHERE user_id = '[patient_id]' 
AND monday_message_content IS NOT NULL;

-- Check protein goal
SELECT full_name, protein_goal_grams, weight_change_goal_percent 
FROM profiles 
WHERE id = '[patient_id]';
```

---

## **📖 USAGE INSTRUCTIONS**

### **For Dr. Nick (Primary User)**

#### **Generating a Monday Message**
1. Navigate to Dr. Nick's Queue
2. Select a patient submission needing review
3. Scroll to "📞 Monday Morning Start Message" section
4. **IMPORTANT**: Enter "Nutrition Compliance Days" (required for calculations)
5. Click "🔄 Generate Fresh Message" button
6. Review generated message and edit as needed
7. Message auto-saves every 2 seconds with status indicators

#### **Best Practices**
- Always enter nutrition compliance days before generating
- Review calculations for reasonableness (no extreme rates)
- Edit generated content for patient-specific adjustments
- Save regularly (Ctrl+S for manual save)

#### **Editing Generated Messages**
- All template variables can be manually adjusted after generation
- Focus on personalizing the recommendations section
- Verify patient name and metrics are accurate
- Use auto-save status to confirm changes are saved

### **For Developers**

#### **Adding New Template Variables**
1. Add to `MondayMessageVariables` interface
2. Implement calculation logic in `calculateMessageVariables()`
3. Add placeholder to `MESSAGE_TEMPLATE`
4. Update documentation

#### **Modifying Calculations**
- All calculation logic is in `mondayMessageService.ts`
- Use helper functions like `findLastValidWeight()` for data safety
- Cap extreme values for medical safety
- Add console logging for debugging

---

## **📚 DEVELOPMENT HISTORY**

### **Phase 1: Initial Implementation**
- **Goal**: Create basic Monday message generation system
- **Challenges**: Template string replacement, database integration
- **Solution**: Service-based architecture with TypeScript interfaces

### **Phase 2: Auto-Save Integration**
- **Goal**: Add Notes-like auto-save functionality
- **Challenges**: Debounced saving, status indicators
- **Solution**: Custom hook `useMondayMessageAutoSave` based on existing notes patterns

### **Phase 3: Calculation Bug Fixes**
- **Major Issues Discovered**:
  1. Contradictory plateau prevention text ("0% MUCH greater than 0%")
  2. Extreme loss rates (6.48% weekly - medically dangerous)
  3. Null weight handling causing crashes
  4. Trend analysis using exact previous week (could be null)
  
- **Solutions Implemented**:
  1. Dynamic `plateau_prevention_status` text generation
  2. Rate capping at 5% maximum for safety
  3. `findLastValidWeight()` helper function
  4. Robust trend analysis with valid entry filtering

### **Phase 4: Cache Management**
- **Problem**: System loading cached messages instead of generating fresh
- **Solution**: "🔄 Generate Fresh Message" button that clears cache first
- **Implementation**: 
  ```typescript
  await saveMondayMessage(submission.id, '') // Clear cache
  const message = await generateMondayMessage(...) // Generate fresh
  ```

### **Key Learnings**
- Medical data requires conservative calculations (cap extreme values)
- Always handle null/missing data gracefully
- Cache clearing is essential for testing and accuracy
- User feedback through auto-save status improves confidence

---

## **🔮 FUTURE ENHANCEMENTS**

### **Potential Improvements**

#### **1. Enhanced Calculations**
- Trend analysis over longer periods (8-12 weeks)
- Seasonal weight fluctuation accounting
- Body composition analysis integration
- Exercise correlation with loss rates

#### **2. Template Customization**
- Patient-specific template variations
- Goal-based message modifications (maintenance vs loss)
- Conditional sections based on progress patterns

#### **3. Automation Features**
- Scheduled message generation (Sunday nights)
- Email integration for direct patient delivery
- Template A/B testing for effectiveness

#### **4. Analytics & Reporting**
- Message engagement tracking
- Patient response correlation with progress
- Template effectiveness analysis

#### **5. Advanced Data Integration**
- Whoop data correlation
- Sleep pattern impact analysis
- Nutrition log integration for automatic compliance

### **Technical Debt**
- Error boundary implementation for calculation failures
- Unit tests for calculation functions
- Performance optimization for large datasets
- Internationalization support

---

## **📞 SUPPORT & MAINTENANCE**

### **Key Files to Monitor**
- `mondayMessageService.ts` - Core calculation logic
- `DrNickSubmissionReview.tsx` - UI integration
- `useMondayMessageAutoSave.tsx` - Auto-save functionality

### **Regular Maintenance Tasks**
- Monitor for calculation edge cases with new patient data
- Review extreme rates and adjust caps if needed
- Update template based on Dr. Nick's feedback
- Performance monitoring for large patient datasets

### **Emergency Procedures**
- If calculations fail: Clear cache and regenerate
- If data is missing: Verify patient has completed recent submissions
- If auto-save fails: Use manual Ctrl+S and check network connectivity

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: March 2025  
**Feature Status**: ✅ Production Ready 