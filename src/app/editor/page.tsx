"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth/AuthContext";
import EditorShell from "./EditorShell";

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access denied</h1>
        <p className="text-gray-600">
          Your account does not have access to the editor. Contact an admin to be added.
        </p>
      </div>
    </main>
  );
}

export default function EditorPage() {
  const { user, loading, editorLoading, isEditorUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) return <LoadingScreen message="Loading..." />;
  if (!user) return <LoadingScreen message="Redirecting to login..." />;
  if (editorLoading) return <LoadingScreen message="Checking editor access..." />;
  if (!isEditorUser) return <AccessDenied />;

  // Option A: Shell-first (pixel-perfect scaffolding first, then dock existing editor into it).
  return <EditorShell />;
}


