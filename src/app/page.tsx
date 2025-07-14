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
          <p className="mt-4 text-gray-600">Loading The Fittest You Health Tracker...</p>
        </div>
      </div>
    );
  }

  // STEP 2: If user IS logged in, show them the dashboard
  if (user) {
    return <Dashboard />;
  }

  // STEP 3: If user is NOT logged in, show login page
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">
              The Fittest You Metabolic Health Tracker
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Your Metabolic Health Improvement Journey Starts Here
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Login Section - No signup option visible */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Sign In to Your Account
          </h2>
          <p className="text-gray-600 mb-6">
            Use the login credentials provided by Dr. Nick
          </p>
        </div>

        {/* Show Login form only */}
        <Login />

        {/* Features Section - Marketing content */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Why Choose The Fittest You Health Tracker?
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
                Monitor weight, waist circumference, metabolic fuel substrate utilization, and sleep patterns with beautiful charts.
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

        {/* Contact Info */}
        <div className="mt-12 text-center">
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Need Account Access?
            </h3>
            <p className="text-gray-600">
              Contact Dr. Nick to get your login credentials and start your health journey.
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p>&copy; 2025 The Fittest You Health Tracker. Built with ❤️ for your health journey.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}