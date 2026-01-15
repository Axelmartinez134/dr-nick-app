import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Body = {
  sourceTemplateId: string;
};

type Resp =
  | { success: true; id: string }
  | { success: false; error: string };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export async function POST(request: NextRequest) {
  // AUTH CHECK (editor users)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } satisfies Resp, { status: 500 });
  }

  const authedClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await authedClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 });
  }

  // Must be an editor user (RLS on editor_users allows select self).
  const { data: editorRow, error: editorErr } = await authedClient
    .from('editor_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (editorErr || !editorRow?.user_id) {
    return NextResponse.json({ success: false, error: 'Forbidden - Editor access required' } satisfies Resp, { status: 403 });
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }
  const sourceTemplateId = String(body.sourceTemplateId || '').trim();
  if (!sourceTemplateId) {
    return NextResponse.json({ success: false, error: 'sourceTemplateId is required' } satisfies Resp, { status: 400 });
  }

  // Load source template (service role to avoid RLS issues)
  const { data: srcTpl, error: srcErr } = await supabase
    .from('carousel_templates')
    .select('id, name, definition, owner_user_id')
    .eq('id', sourceTemplateId)
    .single();
  if (srcErr || !srcTpl) {
    return NextResponse.json({ success: false, error: srcErr?.message || 'Template not found' } satisfies Resp, { status: 404 });
  }
  if (String((srcTpl as any).owner_user_id || '') !== user.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });
  }

  const newName = `${String(srcTpl.name || 'Untitled Template')} (Copy)`;
  const def = clone<any>(srcTpl.definition || {});

  // Create destination template row first to get its ID
  const { data: inserted, error: insErr } = await supabase
    .from('carousel_templates')
    .insert({
      name: newName,
      owner_user_id: user.id,
      definition: def,
    })
    .select('id')
    .single();
  if (insErr || !inserted?.id) {
    return NextResponse.json({ success: false, error: insErr?.message || 'Failed to create template copy' } satisfies Resp, { status: 400 });
  }
  const destTemplateId = String(inserted.id);

  const bucket = 'carousel-templates';

  // Copy storage assets from source -> dest (best effort). We assume assets live under `${templateId}/assets/*`.
  const { data: files, error: listErr } = await supabase.storage.from(bucket).list(`${sourceTemplateId}/assets`, { limit: 1000 });
  if (listErr) {
    // Still allow duplication of definition-only templates.
    console.warn('[Template Duplicate] ⚠️ Failed to list assets:', listErr);
  } else if (Array.isArray(files)) {
    for (const f of files) {
      const name = (f as any)?.name;
      if (!name) continue;
      const fromPath = `${sourceTemplateId}/assets/${name}`;
      const toPath = `${destTemplateId}/assets/${name}`;
      try {
        const { error: copyErr } = await supabase.storage.from(bucket).copy(fromPath, toPath);
        if (copyErr) {
          console.warn('[Template Duplicate] ⚠️ copy failed:', { fromPath, toPath, copyErr: copyErr.message });
        }
      } catch (e) {
        console.warn('[Template Duplicate] ⚠️ copy threw:', { fromPath, toPath, e });
      }
    }
  }

  // Rewrite definition image src paths/urls to point at the new template folder.
  if (def && Array.isArray(def.slides)) {
    for (const slide of def.slides) {
      if (!slide || !Array.isArray((slide as any).assets)) continue;
      for (const asset of (slide as any).assets) {
        if (!asset || asset.type !== 'image') continue;
        const src = asset.src || {};
        const oldPath = String(src.path || '');
        if (oldPath.startsWith(`${sourceTemplateId}/`)) {
          const newPath = `${destTemplateId}/${oldPath.slice(`${sourceTemplateId}/`.length)}`;
          src.path = newPath;
          try {
            const { data } = supabase.storage.from(bucket).getPublicUrl(newPath);
            src.url = data.publicUrl;
          } catch {
            // ignore
          }
          asset.src = src;
        }
      }
    }
  }

  // Persist updated definition on the copied template.
  const { error: updErr } = await supabase
    .from('carousel_templates')
    .update({ definition: def })
    .eq('id', destTemplateId);
  if (updErr) {
    console.warn('[Template Duplicate] ⚠️ Failed to update copied definition paths:', updErr);
  }

  return NextResponse.json({ success: true, id: destTemplateId } satisfies Resp);
}

