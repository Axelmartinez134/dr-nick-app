"use client";

import { useEditorSelector } from "@/features/editor/store";

export function TemplateSettingsModal() {
  const open = useEditorSelector((s) => s.templateSettingsOpen);
  const templateTypeId = useEditorSelector((s) => s.templateTypeId);
  const loadingTemplates = useEditorSelector((s) => s.loadingTemplates);
  const templates = useEditorSelector((s) => s.templates);

  const templateTypeMappingSlide1 = useEditorSelector((s) => s.templateTypeMappingSlide1);
  const templateTypeMappingSlide2to5 = useEditorSelector((s) => s.templateTypeMappingSlide2to5);
  const templateTypeMappingSlide6 = useEditorSelector((s) => s.templateTypeMappingSlide6);

  const actions = useEditorSelector((s) => s.actions);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        // Only close on true backdrop clicks (not inside the panel).
        if (e.target === e.currentTarget) actions.onCloseTemplateSettings();
      }}
    >
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">
            Template Settings ({templateTypeId === "enhanced" ? "Enhanced" : "Regular"})
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={actions.onCloseTemplateSettings}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="mt-2 grid grid-cols-1 gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Slide 1 Template</div>
              <select
                className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                value={templateTypeMappingSlide1 || ""}
                onChange={(e) => actions.onChangeTemplateTypeMappingSlide1(e.target.value || null)}
                disabled={loadingTemplates}
              >
                <option value="">{loadingTemplates ? "Loading..." : "Select template…"}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">Slides 2–5 Template</div>
              <select
                className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                value={templateTypeMappingSlide2to5 || ""}
                onChange={(e) => actions.onChangeTemplateTypeMappingSlide2to5(e.target.value || null)}
                disabled={loadingTemplates}
              >
                <option value="">{loadingTemplates ? "Loading..." : "Select template…"}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">Slide 6 Template</div>
              <select
                className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                value={templateTypeMappingSlide6 || ""}
                onChange={(e) => actions.onChangeTemplateTypeMappingSlide6(e.target.value || null)}
                disabled={loadingTemplates}
              >
                <option value="">{loadingTemplates ? "Loading..." : "Select template…"}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end">
            <button
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
              onClick={actions.onOpenTemplateEditor}
              title="Open Template Editor"
            >
              Template Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

