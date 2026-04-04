import type { Repository } from '@/types';
import { apiJson } from '../api-client';

export async function addRepository(repoUrl: string) {
  return apiJson<{
    success?: boolean;
    repo_info?: Repository;
    error?: string;
    message?: string;
    needs_analysis?: boolean;
  }>('/repo/add', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  });
}

export async function analyzeRepository(skipGithubArtifacts = false) {
  return apiJson<{
    success?: boolean;
    message?: string;
    results?: unknown;
    error?: string;
  }>('/repo/analyze', {
    method: 'POST',
    body: JSON.stringify({ skip_github_artifacts: skipGithubArtifacts }),
  });
}

export async function getRepositoryStatus() {
  return apiJson<{
    repo_info?: Repository;
    local_status?: unknown;
    remote_status?: unknown;
    analysis_status?: string;
    last_analysis?: unknown;
    repo_status?: unknown;
    error?: string;
  }>('/repo/status');
}

export async function checkForUpdates() {
  return apiJson<Record<string, unknown>>('/repo/check-updates');
}

export async function pullAndAnalyze() {
  const data = await apiJson<{
    success?: boolean;
    message?: string;
    results?: Record<string, unknown>;
    changes_detected?: boolean;
    error?: string;
  }>('/repo/pull', { method: 'POST' });
  const results = data.results;
  const hasResults = results != null && typeof results === 'object' && Object.keys(results).length > 0;
  return {
    ...data,
    success: data.success !== false,
    changes_detected: Boolean(data.changes_detected ?? (data.success && hasResults)),
  };
}

export async function getAnalysisStatus() {
  return apiJson<{ status?: string; current_repo?: Repository | null }>('/repo/analysis-status');
}

export async function getAnalysisProgress() {
  return apiJson<{
    progress: {
      step?: number;
      step_name?: string;
      step_description?: string;
      details?: Record<string, unknown>;
    };
    status: string;
  }>('/repo/progress');
}
