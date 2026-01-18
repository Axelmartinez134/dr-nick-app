export type MobileSaveSlidesPanelProps = {
  open: boolean;
  slideCount: number;
  mobileSaveBusy: number | null;
  topExporting: boolean;
  onClose: () => void;
  onShareSingleSlide: (slideIndex: number) => void;
  onDownloadZip: () => void;
};

export function MobileSaveSlidesPanel(props: MobileSaveSlidesPanelProps) {
  const { open, slideCount, mobileSaveBusy, topExporting, onClose, onShareSingleSlide, onDownloadZip } = props;
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/50"
        aria-label="Close save panel"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Save slides</div>
          <button
            type="button"
            className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-slate-700">
            Your browser can’t save all 6 images at once. Tap each slide below to open the Share Sheet, then choose{" "}
            <b>Save Image</b>/<b>Save to Photos</b>.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: slideCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                className="h-11 rounded-md bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-50"
                disabled={mobileSaveBusy !== null || topExporting}
                onClick={() => onShareSingleSlide(i)}
              >
                {mobileSaveBusy === i ? "Preparing..." : `Save Slide ${i + 1}`}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="w-full h-11 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold disabled:opacity-50"
            disabled={topExporting}
            onClick={onDownloadZip}
            title="Fallback: downloads a ZIP to the Files app"
          >
            Download ZIP (Files)
          </button>
        </div>
      </div>
    </>
  );
}

