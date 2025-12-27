'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../auth/AuthContext';
import TemplateEditorCanvas, { TemplateEditorCanvasHandle } from './TemplateEditorCanvas';
import type {
  CarouselTemplateDefinitionV1,
  TemplateImageAsset,
  TemplateTextAsset,
  TemplateTextStyle,
} from '@/lib/carousel-template-types';

const FONT_OPTIONS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display'];

function defaultDefinition(): CarouselTemplateDefinitionV1 {
  return {
    template_version: 1,
    slides: [
      {
        slideIndex: 0,
        contentRegion: { x: 0, y: 0, width: 1080, height: 1440 },
        assets: [],
      },
    ],
    allowedFonts: FONT_OPTIONS,
  };
}

function ensureTextAsset(def: CarouselTemplateDefinitionV1, kind: 'display_name' | 'handle' | 'cta_text'): TemplateTextAsset {
  const slide0 = def.slides.find(s => s.slideIndex === 0) || def.slides[0];
  const existing = (slide0.assets || []).find((a: any) => a.type === 'text' && a.kind === kind) as TemplateTextAsset | undefined;
  if (existing) return existing;

  const baseStyle: TemplateTextStyle = {
    fontFamily: 'Inter',
    fontSize: kind === 'display_name' ? 36 : 28,
    fontWeight: kind === 'display_name' ? 'bold' : 'normal',
    fill: '#111827',
    textAlign: 'left',
  };

  const rect =
    kind === 'cta_text'
      ? { x: 780, y: 1320, width: 240, height: 60 }
      : kind === 'handle'
        ? { x: 140, y: 115, width: 500, height: 40 }
        : { x: 140, y: 70, width: 500, height: 45 };

  const created: TemplateTextAsset = {
    id: kind,
    type: 'text',
    kind,
    rect,
    text: kind === 'display_name' ? 'Dr. Nick' : kind === 'handle' ? '@drnick' : 'READ MORE',
    style: baseStyle,
    locked: false,
    zIndex: 10,
    rotation: 0,
  };

  slide0.assets.push(created as any);
  return created;
}

export default function TemplateEditorModal(props: {
  open: boolean;
  onClose: () => void;
  templates: Array<{ id: string; name: string; updatedAt: string }>;
  currentTemplateId: string | null;
  currentTemplateSnapshot: CarouselTemplateDefinitionV1 | null;
  onTemplateSaved: (templateId: string, nextDefinition: CarouselTemplateDefinitionV1) => void;
  onRefreshTemplates: () => void;
}) {
  const { open, onClose } = props;
  const canvasRef = useRef<TemplateEditorCanvasHandle | null>(null);

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(props.currentTemplateId);
  const [templateName, setTemplateName] = useState('');
  const [definition, setDefinition] = useState<CarouselTemplateDefinitionV1>(props.currentTemplateSnapshot || defaultDefinition());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newTemplateName, setNewTemplateName] = useState('Dr Nick IG');

  const [displayName, setDisplayName] = useState('Dr. Nick');
  const [handle, setHandle] = useState('@drnick');
  const [ctaText, setCtaText] = useState('READ MORE');

  const [textFont, setTextFont] = useState('Inter');
  const [textColor, setTextColor] = useState('#111827');

  const canEdit = useMemo(() => open, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveTemplateId(props.currentTemplateId);
    setDefinition(props.currentTemplateSnapshot || defaultDefinition());
    setError(null);
    setTemplateName('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // When we have a template snapshot, hydrate canvas and text fields from it.
    const def = props.currentTemplateSnapshot || definition;
    const next = JSON.parse(JSON.stringify(def)) as CarouselTemplateDefinitionV1;
    const dn = ensureTextAsset(next, 'display_name');
    const h = ensureTextAsset(next, 'handle');
    const cta = ensureTextAsset(next, 'cta_text');
    setDisplayName(dn.text);
    setHandle(h.text);
    setCtaText(cta.text);
    setTextFont(dn.style.fontFamily || 'Inter');
    setTextColor(dn.style.fill || '#111827');
    setDefinition(next);
    canvasRef.current?.loadDefinition(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const loadTemplateById = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/marketing/carousel/templates/load?id=${id}`, { headers });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load template');
      const def = json.template.definition as CarouselTemplateDefinitionV1;
      const next = JSON.parse(JSON.stringify(def || defaultDefinition())) as CarouselTemplateDefinitionV1;
      ensureTextAsset(next, 'display_name');
      ensureTextAsset(next, 'handle');
      ensureTextAsset(next, 'cta_text');
      setActiveTemplateId(id);
      setTemplateName(json.template.name || '');
      setDefinition(next);
      canvasRef.current?.loadDefinition(next);
    } catch (e: any) {
      setError(e?.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/marketing/carousel/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: newTemplateName, definition: defaultDefinition() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create template');
      props.onRefreshTemplates();
      await loadTemplateById(json.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    if (!activeTemplateId) {
      setError('No template selected');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const exported = canvasRef.current?.exportDefinition() || definition;
      const slide0 = exported.slides.find(s => s.slideIndex === 0) || exported.slides[0];

      // Sync the 3 key text assets from form inputs.
      const dn = ensureTextAsset(exported, 'display_name');
      const h = ensureTextAsset(exported, 'handle');
      const cta = ensureTextAsset(exported, 'cta_text');
      dn.text = displayName;
      h.text = handle;
      cta.text = ctaText;

      dn.style = { ...(dn.style || {}), fontFamily: textFont, fill: textColor };
      h.style = { ...(h.style || {}), fontFamily: textFont, fill: textColor };
      cta.style = { ...(cta.style || {}), fontFamily: textFont, fill: textColor };

      slide0.assets = slide0.assets.map((a: any) => {
        if (a.type !== 'text') return a;
        if (a.kind === 'display_name') return dn;
        if (a.kind === 'handle') return h;
        if (a.kind === 'cta_text') return cta;
        return a;
      });

      const headers = await authHeaders();
      const res = await fetch('/api/marketing/carousel/templates/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          id: activeTemplateId,
          name: templateName || undefined,
          definition: exported,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save template');
      setDefinition(exported);
      props.onTemplateSaved(activeTemplateId, exported);
      props.onRefreshTemplates();
    } catch (e: any) {
      setError(e?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (file: File) => {
    if (!activeTemplateId) {
      setError('Create or select a template first (then upload assets).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const assetId = crypto.randomUUID();
      const fd = new FormData();
      fd.set('file', file);
      fd.set('templateId', activeTemplateId);
      fd.set('assetId', assetId);
      const res = await fetch('/api/marketing/carousel/templates/upload-asset', {
        method: 'POST',
        headers,
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Upload failed');

      const img: TemplateImageAsset = {
        id: assetId,
        type: 'image',
        // We treat all uploaded images as generic template image assets.
        // Their identity is determined by their position/size in the template.
        kind: 'other_image',
        rect: { x: 60, y: 180, width: 200, height: 200 },
        src: {
          bucket: 'carousel-templates',
          path: json.path,
          url: json.url,
          contentType: json.contentType,
        },
        zIndex: 1,
        locked: false,
        rotation: 0,
      };

      canvasRef.current?.addOrReplaceImageAsset(img);
      // Keep local definition in sync too (authoritative on save will come from exportDefinition)
      const next = canvasRef.current?.exportDefinition() || definition;
      setDefinition(next);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAsset(file);
    e.target.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-black">Template Editor (Slide 1)</h2>
            <p className="text-xs text-black">Admin-only. Assets/text here are locked in normal editing.</p>
          </div>
          <button onClick={onClose} className="text-black hover:text-black" title="Close">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-black">Template</label>
              <select
                value={activeTemplateId || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setActiveTemplateId(null);
                    setDefinition(defaultDefinition());
                    canvasRef.current?.loadDefinition(defaultDefinition());
                    return;
                  }
                  void loadTemplateById(v);
                }}
                className="px-3 py-2 border border-gray-300 rounded bg-white text-sm font-medium text-black disabled:text-black"
                disabled={loading || saving}
              >
                <option value="">(select template)</option>
                {props.templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="text-sm font-medium text-black mb-2">Create new template</div>
              <div className="flex items-center gap-2">
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder:text-black/50 disabled:text-black"
                  placeholder="Template name..."
                  disabled={saving}
                />
                <button
                  onClick={createTemplate}
                  disabled={saving || !newTemplateName.trim()}
                  className="px-4 py-2 bg-black text-white rounded text-sm font-medium disabled:bg-black/30 disabled:text-white"
                >
                  Create
                </button>
              </div>
              <p className="text-xs text-black mt-2">
                After creating, upload assets + position them, then set the contentRegion.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Template name</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder:text-black/50 disabled:text-black"
                  placeholder="e.g. Dr Nick IG"
                  disabled={!canEdit}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-black mb-1">Template images</label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onPickFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!activeTemplateId) {
                          setError('Create or select a template first (then upload assets).');
                          return;
                        }
                        uploadInputRef.current?.click();
                      }}
                      disabled={saving}
                      className="px-4 py-2 bg-black text-white rounded text-sm font-medium disabled:bg-black/30 disabled:text-white"
                    >
                      Upload image asset
                    </button>
                    <div className="text-xs text-black">
                      Upload any image and then drag/resize it into position on the canvas.
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="text-sm font-medium text-black mb-2">Template text</div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Display name</label>
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2 border rounded text-sm text-black placeholder:text-black/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Handle</label>
                    <input value={handle} onChange={(e) => setHandle(e.target.value)} className="w-full px-3 py-2 border rounded text-sm text-black placeholder:text-black/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">CTA text</label>
                    <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="w-full px-3 py-2 border rounded text-sm text-black placeholder:text-black/50" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Font</label>
                    <select value={textFont} onChange={(e) => setTextFont(e.target.value)} className="w-full px-3 py-2 border rounded text-sm text-black">
                      {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Color</label>
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-10 border rounded" />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={saveTemplate}
                disabled={!activeTemplateId || saving}
                className="px-5 py-2 bg-black text-white rounded font-medium disabled:bg-black/30 disabled:text-white"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
              <button
                onClick={() => {
                  if (!activeTemplateId) return;
                  props.onTemplateSaved(activeTemplateId, canvasRef.current?.exportDefinition() || definition);
                  onClose();
                }}
                className="px-5 py-2 border border-gray-300 rounded font-medium text-black"
              >
                Done
              </button>
            </div>

            <p className="text-xs text-black">
              Tip: drag/resize assets and the dashed contentRegion box directly on the canvas. Rotation is disabled.
            </p>
          </div>

          <div className="flex items-start justify-center">
            <TemplateEditorCanvas ref={canvasRef} initialDefinition={definition} />
          </div>
        </div>
      </div>
    </div>
  );
}


