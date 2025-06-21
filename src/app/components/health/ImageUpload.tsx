// src/app/components/health/ImageUpload.tsx
// Component for uploading Lumen screenshots and food log images

'use client'

import { useState } from 'react'
import { supabase } from '../auth/AuthContext'

interface ImageUploadProps {
  label: string
  description: string
  maxFiles: number
  filePrefix: string
  onFilesChange: (files: File[]) => void
  existingFiles?: string[]
  disabled?: boolean
}

interface FileWithPreview {
  file: File
  preview: string
  id: string
}

export default function ImageUpload({ 
  label, 
  description, 
  maxFiles, 
  filePrefix, 
  onFilesChange, 
  existingFiles = [],
  disabled = false 
}: ImageUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || disabled) return

    const newFiles: FileWithPreview[] = []
    const remainingSlots = maxFiles - files.length

    for (let i = 0; i < Math.min(selectedFiles.length, remainingSlots); i++) {
      const file = selectedFiles[i]
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`File "${file.name}" is not an image. Please select only image files.`)
        continue
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum file size is 10MB.`)
        continue
      }

      const fileWithPreview: FileWithPreview = {
        file,
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substring(7)
      }
      
      newFiles.push(fileWithPreview)
    }

    const updatedFiles = [...files, ...newFiles]
    setFiles(updatedFiles)
    onFilesChange(updatedFiles.map(f => f.file))
  }

  const removeFile = (id: string) => {
    if (disabled) return
    
    const updatedFiles = files.filter(f => f.id !== id)
    setFiles(updatedFiles)
    onFilesChange(updatedFiles.map(f => f.file))
    
    // Clean up object URL
    const fileToRemove = files.find(f => f.id === id)
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.preview)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
        <p className="text-xs text-gray-500 mt-1">
          {files.length}/{maxFiles} files selected • Max 10MB per file • PNG, JPG, JPEG supported
        </p>
      </div>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!disabled && files.length < maxFiles ? (
          <>
            <div className="space-y-2">
              <div className="text-gray-400">
                <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Click to upload</span> or drag and drop
              </div>
              <div className="text-sm text-gray-500">
                {maxFiles - files.length} more {maxFiles - files.length === 1 ? 'file' : 'files'} allowed
              </div>
            </div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={disabled}
            />
          </>
        ) : (
          <div className="text-gray-500">
            {disabled ? 'Upload disabled' : `Maximum ${maxFiles} files selected`}
          </div>
        )}
      </div>

      {/* File Previews */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Selected Files:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((fileWithPreview) => (
              <div key={fileWithPreview.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={fileWithPreview.preview}
                    alt={fileWithPreview.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* File Info */}
                <div className="mt-2">
                  <p className="text-xs text-gray-600 truncate" title={fileWithPreview.file.name}>
                    {fileWithPreview.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(fileWithPreview.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>

                {/* Remove Button */}
                {!disabled && (
                  <button
                    onClick={() => removeFile(fileWithPreview.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow-lg"
                    title="Remove file"
                  >
                    ×
                  </button>
                )}

                {/* Upload Progress */}
                {uploadProgress[fileWithPreview.id] && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <div className="text-white text-sm">
                      {uploadProgress[fileWithPreview.id]}%
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Files */}
      {existingFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Previously Uploaded:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {existingFiles.map((fileUrl, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={fileUrl}
                    alt={`${filePrefix} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-600">
                    {filePrefix} {index + 1}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 