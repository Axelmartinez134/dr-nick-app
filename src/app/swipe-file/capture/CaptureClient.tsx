"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthContext";
import { SwipeFileCaptureForm } from "@/features/editor/components/SwipeFileCaptureForm";

export default function CaptureClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();

  const keyFromQuery = useMemo(() => {
    const raw = sp?.get("k") || "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [sp]);

  const urlFromQuery = useMemo(() => {
    const raw = sp?.get("url") || "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [sp]);

  const publicMode = useMemo(() => !!String(keyFromQuery || "").trim(), [keyFromQuery]);

  useEffect(() => {
    // iOS Safari fallback: prevent pinch-to-zoom gesture on this capture page.
    // (Viewport `user-scalable=no` should handle most cases, but this makes it more robust.)
    const onGesture = (e: any) => {
      try {
        e.preventDefault?.();
      } catch {
        // ignore
      }
    };
    document.addEventListener("gesturestart" as any, onGesture, { passive: false } as any);
    document.addEventListener("gesturechange" as any, onGesture, { passive: false } as any);
    document.addEventListener("gestureend" as any, onGesture, { passive: false } as any);
    return () => {
      document.removeEventListener("gesturestart" as any, onGesture as any);
      document.removeEventListener("gesturechange" as any, onGesture as any);
      document.removeEventListener("gestureend" as any, onGesture as any);
    };
  }, []);

  useEffect(() => {
    // This capture page is intended to be a static, non-scrollable screen.
    // Lock page scrolling while mounted.
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    try {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
    } catch {
      // ignore
    }
    return () => {
      try {
        html.style.overflow = prevHtmlOverflow;
        body.style.overflow = prevBodyOverflow;
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && !publicMode) router.replace("/");
  }, [loading, user, router, publicMode]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-sm text-gray-700">Loading…</div>
      </main>
    );
  }

  if (!user && !publicMode) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-sm text-gray-700">Redirecting…</div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-gray-50 p-4 touch-manipulation flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">Save to Swipe File</div>
          <div className="mt-1 text-xs text-slate-500">Fast capture — enrichment happens later on desktop.</div>
        </div>

        <SwipeFileCaptureForm
          mode={publicMode ? "public" : "authed"}
          publicKey={keyFromQuery}
          initialUrl={urlFromQuery}
          autoSelectFirstCategory={true}
          showPasteButton={true}
          secondaryActionLabel="Open editor"
          secondaryActionTitle="Open the editor (Swipe File is available from the top bar)"
          onSecondaryAction={() => router.push("/editor")}
        />
      </div>
    </main>
  );
}

