import { Suspense } from "react";
import CaptureClient from "./CaptureClient";
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function SwipeFileCapturePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="text-sm text-gray-700">Loading…</div>
        </main>
      }
    >
      <CaptureClient />
    </Suspense>
  );
}

