import { apiFetch, apiJson } from '../api-client';

export async function getVectorStats() {
  return apiJson<Record<string, unknown>>('/vectors/stats');
}

export async function clearVectors() {
  return apiJson<{ success: boolean; message?: string; error?: string }>('/vectors/clear', {
    method: 'POST',
  });
}

function normalizeHit(raw: Record<string, unknown>) {
  const similarity =
    (raw.similarity_score as number | undefined) ??
    (raw.score as number | undefined) ??
    (raw.similarity as number | undefined) ??
    (typeof raw._distance === 'number' ? 1 / (1 + raw._distance) : 0);

  return {
    entity_id: String(raw.entity_id ?? raw.id ?? ''),
    entity_name: String(raw.entity_name ?? raw.name ?? ''),
    entity_type: String(raw.entity_type ?? raw.type ?? ''),
    similarity_score: typeof similarity === 'number' && similarity <= 1 ? similarity : Math.min(1, Math.abs(similarity)),
    file_path: raw.file_path as string | undefined,
    source_code: (raw.source_code ?? raw.code) as string | undefined,
    metadata: raw.metadata as Record<string, unknown> | undefined,
  };
}

export async function semanticSearch(params: { text: string; topK: number }) {
  const data = await apiJson<{
    success?: boolean;
    results?: Record<string, unknown>[];
    error?: string;
  }>('/vectors/search', {
    method: 'POST',
    body: JSON.stringify({
      query: params.text,
      top_k: params.topK,
      use_hybrid: true,
    }),
  });

  const list = data.results ?? [];
  return list.map((r) => normalizeHit(r));
}

/** Probe POST /vectors/search for dashboard latency display. */
export async function measureVectorSearchLatencyMs(): Promise<number | null> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    await apiFetch('/vectors/search', {
      method: 'POST',
      body: JSON.stringify({ query: '__latency_probe__', top_k: 1, use_hybrid: false }),
    });
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Math.round(t1 - t0);
  } catch {
    return null;
  }
}
