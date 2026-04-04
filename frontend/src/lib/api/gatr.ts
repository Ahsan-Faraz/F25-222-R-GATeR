import type { GATREngineStatus } from '@/types';
import { apiJson } from '../api-client';

export type { GATREngineStatus };

export async function getGATRStatus() {
  return apiJson<GATREngineStatus>('/gatr/status');
}

export async function repairTest(body: Record<string, unknown>) {
  return apiJson<{
    success?: boolean;
    repair_id?: string;
    error?: string;
    message?: string;
    [key: string]: unknown;
  }>('/gatr/repair', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getTestContext(body: Record<string, unknown>) {
  return apiJson<{ success?: boolean; context?: unknown }>('/gatr/context', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
