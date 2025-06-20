# The Fittest You Health Tracker

Dr. Nick's patient health tracking application built with Next.js, Supabase, and TypeScript.

## 🚀 Quick Start

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## 🛠️ Developer Mode for Testing

**No complicated files needed!** Simply use the **Developer Mode button** in the patient form:

### ✅ Simple Testing Steps:
1. Log in as any patient
2. Go to "Weekly Check-in" tab
3. Click the **"Dev Mode OFF"** button to turn it **ON** (yellow)
4. Select any week (1-20) from the dropdown
5. Submit forms for any week to test charts and data
6. Click **"Dev Mode ON"** to turn it **OFF** for normal operation

### 🎯 What Developer Mode Does:
- **ON**: Manual week selection - test any week
- **OFF**: Smart week calculation based on submission history

### 📅 Smart Week Calculation Logic:
- **First submission**: Week 1
- **Within 3 days of last submission**: Can resubmit to same week
- **4-10 days since last submission**: Moves to next week  
- **More than 10 days**: Calculates weeks passed automatically
- **Grace period**: Patients get 3 days to submit after their expected week

## 🏥 Dr. Nick Admin Features

### Creating Patients:
1. Login as Dr. Nick (thefittesttribe@gmail.com)
2. Click "➕ Create New Patient"
3. Fill patient details and Week 0 baseline measurements
4. System automatically handles week progression from first submission
5. Share generated credentials with patient

### Smart Week Management:
- No manual date setting required
- System learns from patient submission patterns
- Handles irregular submission schedules gracefully
- Automatic progression with built-in grace periods

## 📊 Smart Features

- **Auto Week Calculation**: No database columns needed - pure logic
- **Grace Period**: 3-day window for late submissions  
- **Dev Mode Toggle**: Easy testing without config files
- **Submission History Analysis**: Smart progression based on actual usage
- **Progress Tracking**: Automatic charts and projections
- **Number-Only Validation**: All form inputs require numeric values with clear error messages

## 🔧 Technical Details

- **Next.js 15.3.3** with Turbopack
- **Supabase** for database and authentication  
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Recharts** for data visualization

## 🗄️ Database Schema

### Profiles Table:
- `full_name`, `email`, `patient_password` 
- No additional date columns needed

### Health_Data Table:
- Week-based tracking with smart progression
- Body measurements, training, recovery metrics
- Sleep scores (added by Dr. Nick from Whoop data)
- `week_number`, `date`, `created_at` used for smart calculation

## 🎨 User Experience

### For Patients:
- Smart forms that auto-detect current week
- Grace period for late submissions
- Clean, modern interface with number-only inputs
- Clear validation errors with examples
- Progress charts and projections

### For Dr. Nick:
- Simple patient creation (no complex date setup)
- Automatic week progression management
- Development mode for comprehensive testing
- Copy-paste friendly patient communications

## 🧠 Smart Algorithm

The system calculates the current week by analyzing:
1. **Previous submissions** - Finds highest week number and most recent date
2. **Time gaps** - Calculates days since last submission
3. **Grace periods** - Allows 3-day window for late submissions
4. **Week progression** - Automatically advances based on time passed
5. **Error handling** - Defaults to Week 1 for new users or errors

**No database changes required** - Pure conditional logic using existing data!

---

Built for **The Fittest You** health transformation program.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
