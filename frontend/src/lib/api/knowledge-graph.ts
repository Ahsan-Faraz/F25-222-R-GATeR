import { apiJson } from '../api-client';

export async function getGraphStats() {
  return apiJson<Record<string, unknown>>('/knowledge-graph/stats');
}

export async function getGraphData() {
  return apiJson<Record<string, unknown>>('/knowledge-graph/data');
}

export async function clearKuzuDatabase() {
  return apiJson<{ success: boolean; message?: string }>('/kuzu/clear', { method: 'POST' });
}
