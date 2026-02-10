import { Suspense } from 'react'
import ResetPasswordClient from './reset-password-client'

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h1 className="text-2xl font-bold text-gray-900 text-center">Reset Password</h1>
              <div className="mt-6 text-center text-gray-600">Loading…</div>
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}

