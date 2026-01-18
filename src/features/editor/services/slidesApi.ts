export type FetchJson = (path: string, init?: RequestInit) => Promise<any>;

export type SlideUpdatePatch = {
  headline?: string | null;
  body?: string | null;
  layoutSnapshot?: any | null;
  inputSnapshot?: any | null;
  aiImagePrompt?: string | null;
};

export async function updateSlide(fetchJson: FetchJson, args: { projectId: string; slideIndex: number; patch: SlideUpdatePatch }) {
  const pid = String(args.projectId || '').trim();
  if (!pid) throw new Error('projectId is required');
  await fetchJson('/api/editor/projects/slides/update', {
    method: 'POST',
    body: JSON.stringify({ projectId: pid, slideIndex: args.slideIndex, ...args.patch }),
  });
}

