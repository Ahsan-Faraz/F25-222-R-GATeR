// Analysis Progress Hook

import { useCallback, useEffect, useRef } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { getAnalysisProgress } from '@/lib/api/repo';
import type { AnalysisProgress } from '@/types';

const TOTAL_STEPS = 6; // Total analysis steps

export function useAnalysisProgress(enabled: boolean = true) {
  const { setAnalysisProgress, setIsAnalyzing, isAnalyzing } = useAppState();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const data = await getAnalysisProgress();
      
      // Map Flask response to our format
      const progress = data.progress;
      const status = data.status;
      const step = progress.step ?? 0;
      
      // Calculate percentage based on step
      const percentage = step > 0 
        ? Math.round((step / TOTAL_STEPS) * 100) 
        : 0;
      
      setAnalysisProgress({
        step,
        step_name: progress.step_name ?? '',
        step_description: progress.step_description ?? '',
        details: progress.details ?? {},
        start_time: null,
        current_step_start: null,
        total_steps: TOTAL_STEPS,
        percentage,
        status: status as AnalysisProgress['status'],
      });
      
      // Update analyzing state based on status
      const analyzing = status === 'analyzing';
      setIsAnalyzing(analyzing);
      
      // If analysis completed or error, we can stop polling
      if (status === 'completed' || status === 'error' || status === 'idle') {
        return false; // Signal to stop polling
      }
      return true; // Continue polling
    } catch (error) {
      console.error('Failed to fetch analysis progress:', error);
      return false;
    }
  }, [setAnalysisProgress, setIsAnalyzing]);

  useEffect(() => {
    if (enabled && isAnalyzing) {
      // Start polling immediately
      fetchProgress();
      
      // Then poll every 500ms
      intervalRef.current = setInterval(async () => {
        const shouldContinue = await fetchProgress();
        if (!shouldContinue && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 500);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isAnalyzing, fetchProgress]);
}
