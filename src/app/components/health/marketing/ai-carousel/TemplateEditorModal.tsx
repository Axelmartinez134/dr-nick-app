'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../auth/AuthContext';
import TemplateEditorCanvas, { TemplateEditorCanvasHandle } from './TemplateEditorCanvas';
import type {
  CarouselTemplateDefinitionV1,
  TemplateImageAsset,
} from '@/lib/carousel-template-types';

const FONT_OPTIONS = [
  { label: 'Inter', family: 'Inter', weight: 400 },
  { label: 'Poppins', family: 'Poppins', weight: 400 },
  { label: 'Montserrat (Regular)', family: 'Montserrat', weight: 400 },
  { label: 'Montserrat (Medium)', family: 'Montserrat', weight: 500 },
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
  const [ctxFill, setCtxFill] = useState<string>('#111827');

  const [shapeMenu, setShapeMenu] = useState<null | { x: number; y: number; layerId: string }>(null);
  const [shapeKind, setShapeKind] = useState<'rect' | 'arrow_solid' | 'arrow_line'>('rect');
  const [shapeCornerRadius, setShapeCornerRadius] = useState<number>(0);
  const [shapeFill, setShapeFill] = useState<string>('#111827');
  const [shapeStroke, setShapeStroke] = useState<string>('#111827');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(0);
  const [shapeArrowHeadSizePx, setShapeArrowHeadSizePx] = useState<number>(120);

  const [imageMenu, setImageMenu] = useState<null | { x: number; y: number; layerId: string }>(null);
  const [imageMaskShape, setImageMaskShape] = useState<'none' | 'circle'>('none');
  const [imageCropEditingLayerId, setImageCropEditingLayerId] = useState<string | null>(null);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [addShapeDropdownValue, setAddShapeDropdownValue] = useState<string>('');

  // Template text is edited directly on-canvas (layers), not via special form fields.

  // Phase 0: prep for later Template Editor UX changes (no behavior change).
  const hasSelectedTemplate = Boolean(activeTemplateId);
  // Future UI state (next phases):
  // - Create section collapsed/expanded
  // - Lock editor controls + canvas until a template is selected

  // Phase 2: "Create new template" is click-to-open (collapsed by default).
  const [createSectionOpen, setCreateSectionOpen] = useState(false);

  // Phase 1: Template dropdown should be alphabetical (A→Z, case-insensitive),
  // tie-break by updatedAt newest-first (then keep original order).
  const sortedTemplates = useMemo(() => {
    const withIdx = (props.templates || []).map((t, idx) => ({ t, idx }));
    withIdx.sort((a, b) => {
      const an = String(a.t?.name || '').trim();
      const bn = String(b.t?.name || '').trim();
      const byName = an.localeCompare(bn, undefined, { sensitivity: 'base' });
      if (byName !== 0) return byName;

      const aTime = Date.parse(String(a.t?.updatedAt || '')) || 0;
      const bTime = Date.parse(String(b.t?.updatedAt || '')) || 0;
      if (aTime !== bTime) return bTime - aTime; // newest first

      return a.idx - b.idx; // stable
    });
    return withIdx.map((x) => x.t);
  }, [props.templates]);

  const canEdit = useMemo(() => open, [open]);

  // Phase 3: If no template is selected, force the UI into a safe "locked" state.
  useEffect(() => {
    if (!open) return;
    if (hasSelectedTemplate) return;
    // UX: when locked, keep "Create new template" open so the user can start immediately.
    setCreateSectionOpen(true);
    setCtxMenu(null);
    setShapeMenu(null);
    setImageMenu(null);
    setImageCropEditingLayerId(null);
    setSelectedLayerId(null);
    setEditingLayerId(null);
    setEditingLayerName('');
  }, [open, hasSelectedTemplate]);

  // UX: once a template is selected/loaded, close the create section.
  useEffect(() => {
    if (!open) return;
    if (!hasSelectedTemplate) return;
    setCreateSectionOpen(false);
  }, [open, hasSelectedTemplate]);

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
    setNewTemplateName('');
    setCreateSectionOpen(Boolean(!props.currentTemplateId));
    setImageCropEditingLayerId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard shortcuts (Template Editor only):
  // - Cmd/Ctrl+Z: undo
  // - Delete/Backspace: delete selected layer (not content region)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Phase 3: lock all editing shortcuts until a template is selected.
      if (!hasSelectedTemplate) return;

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
  }, [open, hasSelectedTemplate, editingLayerId, selectedLayerId, definition]);

  useEffect(() => {
    if (!open) return;
    // Hydrate the canvas from the provided snapshot (or current in-memory definition).
    // Important: do NOT auto-insert any seeded layers. Templates should be fully optional.
    const def = props.currentTemplateSnapshot || definition;
    const next = JSON.parse(JSON.stringify(def)) as CarouselTemplateDefinitionV1;
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
  const closeShapeMenu = () => setShapeMenu(null);
  const closeImageMenu = () => setImageMenu(null);

  const cloneDef = (d: CarouselTemplateDefinitionV1) => JSON.parse(JSON.stringify(d)) as CarouselTemplateDefinitionV1;
  const getSlide0 = (d: CarouselTemplateDefinitionV1) =>
    d.slides?.find((s) => s.slideIndex === 0) || d.slides?.[0] || { slideIndex: 0, contentRegion: { x: 0, y: 0, width: 1080, height: 1440 }, assets: [] };

  const patchImageAsset = (layerId: string, patch: Partial<TemplateImageAsset>) => {
    // IMPORTANT: the Fabric canvas is the source of truth for drag/resize changes.
    // If we patch from stale `definition`, toggling mask/crop can "snap" the image back to an older rect.
    const base = (canvasRef.current?.exportDefinition?.() as CarouselTemplateDefinitionV1 | undefined) || definition;
    const next = cloneDef(base);
    const slide0: any = getSlide0(next);
    const assets = Array.isArray(slide0.assets) ? (slide0.assets as any[]) : [];
    const idx = assets.findIndex((a) => a && String(a.id) === String(layerId) && a.type === 'image');
    if (idx === -1) return;
    assets[idx] = { ...(assets[idx] as any), ...patch };
    slide0.assets = assets;
    next.slides = [slide0];
    setDefinition(next);
    canvasRef.current?.loadDefinition(next);
  };

  const openTextContextMenuForLayer = (layerId: string, clientX: number, clientY: number) => {
    if (!hasSelectedTemplate) return;
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
    setCtxFill(String(style.fill || '#111827'));
    setCtxMenu({ x: clientX, y: clientY, layerId });
  };

  const openShapeContextMenuForLayer = (layerId: string, clientX: number, clientY: number) => {
    if (!hasSelectedTemplate) return;
    if (!layerId || layerId === '__content_region__') return;
    const layer = layers.find((x) => x.id === layerId);
    if (layer?.type !== 'shape') return;

    const style = canvasRef.current?.getShapeLayerStyle?.(layerId);
    if (!style) return;

    const kind = (style.shape === 'arrow_solid' || style.shape === 'arrow_line') ? style.shape : 'rect';
    setShapeKind(kind);
    setShapeCornerRadius(Number(style.cornerRadius || 0));
    setShapeFill(String(style.fill || '#111827'));
    setShapeStroke(String(style.stroke || '#111827'));
    setShapeStrokeWidth(Number(style.strokeWidth || 0));
    setShapeArrowHeadSizePx(Number(style.arrowHeadSizePx ?? 120));
    setShapeMenu({ x: clientX, y: clientY, layerId });
  };

  const openImageContextMenuForLayer = (layerId: string, clientX: number, clientY: number) => {
    if (!hasSelectedTemplate) return;
    if (!layerId || layerId === '__content_region__') return;
    const layer = layers.find((x) => x.id === layerId);
    if (layer?.type !== 'image') return;
    const base = (canvasRef.current?.exportDefinition?.() as CarouselTemplateDefinitionV1 | undefined) || definition;
    if (base !== definition) setDefinition(base);
    const slide0: any = getSlide0(base);
    const assets = Array.isArray(slide0.assets) ? (slide0.assets as any[]) : [];
    const asset = assets.find((a) => a && String(a.id) === String(layerId) && a.type === 'image');
    const mask = String(asset?.maskShape || 'none') === 'circle' ? 'circle' : 'none';
    setImageMaskShape(mask);
    setImageMenu({ x: clientX, y: clientY, layerId });
  };

  useEffect(() => {
    if (!open) return;
    if (!ctxMenu && !shapeMenu && !imageMenu && !imageCropEditingLayerId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (imageCropEditingLayerId) {
          e.preventDefault();
          e.stopPropagation();
          canvasRef.current?.finishImageCropMode?.();
          setImageCropEditingLayerId(null);
          // Sync definition so Save captures latest crop values.
          const next = canvasRef.current?.exportDefinition?.() || definition;
          setDefinition(next);
          return;
        }
        closeCtxMenu();
        closeShapeMenu();
        closeImageMenu();
      }
    };
    const onClick = () => {
      closeCtxMenu();
      closeShapeMenu();
      closeImageMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, ctxMenu, shapeMenu, imageMenu, imageCropEditingLayerId, definition]);

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const activeAccountId = (() => {
      try {
        return typeof localStorage !== 'undefined' ? String(localStorage.getItem('editor.activeAccountId') || '').trim() : '';
      } catch {
        return '';
      }
    })();
    return {
      Authorization: `Bearer ${session.access_token}`,
      ...(activeAccountId ? { 'x-account-id': activeAccountId } : {}),
    };
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
      // Phase 2 UX: auto-collapse after successful Create.
      setCreateSectionOpen(false);
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

      // Preserve the uploaded image aspect ratio on first insert.
      // Previously this was hard-coded to 200×200 which squished non-square images into 1:1.
      const uploadedUrl = String(json.url || '');
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        if (!uploadedUrl) return resolve({ w: 1, h: 1 });
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.onload = () => resolve({ w: imgEl.naturalWidth || imgEl.width || 1, h: imgEl.naturalHeight || imgEl.height || 1 });
        imgEl.onerror = () => resolve({ w: 1, h: 1 });
        imgEl.src = uploadedUrl;
      });

      const MAX_W = 420;
      const MAX_H = 420;
      const scale = Math.min(MAX_W / Math.max(1, dims.w), MAX_H / Math.max(1, dims.h), 1);
      const width = Math.max(40, Math.round(dims.w * scale));
      const height = Math.max(40, Math.round(dims.h * scale));

      const img: TemplateImageAsset = {
        id: assetId,
        type: 'image',
        // We treat all uploaded images as generic template image assets.
        // Their identity is determined by their position/size in the template.
        kind: 'other_image',
        rect: { x: 60, y: 180, width, height },
        src: {
          bucket: 'carousel-templates',
          path: json.path,
          url: uploadedUrl,
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

  const editorUnlocked = hasSelectedTemplate && !loading && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      data-has-selected-template={hasSelectedTemplate}
      onMouseDown={(e) => {
        // Backdrop click closes (same behavior as ✕).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-7xl bg-white rounded-lg shadow-xl overflow-hidden">
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

        {/* Layout note: the canvas has a fixed 540×720 display box, so we only enable 2-column layout
            at a wide breakpoint and reserve a fixed-width right column. Below that, stack vertically. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(420px,1fr)_560px] gap-6 p-6">
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
                    // Phase 3: discard any unsaved default edits and re-lock.
                    setError(null);
                    setCtxMenu(null);
                    setShapeMenu(null);
                    setSelectedLayerId(null);
                    setEditingLayerId(null);
                    setEditingLayerName('');
                    return;
                  }
                  void loadTemplateById(v);
                }}
                className="px-3 py-2 border border-gray-300 rounded bg-white text-sm font-medium text-black disabled:text-black"
                disabled={loading || saving}
              >
                <option value="">Select Template</option>
                {sortedTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 text-left"
                onClick={() => setCreateSectionOpen((v) => !v)}
                aria-expanded={createSectionOpen}
              >
                <div className="text-sm font-medium text-black">Create new template</div>
                <div className="text-black/60 text-xs select-none" aria-hidden="true">
                  {createSectionOpen ? 'Hide' : 'Show'} ▾
                </div>
              </button>

              {createSectionOpen ? (
                <div className="mt-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder:text-black/50 disabled:text-black"
                        placeholder="e.g. IG 3:4 — Clean Minimal"
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
              ) : (
                <p className="mt-2 text-xs text-black/70">
                  Click to create a new template or duplicate an existing one.
                </p>
              )}
            </div>

            {!hasSelectedTemplate ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-sm">
                <div className="font-semibold">Select a Template or Create one to begin editing.</div>
                <div className="text-xs mt-1 text-amber-900/80">
                  Editing controls and the canvas are locked until you choose a template.
                </div>
              </div>
            ) : null}

            <div
              className={[
                "space-y-3",
                editorUnlocked ? "" : "opacity-60 pointer-events-none select-none",
              ].join(" ")}
              aria-disabled={!editorUnlocked}
            >
              <div>
                <label className="block text-sm font-medium text-black mb-1">Template name</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder:text-black/50 disabled:text-black"
                  placeholder="e.g. IG 3:4 — Clean Minimal"
                  disabled={!canEdit || !editorUnlocked}
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
                      disabled={saving || !editorUnlocked}
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
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 px-2 pr-8 bg-black text-white rounded text-xs font-medium disabled:bg-black/30 disabled:text-white"
                      disabled={saving || !editorUnlocked}
                      value={addShapeDropdownValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        // Make it act like an action menu (auto-reset after selection).
                        setAddShapeDropdownValue('');
                        if (!v) return;
                        if (v === 'rect') canvasRef.current?.addRectLayer?.();
                        if (v === 'arrow_solid') canvasRef.current?.addArrowSolidLayer?.();
                        if (v === 'arrow_line') canvasRef.current?.addArrowLineLayer?.();
                        const next = canvasRef.current?.exportDefinition() || definition;
                        setDefinition(next);
                      }}
                      aria-label="Add shape"
                    >
                      <option value="">+ Shape</option>
                      <option value="rect">Rectangle</option>
                      <option value="arrow_solid">Arrow (solid)</option>
                      <option value="arrow_line">Arrow (line)</option>
                    </select>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-black text-white rounded text-xs font-medium disabled:bg-black/30 disabled:text-white"
                    disabled={saving || !editorUnlocked}
                    onClick={() => {
                      canvasRef.current?.addTextLayer?.();
                      const next = canvasRef.current?.exportDefinition() || definition;
                      setDefinition(next);
                    }}
                  >
                    + Text
                  </button>
                  </div>
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
                            // Right-click / two-finger click on a layer row opens the settings menu (text/shape).
                            if (l.type !== 'text' && l.type !== 'shape' && l.type !== 'image') return;
                            if (l.id === '__content_region__') return;
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedLayerId(l.id);
                            canvasRef.current?.selectLayer?.(l.id);
                            if (l.type === 'text') openTextContextMenuForLayer(l.id, e.clientX, e.clientY);
                            if (l.type === 'shape') openShapeContextMenuForLayer(l.id, e.clientX, e.clientY);
                            if (l.type === 'image') openImageContextMenuForLayer(l.id, e.clientX, e.clientY);
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

          <div className="flex items-start justify-center min-w-0">
            <div className="w-full max-w-[560px]">
              {imageCropEditingLayerId ? (
                <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-violet-900">Crop mode</div>
                      <div className="text-xs text-violet-900/80">
                        Drag to move • Scroll to zoom • Press <span className="font-semibold">Esc</span> to exit
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 px-3 rounded-md bg-black text-white text-xs font-semibold"
                        onClick={() => {
                          canvasRef.current?.finishImageCropMode?.();
                          setImageCropEditingLayerId(null);
                          const next = canvasRef.current?.exportDefinition?.() || definition;
                          setDefinition(next);
                        }}
                        title="Done (Esc)"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        className="h-8 px-3 rounded-md border border-gray-200 bg-white text-xs font-semibold text-black"
                        onClick={() => {
                          if (!imageCropEditingLayerId) return;
                          canvasRef.current?.resetImageCrop?.(imageCropEditingLayerId);
                          const next = canvasRef.current?.exportDefinition?.() || definition;
                          setDefinition(next);
                        }}
                        title="Reset crop"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                className="relative w-full overflow-hidden"
              onContextMenu={(e) => {
                // Context menu for text/shape styling in Template Editor (right-click / two-finger click).
                e.preventDefault();
                e.stopPropagation();

                // Phase 3: lock canvas interactions until a template is selected.
                if (!hasSelectedTemplate) return;
                  // While cropping, right-click menus are disabled (use the banner actions instead).
                  if (imageCropEditingLayerId) return;

                // Prefer current Fabric selection if available; fallback to selected layer in the list.
                const activeId = canvasRef.current?.getActiveLayerId?.() || selectedLayerId;
                if (!activeId) return;
                const layer = layers.find((x) => x.id === activeId);
                if (layer?.type === 'text') openTextContextMenuForLayer(activeId, e.clientX, e.clientY);
                if (layer?.type === 'shape') openShapeContextMenuForLayer(activeId, e.clientX, e.clientY);
                if (layer?.type === 'image') openImageContextMenuForLayer(activeId, e.clientX, e.clientY);
              }}
              >
                <TemplateEditorCanvas ref={canvasRef} initialDefinition={definition} />

              {!hasSelectedTemplate ? (
                <div className="absolute inset-0 z-[150] flex items-center justify-center">
                  <div className="absolute inset-0 bg-white/70" />
                  <div className="relative max-w-[440px] mx-6 bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-center">
                    <div className="text-sm font-semibold text-black">
                      Select a Template or Create one to begin editing.
                    </div>
                    <div className="mt-1 text-xs text-black/70">
                      The canvas and settings are locked until a template is selected.
                    </div>
                  </div>
                </div>
              ) : null}

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

                    <div>
                      <div className="text-[11px] font-semibold text-black/70 mb-1">Color</div>
                      <input
                        type="color"
                        className="h-9 w-full border border-gray-200 rounded"
                        value={String(ctxFill || '#111827')}
                        onChange={(e) => {
                          const v = e.target.value || '#111827';
                          setCtxFill(v);
                          canvasRef.current?.setTextLayerStyle?.(ctxMenu.layerId, { fill: v });
                          const next = canvasRef.current?.exportDefinition() || definition;
                          setDefinition(next);
                        }}
                      />
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

              {shapeMenu ? (
                <div
                  className="fixed z-[200] bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-[300px]"
                  style={{ left: shapeMenu.x, top: shapeMenu.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-semibold text-black mb-2">Shape settings</div>

                  <div className="space-y-3">
                    {shapeKind === 'rect' ? (
                      <div>
                        <div className="text-[11px] font-semibold text-black/70 mb-1">Corner radius</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={120}
                            value={String(shapeCornerRadius ?? 0)}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setShapeCornerRadius(v);
                              canvasRef.current?.setShapeLayerStyle?.(shapeMenu.layerId, { cornerRadius: v });
                              const next = canvasRef.current?.exportDefinition() || definition;
                              setDefinition(next);
                            }}
                            className="flex-1"
                          />
                          <input
                            className="h-9 w-20 border border-gray-200 rounded px-2 text-sm text-black"
                            value={String(shapeCornerRadius ?? 0)}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setShapeCornerRadius(n);
                            }}
                            onBlur={() => {
                              const n = Number(shapeCornerRadius);
                              if (!Number.isFinite(n)) return;
                              const v = Math.max(0, Math.round(n));
                              setShapeCornerRadius(v);
                              canvasRef.current?.setShapeLayerStyle?.(shapeMenu.layerId, { cornerRadius: v });
                              const next = canvasRef.current?.exportDefinition() || definition;
                              setDefinition(next);
                            }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {shapeKind === 'arrow_solid' || shapeKind === 'arrow_line' ? (
                      <div>
                        <div className="text-[11px] font-semibold text-black/70 mb-1">Arrowhead size</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={8}
                            max={420}
                            value={String(shapeArrowHeadSizePx ?? 120)}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setShapeArrowHeadSizePx(v);
                              canvasRef.current?.setShapeLayerStyle?.(shapeMenu.layerId, { arrowHeadSizePx: v });
                              const next = canvasRef.current?.exportDefinition() || definition;
                              setDefinition(next);
                            }}
                            className="flex-1"
                          />
                          <input
                            className="h-9 w-20 border border-gray-200 rounded px-2 text-sm text-black"
                            value={String(shapeArrowHeadSizePx ?? 120)}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setShapeArrowHeadSizePx(n);
                            }}
                            onBlur={() => {
                              const n = Number(shapeArrowHeadSizePx);
                              if (!Number.isFinite(n)) return;
                              const v = Math.max(8, Math.round(n));
                              setShapeArrowHeadSizePx(v);
                              canvasRef.current?.setShapeLayerStyle?.(shapeMenu.layerId, { arrowHeadSizePx: v });
                              const next = canvasRef.current?.exportDefinition() || definition;
                              setDefinition(next);
                            }}
                          />
                          <div className="text-xs text-black/60">px</div>
                        </div>
                        <div className="mt-1 text-[11px] text-black/60">
                          Absolute size (template pixels). Resizing the arrow won’t change this (unless the arrow becomes too narrow and clamps).
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-black/70 mb-1">Fill</div>
                        <input
                          type="color"
                          className="h-9 w-full border border-gray-200 rounded"
                          value={String(shapeFill || '#111827')}
                          onChange={(e) => {
                            const v = e.target.value || '#111827';
                            setShapeFill(v);
                            canvasRef.current?.setShapeLayerStyle?.(shapeMenu.layerId, { fill: v });
                            const next = canvasRef.current?.exportDefinition() || definition;
                            setDefinition(next);
                          }}
                        />
                        {shapeKind === 'arrow_line' ? (
                          <div className="mt-1 text-[11px] text-black/60">
                            Note: line arrows ignore fill (stroke only).
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-black/70 mb-1">Stroke</div>
                        <input
                          type="color"
                          className="h-9 w-full border border-gray-200 rounded"
                          value={String(shapeStroke || '#111827')}
                          onChange={(e) => {
                            const v = e.target.value || '#111827';
                            setShapeStroke(v);
                            canvasRef.current?.setShapeLayerStyle?.(shapeMenu.layerId, { stroke: v });
                            const next = canvasRef.current?.exportDefinition() || definition;
                            setDefinition(next);
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-black/70 mb-1">Stroke width</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="h-9 w-24 border border-gray-200 rounded px-2 text-sm text-black"
                          value={String(shapeStrokeWidth ?? 0)}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setShapeStrokeWidth(v);
                            if (!Number.isFinite(v)) return;
                            canvasRef.current?.setShapeLayerStyle?.(shapeMenu.layerId, { strokeWidth: Math.max(0, v) });
                            const next = canvasRef.current?.exportDefinition() || definition;
                            setDefinition(next);
                          }}
                        />
                        <div className="text-xs text-black/60">px</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {imageMenu ? (
                <div
                  className="fixed z-[200] bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-[260px]"
                  style={{ left: imageMenu.x, top: imageMenu.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-semibold text-black mb-2">Image settings</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[11px] font-semibold text-black/70 mb-1">Mask</div>
                      <select
                        className="w-full h-9 rounded-md border border-gray-200 px-2 text-sm text-black bg-white"
                        value={imageMaskShape}
                        onChange={(e) => {
                          const next = e.target.value === 'circle' ? 'circle' : 'none';
                          setImageMaskShape(next);
                          if (imageCropEditingLayerId === imageMenu.layerId && next !== 'circle') {
                            canvasRef.current?.finishImageCropMode?.();
                            setImageCropEditingLayerId(null);
                          }
                          if (next === 'circle') {
                            patchImageAsset(imageMenu.layerId, {
                              maskShape: 'circle',
                              crop: { scale: 1, offsetX: 0, offsetY: 0 },
                            } as any);
                          } else {
                            patchImageAsset(imageMenu.layerId, { maskShape: 'none', crop: undefined } as any);
                          }
                        }}
                      >
                        <option value="none">None</option>
                        <option value="circle">Circle (avatar)</option>
                      </select>
                    </div>

                    {imageMaskShape === 'circle' ? (
                      <div className="space-y-2 pt-1">
                        {imageCropEditingLayerId === imageMenu.layerId ? (
                          <>
                            <div className="text-[11px] text-black/70">
                              Crop mode: drag to pan • scroll to zoom • click Done when finished
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="flex-1 h-9 rounded-md bg-black text-white text-sm font-semibold disabled:bg-black/30"
                                onClick={() => {
                                  canvasRef.current?.finishImageCropMode?.();
                                  setImageCropEditingLayerId(null);
                                  // Sync definition state so Save uses latest crop values even if user doesn't move anything else.
                                  const next = canvasRef.current?.exportDefinition?.() || definition;
                                  setDefinition(next);
                                }}
                              >
                                Done
                              </button>
                              <button
                                type="button"
                                className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm text-black"
                                onClick={() => {
                                  canvasRef.current?.resetImageCrop?.(imageMenu.layerId);
                                  const next = canvasRef.current?.exportDefinition?.() || definition;
                                  setDefinition(next);
                                }}
                                title="Reset crop"
                              >
                                Reset
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="flex-1 h-9 rounded-md bg-black text-white text-sm font-semibold disabled:bg-black/30"
                              disabled={imageCropEditingLayerId !== null}
                              onClick={() => {
                                setImageCropEditingLayerId(imageMenu.layerId);
                                canvasRef.current?.selectLayer?.(imageMenu.layerId);
                                canvasRef.current?.startImageCropMode?.(imageMenu.layerId);
                              }}
                              title={imageCropEditingLayerId ? 'Finish current crop first' : 'Edit crop (pan/zoom inside circle)'}
                            >
                              Edit crop…
                            </button>
                            <button
                              type="button"
                              className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm text-black"
                              onClick={() => {
                                canvasRef.current?.resetImageCrop?.(imageMenu.layerId);
                                const next = canvasRef.current?.exportDefinition?.() || definition;
                                setDefinition(next);
                              }}
                              title="Reset crop"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-black/60">
                        Switch Mask to Circle to enable crop editing.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


