import 'server-only';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1] || null;
}

export function getSupabaseWithToken(token: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function getAuthedSupabase(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return { ok: false as const, status: 401 as const, error: 'Unauthorized' };
  const supabase = getSupabaseWithToken(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401 as const, error: 'Unauthorized' };
  return { ok: true as const, supabase, user, token };
}

export type TemplateTypeId = 'regular' | 'enhanced';

export type TemplateTypeDefaultsRow = {
  id: TemplateTypeId;
  label: string;
  default_prompt: string;
  default_slide1_template_id: string | null;
  default_slide2_5_template_id: string | null;
  default_slide6_template_id: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type TemplateTypeOverrideRow = {
  user_id: string;
  template_type_id: TemplateTypeId;
  prompt_override: string | null;
  slide1_template_id_override: string | null;
  slide2_5_template_id_override: string | null;
  slide6_template_id_override: string | null;
  updated_at: string;
};

export function mergeTemplateTypeDefaults(
  defaults: TemplateTypeDefaultsRow,
  override: TemplateTypeOverrideRow | null
) {
  return {
    templateTypeId: defaults.id,
    label: defaults.label,
    prompt: (override?.prompt_override ?? '') || defaults.default_prompt || '',
    slide1TemplateId: override?.slide1_template_id_override ?? defaults.default_slide1_template_id ?? null,
    slide2to5TemplateId: override?.slide2_5_template_id_override ?? defaults.default_slide2_5_template_id ?? null,
    slide6TemplateId: override?.slide6_template_id_override ?? defaults.default_slide6_template_id ?? null,
    updatedAt: defaults.updated_at,
  };
}


