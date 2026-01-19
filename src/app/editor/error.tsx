'use client';

import { useEffect } from 'react';

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep a console trace to help diagnose intermittent blank screens.
    console.error('[Editor] route error boundary:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-xl font-semibold text-gray-900">Editor failed to load</h1>
        <p className="mt-2 text-gray-700">
          Something crashed while rendering the editor. Click retry to re-mount without a hard refresh.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => reset()}
          >
            Retry
          </button>
          <button
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600">Details</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 border rounded-md p-3">
            {String(error?.message || error)}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        </details>
      </div>
    </main>
  );
}

