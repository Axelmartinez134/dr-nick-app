// src/app/components/health/imageService.ts
// Simple service for handling image uploads to Supabase Storage
// Images are stored in storage, URLs saved directly to health_data table

import { supabase } from '../auth/AuthContext'

export interface ImageUploadResult {
  success: boolean
  urls?: string[]
  error?: string
}

// Function to upload a single image and return its URL
export async function uploadSingleImage(
  file: File, 
  userId: string, 
  weekNumber: number, 
  imageType: 'lumen' | 'food_log',
  dayNumber: number
): Promise<{ success: boolean, url?: string, error?: string }> {
  try {
    if (!file) {
      return { success: true, url: undefined }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Please upload JPG, PNG, or WEBP images.' }
    }

    // Validate file size (10MB limit)
    if (file.size > 10485760) {
      return { success: false, error: 'File too large. Please upload images smaller than 10MB.' }
    }

    // Create unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}_week${weekNumber}_${imageType}_day${dayNumber}_${Date.now()}.${fileExt}`
    const filePath = `${userId}/${weekNumber}/${imageType}/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('checkin-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error(`Error uploading file ${file.name}:`, uploadError)
      return { success: false, error: `Failed to upload ${file.name}: ${uploadError.message}` }
    }

    // Get public URL (this will be a signed URL for private buckets)
    const { data: { publicUrl } } = supabase.storage
      .from('checkin-images')
      .getPublicUrl(filePath)

    return { success: true, url: publicUrl }
  } catch (error) {
    console.error('Error uploading image:', error)
    return { success: false, error: 'Unexpected error during image upload' }
  }
}

// Function to upload multiple images and return their URLs
export async function uploadImages(
  files: File[], 
  userId: string, 
  weekNumber: number, 
  imageType: 'lumen' | 'food_log'
): Promise<ImageUploadResult> {
  try {
    if (!files || files.length === 0) {
      return { success: true, urls: [] }
    }

    const uploadedUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dayNumber = i + 1
      
      const result = await uploadSingleImage(file, userId, weekNumber, imageType, dayNumber)
      
      if (!result.success) {
        return { success: false, error: result.error }
      }
      
      if (result.url) {
        uploadedUrls.push(result.url)
      }
    }

    return { success: true, urls: uploadedUrls }
  } catch (error) {
    console.error('Error uploading images:', error)
    return { success: false, error: 'Unexpected error during image upload' }
  }
}

// Function to delete an image from storage using its URL
export async function deleteImageByUrl(imageUrl: string): Promise<{ success: boolean, error?: string }> {
  try {
    if (!imageUrl) {
      return { success: true }
    }

    // Extract file path from URL
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.findIndex(part => part === 'checkin-images')
    
    if (bucketIndex === -1) {
      return { success: false, error: 'Invalid image URL format' }
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/')

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('checkin-images')
      .remove([filePath])

    if (storageError) {
      console.error('Error deleting from storage:', storageError)
      return { success: false, error: 'Failed to delete image from storage' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting image:', error)
    return { success: false, error: 'Unexpected error during image deletion' }
  }
}

// Function to create a signed URL for viewing private images
export async function getSignedImageUrl(imageUrl: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    if (!imageUrl) {
      return null
    }

    // Extract file path from URL
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.findIndex(part => part === 'checkin-images')
    
    if (bucketIndex === -1) {
      return imageUrl // Return original URL if not from our bucket
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/')

    // Create signed URL
    const { data, error } = await supabase.storage
      .from('checkin-images')
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error('Error creating signed URL:', error)
      return imageUrl // Fallback to original URL
    }

    return data.signedUrl
  } catch (error) {
    console.error('Error creating signed URL:', error)
    return imageUrl // Fallback to original URL
  }
}

// Function to batch create signed URLs for multiple images
export async function getSignedImageUrls(imageUrls: (string | null)[], expiresIn: number = 3600): Promise<(string | null)[]> {
  const signedUrls = await Promise.all(
    imageUrls.map(url => url ? getSignedImageUrl(url, expiresIn) : Promise.resolve(null))
  )
  return signedUrls
} 