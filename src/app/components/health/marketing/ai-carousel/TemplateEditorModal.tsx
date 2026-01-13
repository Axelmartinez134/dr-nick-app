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

const FONT_OPTIONS = [
  { label: 'Inter', family: 'Inter', weight: 400 },
  { label: 'Poppins', family: 'Poppins', weight: 400 },
  { label: 'Montserrat (Regular)', family: 'Montserrat', weight: 400 },
  { label: 'Montserrat (Bold)', family: 'Montserrat', weight: 700 },
  { label: 'Playfair Display', family: 'Playfair Display', weight: 400 },
  { label: 'Open Sans (Light)', family: 'Open Sans', weight: 300 },
  { label: 'Noto Serif (Regular)', family: 'Noto Serif', weight: 400 },
  { label: 'Droid Serif (Regular)', family: 'Droid Serif', weight: 400 },
  { label: 'Noto Serif Condensed (Medium)', family: 'Noto Serif Condensed', weight: 500 },
];

const fontKey = (family: string, weight: number) => `${family}@@${weight}`;

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
    allowedFonts: FONT_OPTIONS.map((f) => f.family),
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
  const [savedPulse, setSavedPulse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<Array<{ id: string; type: string; name: string; zIndex: number }>>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState<string>('');
  const [ctxMenu, setCtxMenu] = useState<null | { x: number; y: number; layerId: string }>(null);
  const [ctxFont, setCtxFont] = useState<string>(fontKey('Inter', 400));
  const [ctxSize, setCtxSize] = useState<number>(36);
  const [ctxItalic, setCtxItalic] = useState(false);

  const [newTemplateName, setNewTemplateName] = useState('Dr Nick IG');

  // Template text is edited directly on-canvas (layers), not via special form fields.

  const canEdit = useMemo(() => open, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveTemplateId(props.currentTemplateId);
    setDefinition(props.currentTemplateSnapshot || defaultDefinition());
    setError(null);
    setTemplateName('');
    setSavedPulse(false);
    setSelectedLayerId(null);
    setEditingLayerId(null);
    setEditingLayerName('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard shortcuts (Template Editor only):
  // - Cmd/Ctrl+Z: undo
  // - Delete/Backspace: delete selected layer (not content region)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Undo (Cmd/Ctrl+Z)
      const isUndo = (e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey);
      if (isUndo) {
        e.preventDefault();
        if (editingLayerId) return;
        canvasRef.current?.undo?.();
        const next = canvasRef.current?.exportDefinition() || definition;
        setDefinition(next);
        const nextLayers = canvasRef.current?.getLayers?.() || [];
        setLayers(nextLayers.map((l: any) => ({ id: l.id, type: l.type, name: l.name, zIndex: l.zIndex ?? 0 })));
        return;
      }

      // Delete selected layer
      const isDelete = e.key === 'Backspace' || e.key === 'Delete';
      if (isDelete) {
        if (editingLayerId) return;
        if (!selectedLayerId) return;
        if (selectedLayerId === '__content_region__') return;
        e.preventDefault();
        canvasRef.current?.deleteLayer?.(selectedLayerId);
        const next = canvasRef.current?.exportDefinition() || definition;
        setDefinition(next);
        const nextLayers = canvasRef.current?.getLayers?.() || [];
        setLayers(nextLayers.map((l: any) => ({ id: l.id, type: l.type, name: l.name, zIndex: l.zIndex ?? 0 })));
        setSelectedLayerId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, editingLayerId, selectedLayerId, definition]);

  useEffect(() => {
    if (!open) return;
    // When we have a template snapshot, hydrate canvas and text fields from it.
    const def = props.currentTemplateSnapshot || definition;
    const next = JSON.parse(JSON.stringify(def)) as CarouselTemplateDefinitionV1;
    ensureTextAsset(next, 'display_name');
    ensureTextAsset(next, 'handle');
    ensureTextAsset(next, 'cta_text');
    setDefinition(next);
    canvasRef.current?.loadDefinition(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Refresh layers list (best-effort) when definition changes / after load/upload/save.
  useEffect(() => {
    if (!open) return;
    const next = canvasRef.current?.getLayers?.() || [];
    setLayers(next.map((l: any) => ({ id: l.id, type: l.type, name: l.name, zIndex: l.zIndex ?? 0 })));
  }, [open, definition, activeTemplateId]);

  const commitLayerRename = () => {
    if (!editingLayerId) return;
    const next = String(editingLayerName || '').trim();
    if (!next) {
      setEditingLayerId(null);
      setEditingLayerName('');
      return;
    }
    canvasRef.current?.renameLayer?.(editingLayerId, next);
    const updated = canvasRef.current?.exportDefinition() || definition;
    setDefinition(updated);
    // Refresh layers from canvas/definition
    const nextLayers = canvasRef.current?.getLayers?.() || [];
    setLayers(nextLayers.map((l: any) => ({ id: l.id, type: l.type, name: l.name, zIndex: l.zIndex ?? 0 })));
    setEditingLayerId(null);
    setEditingLayerName('');
  };

  const closeCtxMenu = () => setCtxMenu(null);

  const openTextContextMenuForLayer = (layerId: string, clientX: number, clientY: number) => {
    if (!layerId || layerId === '__content_region__') return;
    const layer = layers.find((x) => x.id === layerId);
    if (layer?.type !== 'text') return;

    const style = canvasRef.current?.getTextLayerStyle?.(layerId);
    if (!style) return;

    const fam = style.fontFamily || 'Inter';
    const weightRaw = style.fontWeight;
    const weight =
      typeof weightRaw === 'number'
        ? weightRaw
        : weightRaw === 'bold'
        ? 700
        : weightRaw === 'normal'
        ? 400
        : 400;
    setCtxFont(fontKey(fam, weight));
    setCtxSize(Number(style.fontSize || 36));
    setCtxItalic(String(style.fontStyle || 'normal') === 'italic');
    setCtxMenu({ x: clientX, y: clientY, layerId });
  };

  useEffect(() => {
    if (!open) return;
    if (!ctxMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCtxMenu();
    };
    const onClick = () => closeCtxMenu();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, ctxMenu]);

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

  const duplicateTemplate = async () => {
    if (!activeTemplateId) {
      setError('Select a template first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/marketing/carousel/templates/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ sourceTemplateId: activeTemplateId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to duplicate template');
      props.onRefreshTemplates();
      // Auto-open the duplicate for editing immediately.
      await loadTemplateById(json.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to duplicate template');
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
    setSavedPulse(false);
    try {
      const exported = canvasRef.current?.exportDefinition() || definition;
      // NOTE: Template text layers are now treated as normal layers on the canvas.
      // We do not "sync" special fields (display_name/handle/cta_text) from form inputs anymore.

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
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 1000);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onMouseDown={(e) => {
        // Backdrop click closes (same behavior as ✕).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-black">Template Editor</h2>
            <p className="text-xs text-black">Assets/text here are locked in normal editing.</p>
            <p className="mt-1 text-[11px] text-black/70">
              Edits affect all projects using this template. Use <span className="font-medium">Duplicate</span> for a project-specific version.
            </p>
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
                <option value="">Select Template</option>
                {props.templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="text-sm font-medium text-black mb-2">Create new template</div>
              <div className="space-y-2">
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
                <button
                  onClick={duplicateTemplate}
                  disabled={saving || !activeTemplateId}
                  className="w-full px-4 py-2 bg-white border border-gray-300 text-black rounded text-sm font-medium disabled:opacity-50"
                  title={activeTemplateId ? 'Duplicate selected template' : 'Select a template first'}
                >
                  Duplicate selected
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
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-black">Layers</div>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-black text-white rounded text-xs font-medium disabled:bg-black/30 disabled:text-white"
                    disabled={saving}
                    onClick={() => {
                      canvasRef.current?.addTextLayer?.();
                      const next = canvasRef.current?.exportDefinition() || definition;
                      setDefinition(next);
                    }}
                  >
                    + Text
                  </button>
                </div>
                <div className="border border-gray-200 rounded bg-white max-h-56 overflow-y-auto">
                  {layers.length === 0 ? (
                    <div className="p-3 text-sm text-black/60">No layers yet.</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {layers.map((l) => (
                        <div
                          key={l.id}
                          className={[
                            "w-full px-3 py-2 text-sm text-black hover:bg-gray-50 flex items-center justify-between gap-2",
                            selectedLayerId === l.id ? "bg-gray-50" : "",
                          ].join(" ")}
                          onContextMenu={(e) => {
                            // Right-click / two-finger click on a text layer row opens the Text Settings menu.
                            if (l.type !== 'text') return;
                            if (l.id === '__content_region__') return;
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedLayerId(l.id);
                            canvasRef.current?.selectLayer?.(l.id);
                            openTextContextMenuForLayer(l.id, e.clientX, e.clientY);
                          }}
                          onDoubleClick={(e) => {
                            // Double-click a TEXT layer row to start editing the text on canvas.
                            // This works even if macOS/Chrome doesn't trigger dblclick reliably on the Fabric object.
                            if (editingLayerId) return;
                            if (l.type !== 'text') return;
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedLayerId(l.id);
                            canvasRef.current?.selectLayer?.(l.id);
                            canvasRef.current?.startTextEditing?.(l.id);
                          }}
                        >
                          <button
                            type="button"
                            className="flex-1 text-left truncate"
                            onClick={() => {
                              setSelectedLayerId(l.id);
                              canvasRef.current?.selectLayer?.(l.id);
                            }}
                          >
                            {editingLayerId === l.id ? (
                              <input
                                autoFocus
                                value={editingLayerName}
                                onChange={(e) => setEditingLayerName(e.target.value)}
                                onBlur={commitLayerRename}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitLayerRename();
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditingLayerId(null);
                                    setEditingLayerName('');
                                  }
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-black bg-white"
                              />
                            ) : (
                              <span
                                className="truncate"
                                onClick={(e) => {
                                  // Single-click renaming, per spec.
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditingLayerId(l.id);
                                  setEditingLayerName(l.name);
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditingLayerId(l.id);
                                  setEditingLayerName(l.name);
                                }}
                                title="Click to rename"
                              >
                                {l.name}
                              </span>
                            )}
                            <span className="ml-2 text-xs text-black/50">{l.type}</span>
                          </button>
                          {l.id !== "__content_region__" ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                className="h-7 w-7 border border-gray-200 rounded text-black/70 hover:bg-white"
                                title="Move up"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  canvasRef.current?.reorderLayer?.(l.id, "up");
                                  const next = canvasRef.current?.exportDefinition() || definition;
                                  setDefinition(next);
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="h-7 w-7 border border-gray-200 rounded text-black/70 hover:bg-white"
                                title="Move down"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  canvasRef.current?.reorderLayer?.(l.id, "down");
                                  const next = canvasRef.current?.exportDefinition() || definition;
                                  setDefinition(next);
                                }}
                              >
                                ↓
                              </button>
                              {selectedLayerId === l.id ? (
                                <button
                                  type="button"
                                  className="h-7 w-7 border border-gray-200 rounded text-red-700 hover:bg-red-50"
                                  title="Delete"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    canvasRef.current?.deleteLayer?.(l.id);
                                    const next = canvasRef.current?.exportDefinition() || definition;
                                    setDefinition(next);
                                    const nextLayers = canvasRef.current?.getLayers?.() || [];
                                    setLayers(nextLayers.map((x: any) => ({ id: x.id, type: x.type, name: x.name, zIndex: x.zIndex ?? 0 })));
                                    setSelectedLayerId(null);
                                  }}
                                >
                                  🗑
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-black/60">
                  Click a layer to select it on the canvas.
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
              {savedPulse ? (
                <span className="text-xs font-semibold text-green-700 animate-pulse">Saved ✓</span>
              ) : null}
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
            <div
              className="relative"
              onContextMenu={(e) => {
                // Context menu for text styling in Template Editor (right-click / two-finger click).
                e.preventDefault();
                e.stopPropagation();

                // Prefer current Fabric selection if available; fallback to selected layer in the list.
                const activeId = canvasRef.current?.getActiveLayerId?.() || selectedLayerId;
                if (!activeId) return;
                openTextContextMenuForLayer(activeId, e.clientX, e.clientY);
              }}
            >
              <TemplateEditorCanvas ref={canvasRef} initialDefinition={definition} />

              {ctxMenu ? (
                <div
                  className="fixed z-[200] bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-[260px]"
                  style={{ left: ctxMenu.x, top: ctxMenu.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-semibold text-black mb-2">Text settings</div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-[11px] font-semibold text-black/70 mb-1">Font</div>
                      <select
                        className="w-full h-9 rounded-md border border-gray-200 px-2 text-sm text-black bg-white"
                        value={ctxFont}
                        onChange={(e) => {
                          const raw = e.target.value || '';
                          setCtxFont(raw);
                          const [family, w] = raw.split('@@');
                          const weight = Number(w);
                          canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, {
                            fontFamily: family,
                            fontWeight: Number.isFinite(weight) ? weight : 400,
                          });
                          const next = canvasRef.current?.exportDefinition() || definition;
                          setDefinition(next);
                        }}
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={fontKey(f.family, f.weight)} value={fontKey(f.family, f.weight)}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-black/70 mb-1">Size</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="h-9 w-9 border border-gray-200 rounded text-black/70"
                          onClick={() => {
                            const nextSize = Math.max(1, Math.round((ctxSize || 1) - 1));
                            setCtxSize(nextSize);
                            canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, { fontSize: nextSize });
                            const next = canvasRef.current?.exportDefinition() || definition;
                            setDefinition(next);
                          }}
                        >
                          −
                        </button>
                        <input
                          className="h-9 w-20 border border-gray-200 rounded px-2 text-sm text-black"
                          value={String(ctxSize ?? '')}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setCtxSize(n);
                          }}
                          onBlur={() => {
                            const n = Number(ctxSize);
                            if (!Number.isFinite(n)) return;
                            const nextSize = Math.max(1, Math.round(n));
                            setCtxSize(nextSize);
                            canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, { fontSize: nextSize });
                            const next = canvasRef.current?.exportDefinition() || definition;
                            setDefinition(next);
                          }}
                        />
                        <button
                          type="button"
                          className="h-9 w-9 border border-gray-200 rounded text-black/70"
                          onClick={() => {
                            const nextSize = Math.max(1, Math.round((ctxSize || 1) + 1));
                            setCtxSize(nextSize);
                            canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, { fontSize: nextSize });
                            const next = canvasRef.current?.exportDefinition() || definition;
                            setDefinition(next);
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="h-9 px-3 border border-gray-200 rounded text-sm text-black"
                        onClick={() => {
                          const style = canvasRef.current?.getTextLayerStyle?.(ctxMenu.layerId);
                          const cur = style?.fontWeight;
                          const isBold = cur === 'bold' || (typeof cur === 'number' && cur >= 600);
                          const nextWeight = isBold ? 400 : 700;
                          canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, { fontWeight: nextWeight });
                          const next = canvasRef.current?.exportDefinition() || definition;
                          setDefinition(next);
                        }}
                      >
                        Bold
                      </button>
                      <button
                        type="button"
                        className="h-9 px-3 border border-gray-200 rounded text-sm text-black"
                        onClick={() => {
                          const nextItalic = !ctxItalic;
                          setCtxItalic(nextItalic);
                          canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, { fontStyle: nextItalic ? 'italic' : 'normal' });
                          const next = canvasRef.current?.exportDefinition() || definition;
                          setDefinition(next);
                        }}
                      >
                        Italic
                      </button>
                      <button
                        type="button"
                        className="h-9 px-3 border border-gray-200 rounded text-sm text-black"
                        onClick={() => {
                          const [family, w] = (ctxFont || '').split('@@');
                          const weight = Number(w);
                          canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, {
                            fontFamily: family || 'Inter',
                            fontWeight: Number.isFinite(weight) ? weight : 400,
                            fontStyle: 'normal',
                          });
                          setCtxItalic(false);
                          const next = canvasRef.current?.exportDefinition() || definition;
                          setDefinition(next);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


