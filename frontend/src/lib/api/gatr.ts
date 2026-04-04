import type { GATREngineStatus } from '@/types';
import { apiJson } from '../api-client';

export type { GATREngineStatus };

export async function getGATRStatus() {
  return apiJson<GATREngineStatus>('/gatr/status');
}

export async function repairTest(body: Record<string, unknown>) {
  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

  try {
    const result = await apiJson<{
      success?: boolean;
      repair_id?: string;
      error?: string;
      message?: string;
      [key: string]: unknown;
    }>('/gatr/repair', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - LLM is taking longer than expected. Please try again.');
    }
    throw error;
  }
}

export async function getTestContext(body: Record<string, unknown>) {
  return apiJson<{ success?: boolean; context?: unknown }>('/gatr/context', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
