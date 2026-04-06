"use client";

type WorkflowStage = "generate-copy" | "choose-preset" | "generate-slides" | "editing";

export function HtmlBottomPanel(props: {
  stage: WorkflowStage;
  caption: string;
  promptSnapshot: string;
  generationStatus: string;
  slideCount: number;
  onPrimaryAction?: () => void;
  primaryActionBusy?: boolean;
  primaryActionLabel?: string;
  primaryActionError?: string | null;
}) {
  const cta =
    props.stage === "generate-copy"
      ? {
          label: "Generate Copy",
          description: "Start by generating structured html copy for the 6-slide project.",
          disabledReason: null,
        }
      : props.stage === "choose-preset"
        ? {
            label: "Choose a Preset",
            description: "Copy exists. The next step is selecting the visual preset family.",
            disabledReason: "Choose a preset from the gallery above to unlock generation.",
          }
        : props.stage === "generate-slides"
          ? {
              label: "Generate Slides",
              description: "A preset is selected. The next step is generating the final HTML slide visuals.",
              disabledReason: null,
            }
          : {
              label: "Editing Ready",
              description: "Slides are generated and the dedicated html workspace is live for element selection, editing, autosave, and export.",
              disabledReason: "Use the workspace above to switch slides and edit elements.",
            };

  return (
    <section className="border-t border-slate-200 bg-white px-5 py-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{cta.label}</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">{cta.description}</div>
          <button
            type="button"
            className={[
              "mt-4 h-10 rounded-lg px-4 text-sm font-semibold text-white",
              cta.disabledReason || props.primaryActionBusy ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800",
            ].join(" ")}
            disabled={!!cta.disabledReason || !!props.primaryActionBusy}
            onClick={props.onPrimaryAction}
            title={cta.disabledReason || undefined}
          >
            {props.primaryActionBusy ? props.primaryActionLabel || "Working..." : cta.label}
          </button>
          {cta.disabledReason ? <div className="mt-2 text-[11px] text-slate-500">{cta.disabledReason}</div> : null}
          {!cta.disabledReason && props.primaryActionLabel ? (
            <div className="mt-2 text-[11px] text-slate-500">{props.primaryActionLabel}</div>
          ) : null}
          {props.primaryActionError ? <div className="mt-2 text-[11px] text-red-600">{props.primaryActionError}</div> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Details</div>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div>Slides: {props.slideCount}</div>
            <div>Generation status: {props.generationStatus || "idle"}</div>
            <div>Caption: {props.caption.trim() ? "Present" : "Empty"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt Snapshot</div>
          <div className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
            {props.promptSnapshot.trim() || "No prompt snapshot saved yet."}
          </div>
        </div>
      </div>
    </section>
  );
}
