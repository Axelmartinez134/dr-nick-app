# Monday Morning Start Message System - Implementation Guide

## 📋 **Overview**

This document outlines the requirements for implementing a dynamic Monday Morning Start Message system in Dr. Nick's health tracker application. This feature will automatically generate personalized messages for clients based on their historical health data and progress metrics.

## 🎯 **Purpose & Workflow**

### **Message Sequence**
The Monday Morning Start Message is the **first** communication sent to clients, followed by:
1. **Start Message** (Monday morning - personalized with data)
2. **Weekly Analysis** (Dr. Nick's weekly Whoop analysis)
3. **Monthly Analysis** (Dr. Nick's monthly Whoop analysis)

### **Location in Interface**
- **Current Location**: Section 3 in `DrNickSubmissionReview.tsx`
- **Position**: Between "📷 Client Submission Images" and "👨‍⚕️ Your Professional Analysis"
- **Display**: Full-width section with placeholder implementation

## 🏗️ **Current Implementation Status**

### **Completed (Placeholder)**
- ✅ UI section added to review interface
- ✅ State management (`startMessage` state variable)
- ✅ Manual text input textarea
- ✅ Informational banner about future dynamic features
- ✅ Message flow visualization

### **To Be Implemented (Future)**
- ❌ Dynamic data extraction from patient charts
- ❌ Template variable substitution system
- ❌ Automated metric calculations
- ❌ Historical trend analysis algorithms
- ❌ Database storage for message templates
- ❌ Message sending functionality

## 📊 **Data Sources & Variables**

### **Patient Chart Data Required**
The system needs to pull from existing `health_data` table and calculated metrics:

#### **Basic Patient Info**
- `{{patientfirstname}}` - From `profiles.first_name`
- `{{patientlastname}}` - From `profiles.last_name`

#### **Weight Loss Metrics**
- `{{currentlossrate}}` - Current percentage loss rate per week
- `{{overalllossrate}}` - Overall loss rate since program start
- `{{twoweekaverage}}` - Two-week average loss rate
- `{{waistloss}}` - Total waist circumference change in inches
- `{{weekssincestarttime}}` - Weeks since program began

#### **Plateau Prevention Data**
- `{{plateaurate}}` - Rate from plateau prevention chart
- `{{plateautrend}}` - Trending up/down relative to last week
- `{{plateaustatus}}` - Current plateau status description

#### **Compliance Tracking**
- `{{proteingoal}}` - Daily protein target (e.g., "205 grams")
- `{{proteintolerance}}` - Acceptable range (e.g., "±3 grams")
- `{{compliancerate}}` - Weekly macronutrient compliance percentage
- `{{weeklycompliancedays}}` - Number of compliant days this week
- `{{overallcompliance}}` - Average compliance since start

#### **Metabolic Flexibility**
- `{{lumengoal}}` - Target Lumen readings ("1" or "2" fat burn)
- `{{lumenstreakdays}}` - Consecutive days of target readings
- `{{metabolicstatus}}` - Current metabolic flexibility status

#### **Exercise & Recovery**
- `{{exercisegoal}}` - Current exercise recommendations
- `{{sleepgoal}}` - Sleep consistency targets
- `{{recoverytrend}}` - Recovery score trends

## 📝 **Complete Message Template**

```
Good evening, {{patientfirstname}}.

I hope your week went well!

We currently have you biased towards higher fat/lower carb which we will continue to maintain until I notice two concurrent weeks of you waking up in fat burn ('1' or a '2') every single morning. Once that is achieved (which means your body has made exceptional progress is achieving competency in at one end of the metabolic flexibility spectrum - oxidizing fat - I will shift you slowly towards more carbs and slightly lower fat, trending upwards throughout your plan until you are very efficient at burning whatever you eat, fat or carbs, when within the context of negative energy balance. As this happens, every metabolic health parameter we have stored from your lab results you shared with me will improve.

As it relates to your macronutrient targets (energy intake), I continue to input them in for the coming day the night prior and will also continue to adjust them downwards as you lose weight (because if I do not adjust them downwards throughout your plan, your weight loss will eventually stall and plateau) but before I do that, I *always* look for very specific checkpoints to occur: no hunger reported from you for a few weeks, you consistently hitting the macronutrient goals, consistent sleep cycle times (I don't care so much about recovery scores as that is not within your direct control…but your sleep times are within your direct control), and a consistent low intensity exercise regimen.

Looking at your updated and current "plateau prevention" data, you are currently at a "% rate of loss over time" MUCH greater than 0% and you are trending up relative to last week, meaning that your rate of progress (for weight loss, but we can change this graph to waist circumference loss if you would like) is actually speeding up when considering the two week average of your weekly progress. Most currently, your two week average rate of loss is {{currentlossrate}}% loss of your body weight per week. The four pillars of metabolic health all influence this number: nutrition, exercise, recovery, and stress management.

This changes weekly, please read thoroughly and respond to any questions I ask you within this:
_ _ _ _ _ _ _ _ _ _ _ _ _ _

You are currently losing weight *OVERALL* (since we started) at a rate of ~{{currentlossrate}}% (your goal that you and I set together when you started was 1% per week) of your total weight per week and are down {{waistloss}} inches total on your waist. The "Weekly Weight Projections" columns of the spreadsheet picture I've shared with you will show you your estimated weight for whatever week in the future you'd like to know, given the current overall rate of weight loss I've shared with you.

Each and every one of us can only prioritize certain things in our lives so much compared to other more pressing demands and I never want to push you towards improvement of your metabolic health at a rate faster than you are comfortable with or, more importantly, feel that you cannot sustain long term so if you are happy with your current rate of progress then we do not need to change anything. If you would like to improve and accelerate your current rate of progress, I have a few recommendations for you. The highest priority of all recommendations is continue to be compliant with your daily protein goal of {{proteingoal}} grams (+/- {{proteintolerance}} grams). Any daily protein intake of you outside of this range ({{proteinlowerbound}} grams to {{proteinupperbound}} grams) is considered a failure of achieving the daily protein goal and, with it, the nutrition goal for the day (even if you have managed to stay within your net carb and fat allotments). I cannot overstate how important achieving this range of protein daily is. Otherwise, considering your daily net carb and fat goals, it is most ideal to stay under their daily recommendations but if satiety isn't present on any given day with lower than recommended carbs/fats and you are feeling particularly hungry, I would recommend you eat all the carbs/fats recommended (up to 3 grams above) as long as you have made sure that you will also eat all grams of your recommended daily protein goal (above) on that same day. Eating under your daily protein goal will leave you feeling hungry and MUCH more likely to overeat on fat and carbs. Considering these protein/carb/fat recommendations, your weekly macronutrient compliance this week was {{compliancerate}}%. Improving, and then maintaining, weekly macronutrient compliance given the contribution that it plays in your overall compliance (% average days goal met on the spreadsheet included below) would absolutely help accelerate your rate of progress.
```

## 💾 **Database Considerations**

### **New Fields Required**
Consider adding to `health_data` table or creating new tables:

```sql
-- Potential new columns for health_data
ALTER TABLE health_data ADD COLUMN monday_message_content TEXT;
ALTER TABLE health_data ADD COLUMN monday_message_sent_at TIMESTAMP;
ALTER TABLE health_data ADD COLUMN protein_goal_grams INTEGER;
ALTER TABLE health_data ADD COLUMN macronutrient_compliance_rate DECIMAL(5,2);

-- Or create dedicated table
CREATE TABLE monday_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  week_number INTEGER,
  message_content TEXT,
  template_variables JSONB,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Calculation Functions Needed**
Create service functions in `healthService.ts`:

```typescript
// Example function signatures for implementation
export async function calculateCurrentLossRate(userId: string): Promise<number>
export async function calculateTwoWeekAverage(userId: string): Promise<number>
export async function calculateComplianceRate(userId: string, weekNumber: number): Promise<number>
export async function getPlateauPreventionData(userId: string): Promise<PlateauData>
export async function generateMondayMessage(userId: string, weekNumber: number): Promise<string>
export async function populateMessageTemplate(template: string, variables: MessageVariables): Promise<string>
```

## 🔧 **Implementation Architecture**

### **Phase 1: Data Calculation System**
1. Create calculation functions for all required metrics
2. Implement historical data analysis algorithms
3. Build plateau prevention rate calculations
4. Add compliance tracking functionality

### **Phase 2: Template Engine**
1. Create template variable substitution system
2. Build message template management
3. Implement variable validation and error handling
4. Add preview functionality

### **Phase 3: UI Integration**
1. Replace manual textarea with dynamic generation
2. Add template preview with populated variables
3. Implement edit capabilities for generated messages
4. Add message history and versioning

### **Phase 4: Automation & Delivery**
1. Schedule automatic message generation
2. Integrate with communication system
3. Add delivery tracking and status
4. Implement A/B testing for message effectiveness

## 🎯 **Key Components to Develop**

### **MessageTemplateEngine.ts**
```typescript
interface MessageVariables {
  patientfirstname: string;
  currentlossrate: number;
  proteingoal: number;
  compliancerate: number;
  waistloss: number;
  // ... all other variables
}

class MessageTemplateEngine {
  static populateTemplate(template: string, variables: MessageVariables): string
  static validateVariables(variables: MessageVariables): boolean
  static getRequiredVariables(template: string): string[]
}
```

### **MetricsCalculationService.ts**
```typescript
class MetricsCalculationService {
  static async calculateLossRates(userId: string): Promise<LossRateMetrics>
  static async calculateCompliance(userId: string, weekNumber: number): Promise<ComplianceMetrics>
  static async analyzePlateauPrevention(userId: string): Promise<PlateauMetrics>
  static async generateAllMetrics(userId: string, weekNumber: number): Promise<MessageVariables>
}
```

## 📋 **File Locations**

### **Current Implementation**
- **UI Component**: `src/app/components/health/DrNickSubmissionReview.tsx` (Section 3)
- **State Management**: `startMessage` state variable added

### **Future Implementation Files**
- **Template Engine**: `src/app/components/health/MessageTemplateEngine.ts`
- **Metrics Service**: `src/app/components/health/MetricsCalculationService.ts`
- **Message Service**: `src/app/components/health/mondayMessageService.ts`
- **Types**: `src/app/components/health/messageTypes.ts`

## 🚀 **Getting Started with Implementation**

1. **Review this document** thoroughly to understand all requirements
2. **Examine current chart calculations** in `ChartsDashboard.tsx` for metric calculation patterns
3. **Study the plateau prevention logic** in existing chart components
4. **Plan database schema changes** for storing message data
5. **Start with metrics calculation functions** before building the template engine
6. **Test with real patient data** to ensure accurate calculations
7. **Implement template substitution** system with proper error handling

## 🔍 **Testing Considerations**

- Test with multiple patient profiles and data scenarios
- Validate calculation accuracy against manual calculations
- Ensure template variables handle edge cases (null/empty data)
- Test message generation performance with large datasets
- Verify proper formatting and readability of generated messages

## 📞 **Contact & Questions**

This is a complex feature that integrates multiple data sources and calculations. When implementing, pay special attention to:
- **Data accuracy** - Patient health decisions depend on correct calculations
- **Performance** - Message generation should be fast for good UX
- **Error handling** - Graceful degradation when data is missing
- **Template flexibility** - System should support different message formats

---

**Status**: Placeholder implementation complete ✅  
**Next Phase**: Metrics calculation system development ⏳  
**Priority**: High - Core feature for Dr. Nick's workflow 🚨 