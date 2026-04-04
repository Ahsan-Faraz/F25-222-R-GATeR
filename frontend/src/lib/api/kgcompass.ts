import { apiJson } from '../api-client';

export async function calculateRelevance(body: {
  problem_description: string;
  alpha: number;
  beta: number;
  top_k: number;
}) {
  return apiJson<{
    success?: boolean;
    top_candidates?: unknown[];
    debug_info?: unknown;
    error?: string;
  }>('/kgcompass/calculate-relevance', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
