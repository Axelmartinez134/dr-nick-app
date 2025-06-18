// src/components/Dashboard.tsx
// Dashboard that logged-in users see

'use client'

import { useAuth } from './auth/AuthContext'

export default function Dashboard() {
  // Get user info and sign out function from our authentication system
  const { user, signOut } = useAuth()

  // Function to handle when user clicks "Sign Out"
  const handleSignOut = async () => {
    await signOut()
    // User will automatically be redirected back to login page
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Navigation Bar at Top */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            {/* Left side: App name */}
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Dr. Nick Health Tracker
              </h1>
            </div>
            
            {/* Right side: User welcome + sign out button */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.user_metadata?.full_name || user?.email}!
              </span>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Sign Out
              </button>
            </div>
            
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        {/* Dashboard Cards - 3 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Welcome Message */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Welcome to Your Health Journey!
              </h3>
              <p className="text-gray-600">
                Start tracking your health metrics today. Your progress is important to us.
              </p>
            </div>
          </div>

          {/* Card 2: Today's Stats (placeholder for now) */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Today&apos;s Stats
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Weight:</span>
                  <span className="font-medium">Not recorded</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sleep:</span>
                  <span className="font-medium">Not recorded</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Waist:</span>
                  <span className="font-medium">Not recorded</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Quick Action Buttons */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm">
                  Add Today&apos;s Measurements
                </button>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded text-sm">
                  View Progress Chart
                </button>
                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded text-sm">
                  Set Health Goals
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Recent Activity Section */}
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Recent Activity
              </h3>
              <div className="text-center py-8 text-gray-500">
                <p>No health data recorded yet.</p>
                <p className="text-sm mt-2">Start by adding your first measurements above!</p>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}