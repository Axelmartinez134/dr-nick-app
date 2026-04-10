"use client";

import type { ReactNode } from "react";
import type { HtmlEditableElement, HtmlElementPatch } from "../models/htmlElementModel";

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{props.label}</div>
      <div className="mt-1">{props.children}</div>
    </label>
  );
}

function TransformFields(props: {
  element: HtmlEditableElement;
  onPatch: (patch: HtmlElementPatch) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Transform</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Translate X">
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={props.element.translateX}
            onChange={(e) => props.onPatch({ translateX: e.target.value })}
          />
        </Field>
        <Field label="Translate Y">
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={props.element.translateY}
            onChange={(e) => props.onPatch({ translateY: e.target.value })}
          />
        </Field>
        <Field label="Width">
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={props.element.width}
            onChange={(e) => props.onPatch({ width: e.target.value })}
          />
        </Field>
        <Field label="Height">
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={props.element.height}
            onChange={(e) => props.onPatch({ height: e.target.value })}
          />
        </Field>
        <Field label="Rotate">
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={props.element.rotate}
            onChange={(e) => props.onPatch({ rotate: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

export function HtmlElementEditor(props: {
  element: HtmlEditableElement | null;
  onPatch: (patch: HtmlElementPatch) => void;
}) {
  const element = props.element;
  if (!element) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Selected element</div>
        <div className="mt-2 text-sm leading-6 text-slate-600">Select an element from the iframe or the list to edit its properties.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{element.label}</div>
      <div className="mt-1 text-xs text-slate-500">
        {element.type} · {element.id}
      </div>
      <div className="mt-4 space-y-3">
        {element.type === "text" ? (
          <>
            <Field label="Text">
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                value={element.text}
                onChange={(e) => props.onPatch({ text: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Text Color">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.color}
                  onChange={(e) => props.onPatch({ color: e.target.value })}
                />
              </Field>
              <Field label="Background">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.backgroundColor}
                  onChange={(e) => props.onPatch({ backgroundColor: e.target.value })}
                />
              </Field>
              <Field label="Font Size">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.fontSize}
                  onChange={(e) => props.onPatch({ fontSize: e.target.value })}
                />
              </Field>
              <Field label="Font Weight">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.fontWeight}
                  onChange={(e) => props.onPatch({ fontWeight: e.target.value })}
                />
              </Field>
            </div>
          </>
        ) : null}

        {element.type === "image-slot" ? (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Slot Type</div>
                <div className="text-xs font-medium text-slate-700">{element.slotType || "main"}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Slot ID</div>
                <div className="truncate text-xs font-medium text-slate-700">{element.slotId || "—"}</div>
              </div>
              {element.searchQuery ? (
                <div className="col-span-2 mt-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Search Query</div>
                  <div className="truncate text-xs text-slate-600">{element.searchQuery}</div>
                </div>
              ) : null}
            </div>
            <Field label="Background Image">
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={element.backgroundImage}
                onChange={(e) => props.onPatch({ backgroundImage: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Background Color">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.backgroundColor}
                  onChange={(e) => props.onPatch({ backgroundColor: e.target.value })}
                />
              </Field>
              <Field label="Border Radius">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.borderRadius}
                  onChange={(e) => props.onPatch({ borderRadius: e.target.value })}
                />
              </Field>
            </div>
          </>
        ) : null}

        {element.type === "image" ? (
          <>
            <Field label="Image URL">
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={element.src}
                onChange={(e) => props.onPatch({ src: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Object Fit">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.objectFit}
                  onChange={(e) => props.onPatch({ objectFit: e.target.value })}
                />
              </Field>
              <Field label="Border Radius">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={element.borderRadius}
                  onChange={(e) => props.onPatch({ borderRadius: e.target.value })}
                />
              </Field>
            </div>
          </>
        ) : null}

        {element.type === "block" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Background Color">
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={element.backgroundColor}
                onChange={(e) => props.onPatch({ backgroundColor: e.target.value })}
              />
            </Field>
            <Field label="Border Radius">
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={element.borderRadius}
                onChange={(e) => props.onPatch({ borderRadius: e.target.value })}
              />
            </Field>
            <Field label="Opacity">
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={element.opacity}
                onChange={(e) => props.onPatch({ opacity: e.target.value })}
              />
            </Field>
            <Field label="Border">
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={element.border}
                onChange={(e) => props.onPatch({ border: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        <TransformFields element={element} onPatch={props.onPatch} />
      </div>
    </div>
  );
}
