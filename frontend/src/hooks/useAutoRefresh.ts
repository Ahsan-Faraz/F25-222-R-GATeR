// Auto-refresh hook for periodic status updates

import { useCallback } from 'react';
import { usePolling } from './usePolling';
import { useAppState } from '@/context/AppStateContext';
import { getRepositoryStatus } from '@/lib/api/repo';

export function useAutoRefresh(enabled: boolean = true) {
  const { setCurrentRepo, setRepoStatus } = useAppState();

  const refresh = useCallback(async () => {
    try {
      const data = await getRepositoryStatus();
      if (data.repo_info) {
        setCurrentRepo(data.repo_info);
      }
      if (data.local_status && typeof data.local_status === 'object') {
        setRepoStatus(data.local_status as import('@/types').RepositoryStatus);
      }
    } catch (error) {
      // Silently fail - this is a background refresh
      console.debug('Auto-refresh failed:', error);
    }
  }, [setCurrentRepo, setRepoStatus]);

  usePolling(refresh, 30000, enabled); // 30 seconds
}
