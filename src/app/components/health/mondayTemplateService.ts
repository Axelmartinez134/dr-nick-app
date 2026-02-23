import { supabase } from '../auth/AuthContext'

// Get active global Monday template
export async function getActiveMondayTemplate(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('ai')
      .select('prompt_content')
      .eq('prompt_type', 'monday_message_template')
      .eq('is_active', true)
      .single()
    
    if (error) {
      console.error('Error loading Monday template:', error)
      return 'Good evening, {{patient_first_name}}.\n\nI hope your week went well!\n\n[Default template placeholder - please update global template]'
    }
    
    return data?.prompt_content || 'Good evening, {{patient_first_name}}.\n\nI hope your week went well!\n\n[Default template placeholder - please update global template]'
  } catch (err) {
    console.error('Failed to load Monday template:', err)
    return 'Good evening, {{patient_first_name}}.\n\nI hope your week went well!\n\n[Default template placeholder - please update global template]'
  }
}

// Update global Monday template
export async function updateGlobalMondayTemplate(content: string): Promise<void> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Deactivate current template
    await supabase
      .from('ai')
      .update({ is_active: false })
      .eq('prompt_type', 'monday_message_template')
      .eq('is_active', true)
    
    // Get next version number
    const { data: versionData } = await supabase
      .from('ai')
      .select('version_number')
      .eq('prompt_type', 'monday_message_template')
      .order('version_number', { ascending: false })
      .limit(1)
    
    const nextVersion = (versionData?.[0]?.version_number || 0) + 1
    
    // Create new active template
    const { error } = await supabase
      .from('ai')
      .insert({
        prompt_type: 'monday_message_template',
        prompt_title: 'Monday Morning Message Template',
        prompt_content: content,
        is_active: true,
        version_number: nextVersion,
        created_by: user.id
      })
    
    if (error) throw error
  } catch (err) {
    console.error('Failed to update global Monday template:', err)
    throw err
  }
}