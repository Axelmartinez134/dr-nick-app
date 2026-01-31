import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  clientEmail: string;
  password?: string | null;
  accountDisplayName: string;
  poppyConversationUrl: string;
  aiImageGenModel: 'gpt-image-1.5' | 'gemini-3-pro-image-preview';
  ideasPromptOverride?: string | null;
  captionRegenPromptOverride?: string | null;
  cloneDefaults?: boolean;
  cloneFromAccountId?: string | null;
};

type Resp =
  | {
      success: true;
      accountId: string;
      accountDisplayName: string;
      ownerUserId: string;
      existingUser: boolean;
      clonedDefaults: boolean;
      clonedTemplateCount: number;
    }
  | { success: false; error: string };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function cleanTextOrNull(v: any): string | null {
  const s = String(v ?? '').replace(/\r\n/g, '\n').trim();
  return s ? s : null;
}

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

async function getAuthUserByEmail(admin: any, email: string): Promise<{ userId: string | null }> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return { userId: null };

  const direct = admin?.auth?.admin?.getUserByEmail;
  if (typeof direct === 'function') {
    const { data, error } = await direct.call(admin.auth.admin, e);
    if (error) return { userId: null };
    const id = String(data?.user?.id || '').trim();
    return { userId: id || null };
  }

  const list = admin?.auth?.admin?.listUsers;
  if (typeof list === 'function') {
    const { data, error } = await list.call(admin.auth.admin, { page: 1, perPage: 1000 });
    if (error) return { userId: null };
    const users = Array.isArray((data as any)?.users) ? (data as any).users : [];
    const match = users.find((u: any) => String(u?.email || '').toLowerCase() === e);
    const id = String(match?.id || '').trim();
    return { userId: id || null };
  }

  return { userId: null };
}

async function copyTemplateAssetsAndRewriteDefinition(args: {
  supabase: any;
  bucket: string;
  fromTemplateId: string;
  toTemplateId: string;
  definition: any;
}) {
  const { supabase, bucket, fromTemplateId, toTemplateId } = args;
  const def = args.definition;

  // Copy `${from}/assets/*` to `${to}/assets/*` (best effort).
  const { data: files } = await supabase.storage.from(bucket).list(`${fromTemplateId}/assets`, { limit: 1000 }).catch(() => ({ data: null }));
  if (Array.isArray(files)) {
    for (const f of files) {
      const name = (f as any)?.name;
      if (!name) continue;
      const fromPath = `${fromTemplateId}/assets/${name}`;
      const toPath = `${toTemplateId}/assets/${name}`;
      try {
        await supabase.storage.from(bucket).copy(fromPath, toPath);
      } catch {
        // ignore (still usable if assets are purely decorative)
      }
    }
  }

  // Rewrite definition asset src paths to point to the new template folder.
  if (def && Array.isArray(def.slides)) {
    for (const slide of def.slides) {
      if (!slide || !Array.isArray((slide as any).assets)) continue;
      for (const asset of (slide as any).assets) {
        if (!asset || asset.type !== 'image') continue;
        const src = asset.src || {};
        const oldPath = String(src.path || '');
        if (oldPath.startsWith(`${fromTemplateId}/`)) {
          const newPath = `${toTemplateId}/${oldPath.slice(`${fromTemplateId}/`.length)}`;
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

  return def;
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase: authedSupabase, user: actor } = authed;

  // Superadmin only.
  const { data: saRow, error: saErr } = await authedSupabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', actor.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } satisfies Resp,
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }

  const clientEmail = String(body.clientEmail || '').trim().toLowerCase();
  const accountDisplayName = String(body.accountDisplayName || '').trim();
  const poppyConversationUrl = String(body.poppyConversationUrl || '').trim();
  const aiImageGenModel = body.aiImageGenModel === 'gemini-3-pro-image-preview' ? 'gemini-3-pro-image-preview' : 'gpt-image-1.5';

  const ideasPromptOverride = cleanTextOrNull(body.ideasPromptOverride);
  const captionRegenPromptOverride = cleanTextOrNull(body.captionRegenPromptOverride);

  const cloneDefaults = !!body.cloneDefaults;
  const cloneFromAccountId = String(body.cloneFromAccountId || '').trim() || null;

  if (!clientEmail || !clientEmail.includes('@')) {
    return NextResponse.json({ success: false, error: 'clientEmail is required' } satisfies Resp, { status: 400 });
  }
  if (!accountDisplayName) {
    return NextResponse.json({ success: false, error: 'accountDisplayName is required' } satisfies Resp, { status: 400 });
  }
  if (!poppyConversationUrl) {
    return NextResponse.json({ success: false, error: 'poppyConversationUrl is required' } satisfies Resp, { status: 400 });
  }

  let createdAuthUserId: string | null = null;
  let ownerUserId: string | null = null;
  let accountId: string | null = null;
  let existingUser = false;

  const cleanup = async () => {
    try {
      if (accountId) {
        // IMPORTANT: account_id FKs on editor tables are often ON DELETE SET NULL, so we must delete account-scoped rows explicitly.
        await admin.from('carousel_template_type_overrides').delete().eq('account_id', accountId);
        await admin.from('carousel_templates').delete().eq('account_id', accountId);
        await admin.from('editor_account_settings').delete().eq('account_id', accountId);
        await admin.from('editor_account_memberships').delete().eq('account_id', accountId);
        await admin.from('editor_accounts').delete().eq('id', accountId);
      }
    } catch {
      // ignore cleanup errors
    }
    try {
      if (createdAuthUserId) {
        await admin.auth.admin.deleteUser(createdAuthUserId);
      }
    } catch {
      // ignore cleanup errors
    }
  };

  try {
    // Determine owner auth user (create if missing).
    const { userId: existingUserId } = await getAuthUserByEmail(admin, clientEmail);
    ownerUserId = existingUserId;
    existingUser = !!existingUserId;

    if (!ownerUserId) {
      const password = String(body.password || '').trim();
      if (!password) {
        return NextResponse.json({ success: false, error: 'password is required for new users' } satisfies Resp, { status: 400 });
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: clientEmail,
        password,
        email_confirm: true,
      });
      if (createErr || !created?.user?.id) {
        return NextResponse.json({ success: false, error: createErr?.message || 'Failed to create auth user' } satisfies Resp, { status: 500 });
      }
      ownerUserId = String(created.user.id);
      createdAuthUserId = ownerUserId;
      existingUser = false;
    }

    // Ensure editor_users row exists for the new owner (some editor APIs still check it).
    await admin.from('editor_users').upsert({ user_id: ownerUserId }, { onConflict: 'user_id' });

    // Create account.
    const { data: acctRow, error: acctErr } = await admin
      .from('editor_accounts')
      .insert({ display_name: accountDisplayName, created_by_user_id: actor.id })
      .select('id')
      .single();
    if (acctErr || !acctRow?.id) {
      await cleanup();
      return NextResponse.json({ success: false, error: acctErr?.message || 'Failed to create account' } satisfies Resp, { status: 500 });
    }
    accountId = String(acctRow.id);

    // Create memberships: client is owner; actor is admin.
    const memberships: Array<{ account_id: string; user_id: string; role: 'owner' | 'admin' }> = [
      { account_id: accountId, user_id: ownerUserId, role: 'owner' },
    ];
    if (actor.id !== ownerUserId) {
      memberships.push({ account_id: accountId, user_id: actor.id, role: 'admin' });
    }
    const { error: memErr } = await admin.from('editor_account_memberships').upsert(memberships, { onConflict: 'account_id,user_id' });
    if (memErr) {
      await cleanup();
      return NextResponse.json({ success: false, error: memErr.message } satisfies Resp, { status: 500 });
    }

    // Insert settings row.
    const { error: settingsErr } = await admin.from('editor_account_settings').insert({
      account_id: accountId,
      poppy_conversation_url: poppyConversationUrl,
      ai_image_gen_model: aiImageGenModel,
      ideas_prompt_override: ideasPromptOverride,
      caption_regen_prompt_override: captionRegenPromptOverride,
    });
    if (settingsErr) {
      await cleanup();
      return NextResponse.json({ success: false, error: settingsErr.message } satisfies Resp, { status: 500 });
    }

    // Clone minimal default templates + template-type overrides.
    let clonedTemplateCount = 0;
    if (cloneDefaults) {
      if (!cloneFromAccountId) {
        await cleanup();
        return NextResponse.json({ success: false, error: 'cloneFromAccountId is required when cloneDefaults is true' } satisfies Resp, {
          status: 400,
        });
      }

      // Must be a member of the source account (prevents copying from arbitrary accounts).
      const { data: srcMem, error: srcMemErr } = await authedSupabase
        .from('editor_account_memberships')
        .select('id')
        .eq('user_id', actor.id)
        .eq('account_id', cloneFromAccountId)
        .maybeSingle();
      if (srcMemErr) {
        await cleanup();
        return NextResponse.json({ success: false, error: srcMemErr.message } satisfies Resp, { status: 500 });
      }
      if (!srcMem?.id) {
        await cleanup();
        return NextResponse.json({ success: false, error: 'Forbidden (not a member of clone source account)' } satisfies Resp, { status: 403 });
      }

      const { data: srcOverrides, error: srcOvErr } = await admin
        .from('carousel_template_type_overrides')
        .select(
          'template_type_id, prompt_override, emphasis_prompt_override, image_gen_prompt_override, slide1_template_id_override, slide2_5_template_id_override, slide6_template_id_override'
        )
        .eq('account_id', cloneFromAccountId)
        .in('template_type_id', ['regular', 'enhanced']);
      if (srcOvErr) {
        await cleanup();
        return NextResponse.json({ success: false, error: srcOvErr.message } satisfies Resp, { status: 500 });
      }

      const byType: Record<string, any> = {};
      for (const row of srcOverrides || []) byType[String((row as any)?.template_type_id || '')] = row;
      const reg = byType['regular'];
      const enh = byType['enhanced'];
      if (!reg || !enh) {
        await cleanup();
        return NextResponse.json({ success: false, error: 'Source account is missing Regular/Enhanced default mappings' } satisfies Resp, {
          status: 400,
        });
      }

      const oldTemplateIds = Array.from(
        new Set(
          [
            reg.slide1_template_id_override,
            reg.slide2_5_template_id_override,
            reg.slide6_template_id_override,
            enh.slide1_template_id_override,
            enh.slide2_5_template_id_override,
            enh.slide6_template_id_override,
          ]
            .map((x) => String(x || '').trim())
            .filter(Boolean)
        )
      );

      if (oldTemplateIds.length > 0) {
        const { data: srcTemplates, error: srcTplErr } = await admin
          .from('carousel_templates')
          .select('id, name, definition, account_id')
          .in('id', oldTemplateIds);
        if (srcTplErr) {
          await cleanup();
          return NextResponse.json({ success: false, error: srcTplErr.message } satisfies Resp, { status: 500 });
        }

        const srcById = new Map<string, any>();
        for (const t of srcTemplates || []) {
          const tid = String((t as any)?.id || '').trim();
          if (tid) srcById.set(tid, t);
        }

        // Verify templates belong to the source account (defensive).
        for (const tid of oldTemplateIds) {
          const t = srcById.get(tid);
          if (!t) {
            await cleanup();
            return NextResponse.json({ success: false, error: `Source template not found: ${tid}` } satisfies Resp, { status: 400 });
          }
          if (String((t as any).account_id || '') !== cloneFromAccountId) {
            await cleanup();
            return NextResponse.json({ success: false, error: `Template ${tid} is not owned by source account` } satisfies Resp, { status: 400 });
          }
        }

        const idMap = new Map<string, string>();
        const bucket = 'carousel-templates';

        for (const oldId of oldTemplateIds) {
          const t = srcById.get(oldId);
          const newDef = cloneJson<any>((t as any)?.definition || {});

          const { data: inserted, error: insErr } = await admin
            .from('carousel_templates')
            .insert({
              name: String((t as any)?.name || 'Template'),
              owner_user_id: ownerUserId,
              account_id: accountId,
              definition: newDef,
            })
            .select('id')
            .single();
          if (insErr || !inserted?.id) {
            await cleanup();
            return NextResponse.json({ success: false, error: insErr?.message || 'Failed to clone template' } satisfies Resp, { status: 500 });
          }
          const newId = String(inserted.id);
          idMap.set(oldId, newId);
          clonedTemplateCount += 1;

          // Copy assets + rewrite definition to new template id folder
          const rewritten = await copyTemplateAssetsAndRewriteDefinition({
            supabase: admin,
            bucket,
            fromTemplateId: oldId,
            toTemplateId: newId,
            definition: newDef,
          });
          await admin.from('carousel_templates').update({ definition: rewritten }).eq('id', newId);
        }

        const mapId = (v: any) => {
          const old = String(v || '').trim();
          return old ? idMap.get(old) || null : null;
        };

        const nextOverrides = [
          {
            account_id: accountId,
            user_id: actor.id,
            template_type_id: 'regular',
            prompt_override: reg.prompt_override ?? null,
            emphasis_prompt_override: reg.emphasis_prompt_override ?? null,
            image_gen_prompt_override: reg.image_gen_prompt_override ?? null,
            slide1_template_id_override: mapId(reg.slide1_template_id_override),
            slide2_5_template_id_override: mapId(reg.slide2_5_template_id_override),
            slide6_template_id_override: mapId(reg.slide6_template_id_override),
          },
          {
            account_id: accountId,
            user_id: actor.id,
            template_type_id: 'enhanced',
            prompt_override: enh.prompt_override ?? null,
            emphasis_prompt_override: enh.emphasis_prompt_override ?? null,
            image_gen_prompt_override: enh.image_gen_prompt_override ?? null,
            slide1_template_id_override: mapId(enh.slide1_template_id_override),
            slide2_5_template_id_override: mapId(enh.slide2_5_template_id_override),
            slide6_template_id_override: mapId(enh.slide6_template_id_override),
          },
        ];

        const { error: ovUpErr } = await admin
          .from('carousel_template_type_overrides')
          .upsert(nextOverrides as any, { onConflict: 'account_id,template_type_id' });
        if (ovUpErr) {
          await cleanup();
          return NextResponse.json({ success: false, error: ovUpErr.message } satisfies Resp, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      accountId,
      accountDisplayName,
      ownerUserId,
      existingUser,
      clonedDefaults: cloneDefaults,
      clonedTemplateCount,
    } satisfies Resp);
  } catch (e: any) {
    await cleanup();
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to create account') } satisfies Resp, { status: 500 });
  }
}

