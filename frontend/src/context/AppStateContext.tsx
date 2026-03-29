// Global Application State Context

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { AppState, Repository, RepositoryStatus, AnalysisProgress, GraphNode } from '@/types';

interface AppStateContextType extends AppState {
  setCurrentRepo: (repo: Repository | null) => void;
  setRepoStatus: (status: RepositoryStatus | null) => void;
  setAnalysisProgress: (progress: AnalysisProgress | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setSelectedNode: (node: GraphNode | null) => void;
  setGatrJobId: (jobId: string | null) => void;
  resetState: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

const initialState: AppState = {
  currentRepo: null,
  repoStatus: null,
  analysisProgress: null,
  isAnalyzing: false,
  selectedNode: null,
  gatrJobId: null,
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const setCurrentRepo = useCallback((repo: Repository | null) => {
    setState(prev => ({ ...prev, currentRepo: repo }));
  }, []);

  const setRepoStatus = useCallback((status: RepositoryStatus | null) => {
    setState(prev => ({ ...prev, repoStatus: status }));
  }, []);

  const setAnalysisProgress = useCallback((progress: AnalysisProgress | null) => {
    setState(prev => ({ ...prev, analysisProgress: progress }));
  }, []);

  const setIsAnalyzing = useCallback((analyzing: boolean) => {
    setState(prev => ({ ...prev, isAnalyzing: analyzing }));
  }, []);

  const setSelectedNode = useCallback((node: GraphNode | null) => {
    setState(prev => ({ ...prev, selectedNode: node }));
  }, []);

  const setGatrJobId = useCallback((jobId: string | null) => {
    setState(prev => ({ ...prev, gatrJobId: jobId }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        setCurrentRepo,
        setRepoStatus,
        setAnalysisProgress,
        setIsAnalyzing,
        setSelectedNode,
        setGatrJobId,
        resetState,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
