// Repository Manager Component - Minimalist-Futurism Design

import React, { useState, useEffect } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/useToast';
import { useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { 
  addRepository, 
  analyzeRepository, 
  getRepositoryStatus, 
  checkForUpdates, 
  pullAndAnalyze,
  getAnalysisStatus 
} from '@/lib/api/repo';
import { FolderGit2, Search, RefreshCw, Download, CircleDot, GitBranch, Clock } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AnalysisProgress from './AnalysisProgress';

export default function RepoManager() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [skipGithubArtifacts, setSkipGithubArtifacts] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const { currentRepo, isAnalyzing, setCurrentRepo, setIsAnalyzing, setAnalysisProgress } = useAppState();
  const { showToast } = useToast();

  useAnalysisProgress(isAnalyzing);

  useEffect(() => {
    loadCurrentRepo();
    checkAnalysisStatus();
  }, []);

  const loadCurrentRepo = async () => {
    try {
      const data = await getRepositoryStatus();
      if (data.repo_info) {
        setCurrentRepo(data.repo_info);
      }
    } catch (error: any) {
      // 400 error is expected when no repo is selected - don't log it
      if (error?.status !== 400) {
        console.debug('Failed to load repo status:', error);
      }
    }
  };

  const checkAnalysisStatus = async () => {
    try {
      const data = await getAnalysisStatus();
      if (data.status === 'analyzing') {
        setIsAnalyzing(true);
      }
      if (data.current_repo) {
        setCurrentRepo(data.current_repo);
      }
    } catch (error) {
      console.debug('Failed to check analysis status:', error);
    }
  };

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      showToast('error', 'Please enter a repository URL');
      return;
    }

    setLoading(true);
    try {
      const result = await addRepository(repoUrl);
      if (result.success && result.repo_info) {
        setCurrentRepo(result.repo_info);
        showToast('success', result.message || `Repository ${result.repo_info.name} added successfully`);
        setRepoUrl('');
        
        if (result.needs_analysis) {
          showToast('info', 'Starting analysis...');
          setTimeout(() => handleAnalyze(), 500);
        }
      } else {
        showToast('error', (result as any).error || 'Failed to add repository');
      }
    } catch (error: any) {
      showToast('error', error.message || 'Failed to add repository');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!currentRepo) {
      showToast('error', 'No repository selected. Please add a repository first.');
      return;
    }

    setLoading(true);
    setIsAnalyzing(true);
    setAnalysisResults(null);
    
    setAnalysisProgress({
      step: 0,
      step_name: '',
      step_description: 'Starting analysis...',
      details: {},
      start_time: null,
      current_step_start: null,
      total_steps: 6,
      percentage: 0,
      status: 'analyzing',
    });

    try {
      const result = await analyzeRepository(skipGithubArtifacts);
      
      if (result.success) {
        showToast('success', result.message || 'Repository analysis completed');
        setAnalysisResults(result.results || result);
        
        setAnalysisProgress({
          step: 6,
          step_name: 'Complete',
          step_description: 'Analysis completed successfully',
          details: {},
          start_time: null,
          current_step_start: null,
          total_steps: 6,
          percentage: 100,
          status: 'completed',
        });
        
        await loadCurrentRepo();
      } else {
        showToast('error', (result as any).error || 'Analysis failed');
      }
    } catch (error: any) {
      showToast('error', error.message || 'Analysis failed');
      setAnalysisProgress(null);
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (!currentRepo) {
      showToast('error', 'No repository selected');
      return;
    }

    setCheckingUpdates(true);
    try {
      const result = await checkForUpdates();
      if (result.up_to_date) {
        showToast('info', 'Repository is up to date');
      } else {
        showToast('warning', `${result.commits_behind} commits behind. Pull to update.`);
      }
    } catch (error: any) {
      showToast('error', error.message || 'Failed to check updates');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handlePull = async () => {
    if (!currentRepo) {
      showToast('error', 'No repository selected');
      return;
    }

    setLoading(true);
    setIsAnalyzing(true);
    try {
      const result = await pullAndAnalyze();
      if (result.success) {
        showToast('success', result.changes_detected ? 'Updates pulled and analyzed' : 'Already up to date');
        await loadCurrentRepo();
      } else {
        showToast('error', (result as any).error || 'Failed to pull updates');
      }
    } catch (error: any) {
      showToast('error', error.message || 'Failed to pull updates');
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Repository */}
      <Card title="Add Repository">
        <form onSubmit={handleAddRepo} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="ghost-input w-full"
                disabled={loading || isAnalyzing}
              />
            </div>
            <Button type="submit" loading={loading} disabled={isAnalyzing}>
              Add
            </Button>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipGithubArtifacts}
              onChange={(e) => setSkipGithubArtifacts(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-surface text-accent focus:ring-accent"
              disabled={loading || isAnalyzing}
            />
            <span className="text-sm text-text-secondary">
              Skip GitHub artifacts (faster analysis)
            </span>
          </label>
        </form>
      </Card>

      {/* Current Repository */}
      {currentRepo && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-surface-elevated border border-border flex items-center justify-center">
                <FolderGit2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-mono font-medium">
                    {currentRepo.owner}/{currentRepo.name}
                  </span>
                  <span className="flex items-center gap-1 text-green-500 text-xs">
                    <CircleDot className="w-2 h-2 fill-current" />
                    Active
                  </span>
                </div>
                <span className="text-xs text-text-muted font-mono">{currentRepo.url}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleAnalyze} 
              size="sm" 
              variant="ghost"
              disabled={loading || isAnalyzing}
              icon={<Search className="w-4 h-4" />}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
            <Button 
              onClick={handleCheckUpdates} 
              size="sm" 
              variant="ghost" 
              loading={checkingUpdates}
              disabled={loading || isAnalyzing}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Check Updates
            </Button>
            <Button 
              onClick={handlePull} 
              size="sm" 
              variant="ghost" 
              disabled={loading || isAnalyzing}
              icon={<Download className="w-4 h-4" />}
            >
              Pull & Analyze
            </Button>
          </div>
        </Card>
      )}

      {/* Analysis Progress */}
      {isAnalyzing && <AnalysisProgress />}

      {/* Analysis Results */}
      {analysisResults && !isAnalyzing && (
        <Card title="Analysis Results">
          {/* Statistical Ribbon */}
          <div className="stat-ribbon">
            {analysisResults.entities_extracted !== undefined && (
              <div className="stat-item">
                <span className="stat-label">Entities</span>
                <span className="stat-value">{analysisResults.entities_extracted}</span>
              </div>
            )}
            {analysisResults.relationships_detected !== undefined && (
              <div className="stat-item">
                <span className="stat-label">Relationships</span>
                <span className="stat-value">{analysisResults.relationships_detected}</span>
              </div>
            )}
            {analysisResults.knowledge_graph?.nodes !== undefined && (
              <div className="stat-item">
                <span className="stat-label">Nodes</span>
                <span className="stat-value">{analysisResults.knowledge_graph.nodes}</span>
              </div>
            )}
            {analysisResults.knowledge_graph?.edges !== undefined && (
              <div className="stat-item">
                <span className="stat-label">Edges</span>
                <span className="stat-value">{analysisResults.knowledge_graph.edges}</span>
              </div>
            )}
          </div>
          
          {analysisResults.vector_sync && (
            <div className="mt-4 py-2 px-3 bg-surface-elevated border border-border rounded-md flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${analysisResults.vector_sync.success ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-text-secondary font-mono">
                Vector Sync: {analysisResults.vector_sync.vectors_synced ?? 0} vectors
              </span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
