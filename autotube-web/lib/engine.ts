export const ENGINE_URL =
  process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:3001';

export type VideoStatus =
  | 'QUEUED'
  | 'GENERATING_SCRIPT'
  | 'SYNTHESIZING_AUDIO'
  | 'COLLECTING_VISUALS'
  | 'RENDERING_VIDEO'
  | 'WAITING_FOR_INPUT'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'ERROR';

export type VideoListItem = {
  id: string;
  title: string;
  status: VideoStatus;
  errorReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type VideoDetail = VideoListItem & {
  description: string | null;
  tags: string[];
  script: string | null;
  runDir: string | null;
  videoUrl: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  characterId: string | null;
  hookType: string | null;
};

export async function fetchVideos(status?: string): Promise<VideoListItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${ENGINE_URL}/videos${query}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`No se pudo listar videos (${res.status})`);
  }
  return res.json();
}

export async function fetchVideo(id: string): Promise<VideoDetail> {
  const res = await fetch(`${ENGINE_URL}/videos/${id}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`No se pudo cargar el video (${res.status})`);
  }
  return res.json();
}

export async function reviewVideo(
  id: string,
  action: 'approve' | 'reject',
  notes: string,
): Promise<VideoDetail> {
  const res = await fetch(`${ENGINE_URL}/videos/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notes }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Revisión falló (${res.status})`);
  }
  return res.json();
}

export function previewUrl(id: string): string {
  return `${ENGINE_URL}/videos/${id}/preview`;
}

export type MetricsSummary = {
  days: number;
  views: number;
  retention: number;
  estimatedRevenue: number;
  videos: number;
  snapshots: { fetchedAt: string; views: number; retentionRate: number; estimatedRevenue: number }[];
};

export type MetricsSpend = {
  today: { provider: string; costUsd: number }[];
  all: { provider: string; costUsd: number }[];
};

export type MetricsHealth = {
  youtubeQuota: 'ok' | 'exceeded';
  lastExceededAt: string | null;
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${path} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fetchMetricsSummary(days: 7 | 30 | 90): Promise<MetricsSummary> {
  return fetchJson<MetricsSummary>(`/metrics/summary?days=${days}`);
}

export function fetchMetricsSpend(): Promise<MetricsSpend> {
  return fetchJson<MetricsSpend>('/metrics/spend');
}

export function fetchMetricsHealth(): Promise<MetricsHealth> {
  return fetchJson<MetricsHealth>('/metrics/health');
}
