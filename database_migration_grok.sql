-- Grok Analysis Feature Migration
-- Run this script in Supabase SQL Editor

-- 1. Create AI table for managing global prompts
CREATE TABLE ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_type VARCHAR(50) NOT NULL,
  prompt_title VARCHAR(200) NOT NULL,
  prompt_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  version_number INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Only ONE active prompt at a time per type
CREATE UNIQUE INDEX unique_active_prompt 
ON ai (prompt_type, is_active) 
WHERE is_active = TRUE;

-- 2. Add Grok analysis response field to health_data table
ALTER TABLE health_data ADD COLUMN grok_analysis_response TEXT;

-- 3. Insert default Grok prompt
INSERT INTO ai (prompt_type, prompt_title, prompt_content, created_by) VALUES (
  'grok_analysis',
  'Grok Health Analysis',
  'You are going to be given a text of data and your job is to create substantive recommendations based on the data—such as specific strain adjustments, bedtime/wake time targets, and sleep debt reduction strategies—following the style and depth of your previous Text Output provided to you, for the week of April 7th–13th for 1 patient. Ensure the output is actionable, data-driven, and maximizes value for improving performance and recovery. Please get rid of all Asterix here and markdown. I want to be able to simply copy and paste what you output, directly. Insert line breaks through your output text appropriately so as to maximize legibility. Do not give me markdown

Here is an example of how your output should look: 

### **Weekly Performance Assessment (03/31/2025 - 04/06/2025)**

#### **Overview**
- **Focus**: Recovery-focused training and optimal sleep.
- **Training Level**: Restorative, priming the body for performance. This week is noted as an ideal time to work out.
- **Sleep Quality**: Optimal, maximizing recovery.

---

#### **Strain Breakdown**
- **Weekly Summary**: Strain was down slightly this week.
- **Average Day Strain**:
  - This Week: **8.6**
  - 3-Week Average: **10.0**
- **Total Activity**:
  - Duration: **0:52 hours** (Across 1 recorded activity).
  - Note: Limited activity logging. Recommendation to start logging activities for better strain analysis.

---

#### **Sleep Breakdown**
- **Weekly Summary**: Sleep performance was down by 4% this week.
- **Sleep Performance**:
  - This Week: **79%**
  - 3-Week Average: **83%**
- **Hours of Sleep vs. Sleep Need**:
  - This Week: **7:08 hours** (Need: **8:59 hours**)
  - 3-Week Average: **7:08 hours** (Need: **8:34 hours**)
- **Time in Bed vs. Recommended**:
  - This Week: **7:34 hours**
  - 3-Week Average: **7:36 hours**
  - Recommended Time in Bed: Calculated based on sleep need and history (most consistent time to sleep).
- **Sleep Debt & Awake Time**:
  - This Week Sleep Debt: **0:26 hours** (Awake Time: **1:52 hours**)
  - 3-Week Average Sleep Debt: **0:28 hours** (Awake Time: **1:27 hours**)
- **Bedtime & Waketime Variability**:
  - Bedtime Variability: **1:16 hours** (This Week) vs. **0:56 hours** (3-Week Average)
  - Waketime Variability: **0:37 hours** (This Week) vs. **0:52 hours** (3-Week Average)
  - Consistency: Sufficient, but there is room for improvement compared to the 3-week average (average variation of **0:57 hours**).

- **Daily Bedtime & Waketime Details**:
  | Day   | Bedtime  | Waketime |
  |-------|----------|----------|
  | Mon   | 11:15 PM | 6:59 AM  |
  | Tue   | 1:43 AM  | 6:59 AM  |
  | Wed   | 11:59 PM | 7:53 AM  |
  | Thu   | 12:02 AM | 7:30 AM  |
  | Fri   | 11:10 PM | 8:44 AM  |
  | Sat   | Not provided | Not provided |
  | Sun   | Not provided | Not provided |

---

#### **Recovery Days & Strain Metrics**
- **Recovery Days**: Not explicitly quantified, but training was restorative.
- **Strain Metrics**: Visual scale provided but exact daily values not specified beyond the weekly average of 8.6.

---

#### **Sleep Consistency & Performance Metrics**
- **Sleep Consistency**: Visual scale provided (10% to 100%, Poor to Maximal), but exact daily values not specified.
- **Sleep Performance**: Rated as "Optimal" overall, despite a 4% drop compared to the 3-week average.

---

#### **Recommendations**
1. **Activity Logging**: Start logging activities to improve strain analysis and provide more comprehensive data.
2. **Sleep Consistency**: Aim to reduce bedtime and waketime variability for better sleep quality (current variability is sufficient but can be improved).
3. **Time in Bed**: Align Time in Bed with Recommended Time in Bed based on sleep need and history.',
  (SELECT id FROM auth.users WHERE email = 'thefittesttribe@gmail.com' LIMIT 1)
);

-- 4. Set up RLS policies for ai table
ALTER TABLE ai ENABLE ROW LEVEL SECURITY;

-- Dr. Nick can view all AI prompts
CREATE POLICY "Dr Nick can view all ai prompts" ON ai
  FOR SELECT USING (auth.email() = 'thefittesttribe@gmail.com');

-- Dr. Nick can create AI prompts  
CREATE POLICY "Dr Nick can create ai prompts" ON ai
  FOR INSERT WITH CHECK (auth.email() = 'thefittesttribe@gmail.com');

-- Dr. Nick can update AI prompts
CREATE POLICY "Dr Nick can update ai prompts" ON ai
  FOR UPDATE USING (auth.email() = 'thefittesttribe@gmail.com');

-- 5. Grant necessary permissions
GRANT ALL ON ai TO authenticated;
GRANT ALL ON ai TO service_role; 