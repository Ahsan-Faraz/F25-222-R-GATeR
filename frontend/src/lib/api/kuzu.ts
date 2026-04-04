import { apiJson } from '../api-client';

export async function getKuzuStats() {
  return apiJson<Record<string, unknown>>('/kuzu/stats');
}

function resolveLimit(limitOrOpts?: number | { limit?: number }) {
  if (typeof limitOrOpts === 'object' && limitOrOpts != null) {
    return limitOrOpts.limit ?? 100;
  }
  return typeof limitOrOpts === 'number' ? limitOrOpts : 100;
}

/** Returns `nodes` array (matches KuzuPanel usage). */
export async function getKuzuNodes(limitOrOpts?: number | { limit?: number }) {
  const limit = resolveLimit(limitOrOpts);
  const data = await apiJson<{ nodes?: unknown[] }>(`/kuzu/nodes?limit=${limit}`);
  return data.nodes ?? [];
}

/** Returns `relationships` array. */
export async function getKuzuRelationships(limitOrOpts?: number | { limit?: number }) {
  const limit = resolveLimit(limitOrOpts);
  const data = await apiJson<{ relationships?: unknown[] }>(`/kuzu/relationships?limit=${limit}`);
  return data.relationships ?? [];
}
