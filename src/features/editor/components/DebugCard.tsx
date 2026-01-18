export type DebugCardProps = {
  debugScreenshot: string | null;
  showDebugPreview: boolean;
  setShowDebugPreview: (next: boolean) => void;
  debugLogs: string[];
};

export function DebugCard(props: DebugCardProps) {
  const { debugScreenshot, showDebugPreview, setShowDebugPreview, debugLogs } = props;

  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm group">
      <summary className="cursor-pointer px-4 py-3 flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-slate-500 text-white text-sm flex items-center justify-center">🔧</span>
        <span className="text-sm font-semibold text-slate-900">Debug</span>
        <span className="ml-auto text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="px-4 pb-4 space-y-3">
        {debugScreenshot && (
          <div>
            <button
              className="text-xs text-violet-700 font-medium hover:underline"
              onClick={() => setShowDebugPreview(!showDebugPreview)}
            >
              {showDebugPreview ? "Hide" : "Show"} Screenshot
            </button>
            {showDebugPreview && (
              <div className="mt-2 bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-64 shadow-sm">
                <img
                  src={debugScreenshot}
                  alt="Screenshot sent to Claude Vision"
                  className="max-w-full h-auto mx-auto"
                />
              </div>
            )}
          </div>
        )}

        {debugLogs.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-3 max-h-64 overflow-y-auto font-mono text-[11px] text-green-300 shadow-inner">
            {debugLogs.map((log, idx) => (
              <div key={idx} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">No debug logs yet.</div>
        )}
      </div>
    </details>
  );
}

