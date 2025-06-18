// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

// Get the Supabase URL and Key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test function to check if connection works
export async function testConnection() {
  try {
    const { data, error } = await supabase.from('test').select('*').limit(1)
    if (error) {
      console.log('Connection test error (this is normal for now):', error.message)
    } else {
      console.log('Supabase connected successfully!')
    }
  } catch (err) {
    console.log('Connection test failed:', err.message)
  }
}