import type { GATREngineStatus } from '@/types';
import { apiJson } from '../api-client';

export type { GATREngineStatus };

export async function getGATRStatus() {
  return apiJson<GATREngineStatus>('/gatr/status');
}

export async function repairTest(body: Record<string, unknown>) {
  // Use the new API route with increased timeout instead of direct proxy
  const response = await fetch('/api/gatr-repair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getTestContext(body: Record<string, unknown>) {
  return apiJson<{ success?: boolean; context?: unknown }>('/gatr/context', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
