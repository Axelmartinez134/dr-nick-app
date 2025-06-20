// src/app/components/health/UserCreationModal.tsx
// Modal wrapper for creating new patient accounts

'use client'

import { useState } from 'react'
import CreateUserForm from './CreateUserForm'

interface UserCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onPatientCreated?: () => void
}

export default function UserCreationModal({ 
  isOpen, 
  onClose, 
  onPatientCreated 
}: UserCreationModalProps) {
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string
    password: string
    fullName: string
  } | null>(null)
  
  // Copy feedback states
  const [copyStates, setCopyStates] = useState({
    chatMessage: false,
    email: false,
    password: false
  })

  const handleSuccess = (credentials: { email: string; password: string }, fullName: string) => {
    setCreatedCredentials({
      ...credentials,
      fullName
    })
    setShowSuccess(true)
    if (onPatientCreated) {
      onPatientCreated()
    }
  }

  const handleClose = () => {
    setShowSuccess(false)
    setCreatedCredentials(null)
    setCopyStates({
      chatMessage: false,
      email: false,
      password: false
    })
    onClose()
  }

  const copyToClipboard = async (text: string, type: keyof typeof copyStates) => {
    try {
      await navigator.clipboard.writeText(text)
      
      // Show feedback
      setCopyStates(prev => ({ ...prev, [type]: true }))
      
      // Reset feedback after 2 seconds
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [type]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Get patient's first name
  const getFirstName = () => {
    if (!createdCredentials?.fullName) return 'Patient'
    const trimmedName = createdCredentials.fullName.trim()
    if (!trimmedName) return 'Patient'
    return trimmedName.split(' ')[0]
  }

  // Create the chat message for Dr. Nick to copy
  const createChatMessage = () => {
    if (!createdCredentials) return ''
    
    const firstName = getFirstName()
    return `Hey ${firstName}, here is your login information:

Email: ${createdCredentials.email}
Password: ${createdCredentials.password}

Website: ${window.location.origin}

You can now log in and start your weekly check-ins with Dr. Nick!`
  }

  const copyChatMessage = () => {
    const message = createChatMessage()
    copyToClipboard(message, 'chatMessage')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {!showSuccess ? (
          // Creation Form
          <div className="relative">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl leading-none z-10"
            >
              ×
            </button>
            <CreateUserForm 
              onSuccess={handleSuccess}
              onCancel={handleClose}
            />
          </div>
        ) : (
          // Success Confirmation
          <div className="p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                🎉 Patient Account Created Successfully!
              </h2>
              <p className="text-gray-600">
                {getFirstName()}'s account has been set up with Week 0 baseline data.
              </p>
            </div>

            {createdCredentials && (
              <>
                {/* Chat Message Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">
                      💬 Message for {getFirstName()}
                    </h3>
                    <button
                      onClick={copyChatMessage}
                      className={`px-4 py-2 rounded-md transition-all duration-200 font-medium ${
                        copyStates.chatMessage 
                          ? 'bg-green-600 text-white' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {copyStates.chatMessage ? '✅ Copied!' : '📋 Copy Message'}
                    </button>
                  </div>
                  
                  <div className="bg-white border rounded-lg p-4 text-left font-mono text-sm text-gray-800 whitespace-pre-line">
                    {createChatMessage()}
                  </div>
                  
                  <p className="text-xs text-blue-600 mt-2">
                    ↑ Copy this message to send directly to {getFirstName()}
                  </p>
                </div>

                {/* Individual Credentials Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    🔑 Individual Login Details
                  </h3>
                  
                  <div className="space-y-3 text-left">
                    <div className="flex justify-between items-center bg-white p-3 rounded border">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email:</label>
                        <div className="text-gray-900 font-mono">{createdCredentials.email}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                        className={`text-sm px-3 py-1 rounded transition-all duration-200 ${
                          copyStates.email
                            ? 'bg-green-100 text-green-800'
                            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                        }`}
                      >
                        {copyStates.email ? '✅ Copied!' : 'Copy'}
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-white p-3 rounded border">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Password:</label>
                        <div className="text-gray-900 font-mono">{createdCredentials.password}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                        className={`text-sm px-3 py-1 rounded transition-all duration-200 ${
                          copyStates.password
                            ? 'bg-green-100 text-green-800'
                            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                        }`}
                      >
                        {copyStates.password ? '✅ Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-yellow-800 mb-2">📝 What happens next:</h4>
              <div className="text-sm text-yellow-700 text-left">
                <p>1. Send the message above to {getFirstName()}</p>
                <p>2. {getFirstName()} can log in immediately and start weekly check-ins</p>
                <p>3. Week 0 data will serve as baseline for all progress charts</p>
                <p>4. You can view {getFirstName()}'s password anytime in the patient list</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="text-sm text-green-700">
                <p>✅ Account created in Supabase</p>
                <p>✅ Week 0 baseline data saved</p>
                <p>✅ {getFirstName()} can login immediately</p>
                <p>✅ Password stored for your reference</p>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              
              <button
                onClick={() => {
                  setShowSuccess(false)
                  setCreatedCredentials(null)
                  setCopyStates({
                    chatMessage: false,
                    email: false,
                    password: false
                  })
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Another Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 