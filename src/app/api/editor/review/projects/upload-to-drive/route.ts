import 'server-only';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { google, docs_v1, drive_v3 } from 'googleapis';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function makeDebugId() {
  return `drive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isDriveDebugEnabled() {
  const raw = String(process.env.GOOGLE_DRIVE_DEBUG || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function getGoogleDriveAuth() {
  const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || '').trim();
  const refreshToken = String(process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error(
      'Missing Google Drive OAuth env vars. Expected GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, GOOGLE_DRIVE_OAUTH_REDIRECT_URI, and GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN.'
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({
    refresh_token: refreshToken,
  });
  return auth;
}

function escapeDriveQueryValue(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function sanitizeFolderName(input: string): string {
  const raw = String(input || '').trim() || 'Untitled Project';
  return raw.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Untitled Project';
}

function normalizeDriveFolderId(input: unknown): string | null {
  const raw = typeof input === 'string' ? input : input == null ? '' : String(input);
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {
      const pathMatch = url.pathname.match(/\/(?:drive\/folders|folders)\/([A-Za-z0-9_-]+)/);
      const queryId = url.searchParams.get('id');
      candidate = pathMatch?.[1] || queryId || '';
    }
  } catch {
    // Treat as raw id.
  }

  const next = String(candidate || '').trim();
  return /^[A-Za-z0-9_-]{10,}$/.test(next) ? next : null;
}

async function requireSuperadmin(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: authed.error }, { status: authed.status }) };
  }

  const { supabase, user } = authed;
  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: acct.error }, { status: acct.status }) };
  }

  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: saErr.message }, { status: 500 }) };
  }
  if (!saRow?.user_id) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true as const, supabase, accountId: acct.accountId };
}

async function findExactChildFolderId(args: {
  drive: drive_v3.Drive;
  parentFolderId: string;
  folderName: string;
}): Promise<string | null> {
  const q =
    `'${escapeDriveQueryValue(args.parentFolderId)}' in parents and trashed = false and ` +
    `mimeType = '${FOLDER_MIME}' and name = '${escapeDriveQueryValue(args.folderName)}'`;
  const res = await args.drive.files.list({
    q,
    fields: 'files(id,name)',
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  const match = Array.isArray(res.data.files) ? res.data.files[0] : null;
  return match?.id ? String(match.id) : null;
}

async function resolveNextFolderName(args: {
  drive: drive_v3.Drive;
  parentFolderId: string;
  baseName: string;
}): Promise<string> {
  const firstExists = await findExactChildFolderId({
    drive: args.drive,
    parentFolderId: args.parentFolderId,
    folderName: args.baseName,
  });
  if (!firstExists) return args.baseName;

  for (let version = 1; version < 500; version += 1) {
    const nextName = `${args.baseName} V${version}`;
    const existing = await findExactChildFolderId({
      drive: args.drive,
      parentFolderId: args.parentFolderId,
      folderName: nextName,
    });
    if (!existing) return nextName;
  }

  throw new Error('Could not resolve a unique Drive folder version');
}

export async function POST(req: NextRequest) {
  const debugId = makeDebugId();
  const debugEnabled = isDriveDebugEnabled();
  const debug: string[] = [];
  const log = (msg: string, extra?: Record<string, unknown>) => {
    if (!debugEnabled) return;
    const line = extra ? `${msg} ${JSON.stringify(extra)}` : msg;
    debug.push(line);
    console.log(`[upload-to-drive][${debugId}] ${line}`);
  };
  const logError = (msg: string, extra?: Record<string, unknown>) => {
    const line = extra ? `${msg} ${JSON.stringify(extra)}` : msg;
    if (debugEnabled) debug.push(`ERROR: ${line}`);
    console.error(`[upload-to-drive][${debugId}] ${debugEnabled ? line : msg}`);
  };
  const respondError = (status: number, error: string, extra?: Record<string, unknown>) =>
    NextResponse.json(
      {
        success: false,
        error,
        debugId,
        ...(debugEnabled ? { debug, ...(extra || {}) } : {}),
      },
      { status }
    );

  log('request:start');
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.response;
  log('auth:superadmin-ok', { accountId: auth.accountId });

  let form: FormData;
  try {
    form = await req.formData();
    log('request:formdata-ok');
  } catch {
    logError('request:formdata-failed');
    return respondError(400, 'Invalid multipart form data');
  }

  const projectId = String(form.get('projectId') || '').trim();
  const projectTitleFromClient = String(form.get('projectTitle') || '').trim();
  const slides = form.getAll('slides').filter((entry): entry is File => entry instanceof File);
  log('request:parsed-fields', {
    projectId,
    projectTitleFromClient,
    slideCount: slides.length,
    slideNames: slides.map((slide) => slide.name),
  });

  if (!projectId) {
    logError('request:missing-project-id');
    return respondError(400, 'projectId is required');
  }
  if (slides.length !== 6) {
    logError('request:invalid-slide-count', { slideCount: slides.length });
    return respondError(400, 'Expected 6 slide PNG files');
  }
  {
    const expectedNames = new Set(Array.from({ length: 6 }).map((_, index) => `slide-${index + 1}.png`));
    const seenNames = new Set<string>();
    for (const slide of slides) {
      const name = String(slide.name || '').trim();
      const mimeType = String(slide.type || '').trim().toLowerCase();
      if (!expectedNames.has(name) || seenNames.has(name)) {
        logError('request:invalid-slide-name', { name });
        return respondError(400, 'Slides must be uploaded as slide-1.png through slide-6.png');
      }
      if (mimeType && mimeType !== 'image/png') {
        logError('request:invalid-slide-type', { name, mimeType });
        return respondError(400, 'All uploaded slides must be PNG files');
      }
      seenNames.add(name);
    }
  }

  const { data: settingsRow, error: settingsErr } = await auth.supabase
    .from('editor_account_settings')
    .select('google_drive_folder_id')
    .eq('account_id', auth.accountId)
    .maybeSingle();
  if (settingsErr) {
    logError('settings:query-failed', { message: settingsErr.message });
    return respondError(500, settingsErr.message);
  }

  const parentFolderId = normalizeDriveFolderId((settingsRow as any)?.google_drive_folder_id);
  log('settings:folder-id-loaded', { parentFolderId: parentFolderId || null });
  if (!parentFolderId) {
    logError('settings:missing-folder-id');
    return respondError(400, 'Missing or invalid Drive Folder ID for this account');
  }

  const { data: projectRow, error: projectErr } = await auth.supabase
    .from('carousel_projects')
    .select('id, title, caption, review_ready, review_posted')
    .eq('id', projectId)
    .eq('account_id', auth.accountId)
    .is('archived_at', null)
    .maybeSingle();
  if (projectErr) {
    logError('project:query-failed', { message: projectErr.message });
    return respondError(500, projectErr.message);
  }
  if (!projectRow?.id) {
    logError('project:not-found', { projectId });
    return respondError(404, 'Project not found');
  }
  log('project:found', {
    title: String((projectRow as any)?.title || ''),
    reviewReady: !!(projectRow as any)?.review_ready,
    reviewPosted: !!(projectRow as any)?.review_posted,
  });

  let drive: drive_v3.Drive | null = null;
  let docs: docs_v1.Docs | null = null;
  let createdFolderId: string | null = null;
  try {
    if (!(projectRow as any)?.review_ready || !!(projectRow as any)?.review_posted) {
      throw new RouteError(409, 'Only ready, unposted projects can be uploaded to Drive');
    }

    log('google-auth:init:start', {
      hasClientId: !!String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || '').trim(),
      hasClientSecret: !!String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || '').trim(),
      hasRedirectUri: !!String(process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || '').trim(),
      hasRefreshToken: !!String(process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN || '').trim(),
    });
    const authClient = getGoogleDriveAuth();
    log('google-auth:init:ok');
    drive = google.drive({ version: 'v3', auth: authClient });
    docs = google.docs({ version: 'v1', auth: authClient });
    log('drive:validate-parent-folder:start', { parentFolderId });
    let parentMeta: drive_v3.Schema$File | null = null;
    try {
      const parentRes = await drive.files.get({
        fileId: parentFolderId,
        fields: 'id,name,mimeType,trashed',
        supportsAllDrives: true,
      });
      parentMeta = parentRes.data || null;
    } catch (e: any) {
      logError('drive:validate-parent-folder:failed', {
        message: String(e?.message || e || 'Unknown error'),
        status: Number((e as any)?.code || (e as any)?.response?.status || 0) || null,
      });
      throw new RouteError(400, 'Configured Drive Folder ID was not found or is not accessible');
    }
    if (!parentMeta?.id || parentMeta.mimeType !== FOLDER_MIME || parentMeta.trashed) {
      logError('drive:validate-parent-folder:invalid', {
        mimeType: parentMeta?.mimeType || null,
        trashed: !!parentMeta?.trashed,
      });
      throw new RouteError(400, 'Configured Drive Folder ID is not an active Google Drive folder');
    }
    log('drive:validate-parent-folder:ok', { name: parentMeta.name || null });

    const baseName = sanitizeFolderName(projectTitleFromClient || String((projectRow as any)?.title || 'Untitled Project'));
    log('drive:resolve-folder-name:start', { baseName, parentFolderId });
    const folderName = await resolveNextFolderName({ drive, parentFolderId, baseName });
    log('drive:resolve-folder-name:ok', { folderName });

    log('drive:create-folder:start', { folderName });
    const createdFolder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: FOLDER_MIME,
        parents: [parentFolderId],
      },
      fields: 'id,webViewLink',
      supportsAllDrives: true,
    });

    createdFolderId = String(createdFolder.data.id || '').trim();
    if (!createdFolderId) {
      throw new Error('Google Drive did not return a folder id');
    }
    log('drive:create-folder:ok', { folderId: createdFolderId, folderUrl: createdFolder.data.webViewLink || null });

    const orderedSlides = [...slides].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const slide of orderedSlides) {
      const bytes = Buffer.from(await slide.arrayBuffer());
      log('drive:upload-slide:start', { name: slide.name, bytes: bytes.length, mimeType: slide.type || 'image/png' });
      await drive.files.create({
        requestBody: {
          name: String(slide.name || 'slide.png'),
          parents: [createdFolderId],
        },
        media: {
          mimeType: slide.type || 'image/png',
          body: Readable.from(bytes),
        },
        fields: 'id',
        supportsAllDrives: true,
      });
      log('drive:upload-slide:ok', { name: slide.name });
    }

    log('drive:create-caption-doc:start');
    const createdCaptionDoc = await drive.files.create({
      requestBody: {
        name: 'Caption',
        mimeType: GOOGLE_DOC_MIME,
        parents: [createdFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    const captionDocId = String(createdCaptionDoc.data.id || '').trim();
    if (!captionDocId) {
      throw new Error('Google Drive did not return a caption doc id');
    }
    log('drive:create-caption-doc:ok', { docId: captionDocId });

    const captionText = String((projectRow as any)?.caption || '');
    if (captionText && docs) {
      log('docs:write-caption:start', { length: captionText.length });
      await docs.documents.batchUpdate({
        documentId: captionDocId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: captionText,
              },
            },
          ],
        },
      });
      log('docs:write-caption:ok', { docId: captionDocId });
    }

    const folderUrl = String(createdFolder.data.webViewLink || `https://drive.google.com/drive/folders/${createdFolderId}`);
    log('supabase:update-project-url:start', { folderUrl });
    const { error: updateErr } = await auth.supabase
      .from('carousel_projects')
      .update({ review_drive_folder_url: folderUrl })
      .eq('id', projectId)
      .eq('account_id', auth.accountId)
      .is('archived_at', null);
    if (updateErr) {
      logError('supabase:update-project-url:failed', { message: updateErr.message });
      throw new RouteError(500, updateErr.message);
    }
    log('supabase:update-project-url:ok');

    return NextResponse.json({
      success: true,
      debugId,
      folderId: createdFolderId,
      folderName,
      folderUrl,
    });
  } catch (e: any) {
    let cleanupAttempted = false;
    let cleanupSucceeded = false;
    if (createdFolderId && drive) {
      cleanupAttempted = true;
      try {
        log('drive:cleanup-folder:start', { folderId: createdFolderId });
        await drive.files.update({
          fileId: createdFolderId,
          requestBody: { trashed: true },
          supportsAllDrives: true,
          fields: 'id,trashed',
        });
        cleanupSucceeded = true;
        log('drive:cleanup-folder:ok', { folderId: createdFolderId });
      } catch (cleanupErr: any) {
        logError('drive:cleanup-folder:failed', {
          folderId: createdFolderId,
          message: String(cleanupErr?.message || cleanupErr || 'Unknown cleanup error'),
          status: Number((cleanupErr as any)?.code || (cleanupErr as any)?.response?.status || 0) || null,
        });
      }
    }

    const status = e instanceof RouteError ? e.status : 500;
    const clientError = e instanceof RouteError ? e.message : 'Drive upload failed';
    const googleStatus = Number((e as any)?.code || (e as any)?.response?.status || 0) || null;
    const googleData = (e as any)?.response?.data ?? null;
    logError('request:failed', {
      message: String(e?.message || e || 'Drive upload failed'),
      status,
      googleStatus,
      googleData,
      cleanupAttempted,
      cleanupSucceeded,
      stack: String(e?.stack || '').split('\n').slice(0, 4).join(' | '),
    });
    return respondError(status, clientError, {
      googleStatus,
      googleData,
      cleanupAttempted,
      cleanupSucceeded,
    });
  }
}
