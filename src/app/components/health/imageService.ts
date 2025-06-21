// src/app/components/health/imageService.ts
// Service for handling image uploads to Supabase Storage

import { supabase } from '../auth/AuthContext'

export interface ImageUploadResult {
  success: boolean
  urls?: string[]
  error?: string
}

export interface CheckinImage {
  id?: string
  user_id: string
  week_number: number
  image_type: 'lumen' | 'food_log'
  image_url: string
  image_path: string
  file_name: string
  file_size: number
  day_number?: number // 1-7 for daily images
  created_at?: string
}

// Function to create the storage bucket (run once during setup)
export async function createStorageBucket() {
  try {
    const { data, error } = await supabase.storage.createBucket('checkin-images', {
      public: false, // Private bucket - images only accessible to authenticated users
      fileSizeLimit: 10485760, // 10MB limit
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    })
    
    if (error && error.message !== 'Bucket already exists') {
      console.error('Error creating bucket:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error creating bucket:', error)
    return { success: false, error: 'Failed to create storage bucket' }
  }
}

// Function to upload images to Supabase Storage
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
    const imageRecords: Omit<CheckinImage, 'id' | 'created_at'>[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dayNumber = i + 1
      
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

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('checkin-images')
        .getPublicUrl(filePath)

      uploadedUrls.push(publicUrl)

      // Prepare database record
      imageRecords.push({
        user_id: userId,
        week_number: weekNumber,
        image_type: imageType,
        image_url: publicUrl,
        image_path: filePath,
        file_name: fileName,
        file_size: file.size,
        day_number: dayNumber
      })
    }

    // Save image records to database
    const { error: dbError } = await supabase
      .from('checkin_images')
      .insert(imageRecords)

    if (dbError) {
      console.error('Error saving image records to database:', dbError)
      return { success: false, error: 'Failed to save image records to database' }
    }

    return { success: true, urls: uploadedUrls }
  } catch (error) {
    console.error('Error uploading images:', error)
    return { success: false, error: 'Unexpected error during image upload' }
  }
}

// Function to get images for a specific week and user
export async function getImagesForWeek(
  userId: string, 
  weekNumber: number
): Promise<{ lumenImages: CheckinImage[], foodLogImages: CheckinImage[] }> {
  try {
    const { data, error } = await supabase
      .from('checkin_images')
      .select('*')
      .eq('user_id', userId)
      .eq('week_number', weekNumber)
      .order('day_number', { ascending: true })

    if (error) {
      console.error('Error fetching images:', error)
      return { lumenImages: [], foodLogImages: [] }
    }

    const lumenImages = data?.filter(img => img.image_type === 'lumen') || []
    const foodLogImages = data?.filter(img => img.image_type === 'food_log') || []

    return { lumenImages, foodLogImages }
  } catch (error) {
    console.error('Error fetching images:', error)
    return { lumenImages: [], foodLogImages: [] }
  }
}

// Function to delete images (both from storage and database)
export async function deleteImages(
  userId: string, 
  weekNumber: number, 
  imageType?: 'lumen' | 'food_log'
): Promise<{ success: boolean, error?: string }> {
  try {
    // Get image records to delete
    let query = supabase
      .from('checkin_images')
      .select('*')
      .eq('user_id', userId)
      .eq('week_number', weekNumber)

    if (imageType) {
      query = query.eq('image_type', imageType)
    }

    const { data: images, error: fetchError } = await query

    if (fetchError) {
      return { success: false, error: fetchError.message }
    }

    if (!images || images.length === 0) {
      return { success: true } // Nothing to delete
    }

    // Delete from storage
    const filePaths = images.map(img => img.image_path)
    const { error: storageError } = await supabase.storage
      .from('checkin-images')
      .remove(filePaths)

    if (storageError) {
      console.error('Error deleting from storage:', storageError)
      return { success: false, error: 'Failed to delete images from storage' }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('checkin_images')
      .delete()
      .eq('user_id', userId)
      .eq('week_number', weekNumber)

    if (imageType) {
      const { error: typeDbError } = await supabase
        .from('checkin_images')
        .delete()
        .eq('user_id', userId)
        .eq('week_number', weekNumber)
        .eq('image_type', imageType)

      if (typeDbError) {
        return { success: false, error: typeDbError.message }
      }
    } else if (dbError) {
      return { success: false, error: dbError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting images:', error)
    return { success: false, error: 'Unexpected error during image deletion' }
  }
}

// Function to generate signed URLs for private access (if needed)
export async function generateSignedUrls(
  imagePaths: string[], 
  expiresIn: number = 3600
): Promise<string[]> {
  try {
    const signedUrls: string[] = []

    for (const path of imagePaths) {
      const { data, error } = await supabase.storage
        .from('checkin-images')
        .createSignedUrl(path, expiresIn)

      if (error) {
        console.error(`Error generating signed URL for ${path}:`, error)
        signedUrls.push('') // Add empty string for failed URLs
      } else {
        signedUrls.push(data.signedUrl)
      }
    }

    return signedUrls
  } catch (error) {
    console.error('Error generating signed URLs:', error)
    return imagePaths.map(() => '') // Return empty strings for all paths
  }
} 