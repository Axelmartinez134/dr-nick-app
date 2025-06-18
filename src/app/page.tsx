// src/app/page.tsx
"use client";

import { useState } from "react";
import { useAuth } from "./components/auth/AuthContext";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import Dashboard from "./components/Dashboard";

export default function Home() {
  // Track whether to show login or signup form
  const [showSignup, setShowSignup] = useState(false);
  
  // Get user info from our authentication system
  const { user, loading } = useAuth();

  // STEP 1: If the app is still checking if user is logged in, show loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Dr. Nick Health Tracker...</p>
        </div>
      </div>
    );
  }

  // STEP 2: If user IS logged in, show them the dashboard
  if (user) {
    return <Dashboard />;
  }

  // STEP 3: If user is NOT logged in, show login/signup page
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">
              Dr. Nick Health Tracker
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Your Personal Health Journey Starts Here
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Toggle Buttons: Switch between Login and Signup */}
        <div className="text-center mb-8">
          <div className="inline-flex rounded-lg p-1 bg-gray-100">
            {/* Sign In Button */}
            <button
              onClick={() => setShowSignup(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !showSignup 
                  ? 'bg-white text-gray-900 shadow-sm'    // Active style
                  : 'text-gray-500 hover:text-gray-700'   // Inactive style
              }`}
            >
              Sign In
            </button>
            {/* Sign Up Button */}
            <button
              onClick={() => setShowSignup(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                showSignup 
                  ? 'bg-white text-gray-900 shadow-sm'    // Active style
                  : 'text-gray-500 hover:text-gray-700'   // Inactive style
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Show Login or Signup based on button clicked */}
        {showSignup ? <Signup /> : <Login />}

        {/* Features Section - Marketing content */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Why Choose Dr. Nick Health Tracker?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Track Your Progress
              </h3>
              <p className="text-gray-600">
                Monitor weight, waist circumference, and sleep patterns with beautiful charts.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Set Goals
              </h3>
              <p className="text-gray-600">
                Define your health goals and track your journey towards achieving them.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💡</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Get Insights
              </h3>
              <p className="text-gray-600">
                Receive personalized insights based on your health data trends.
              </p>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p>&copy; 2025 Dr. Nick Health Tracker. Built with ❤️ for your health journey.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}