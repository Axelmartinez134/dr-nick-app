export type FetchJson = (path: string, init?: RequestInit) => Promise<any>;

export type ProjectListItem = {
  id: string;
  title: string;
  template_type_id: string;
  updated_at: string;
};

export async function listProjects(fetchJson: FetchJson): Promise<ProjectListItem[]> {
  const data = await fetchJson('/api/editor/projects/list', { method: 'GET' });
  return Array.isArray(data?.projects) ? (data.projects as ProjectListItem[]) : [];
}

export async function loadProject(fetchJson: FetchJson, projectId: string): Promise<{ project: any; slides: any[] }> {
  const data = await fetchJson(`/api/editor/projects/load?id=${encodeURIComponent(projectId)}`, { method: 'GET' });
  return { project: data?.project, slides: Array.isArray(data?.slides) ? data.slides : [] };
}

export async function createProject(fetchJson: FetchJson, args: { templateTypeId: 'regular' | 'enhanced'; title: string }) {
  const data = await fetchJson('/api/editor/projects/create', {
    method: 'POST',
    body: JSON.stringify({ templateTypeId: args.templateTypeId, title: args.title }),
  });
  return { project: data?.project, slides: Array.isArray(data?.slides) ? data.slides : [] };
}

export async function archiveProject(fetchJson: FetchJson, projectId: string) {
  const data = await fetchJson('/api/editor/projects/archive', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
  return { project: data?.project };
}

