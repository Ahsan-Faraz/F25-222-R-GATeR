// Repository Manager Component

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

  // Enable progress polling when analyzing
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
    } catch (error) {
      // No repo set yet, that's fine
      console.debug('No current repo:', error);
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
        setRepoUrl(''); // Clear input
        
        // Auto-start analysis if needed
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
    
    // Reset progress
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
        
        // Update progress to completed
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
        
        // Reload repo status
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
      <Card title="Repository Management">
        <div className="space-y-6">
          {/* Add Repository Form */}
          <form onSubmit={handleAddRepo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#B8E3E9] mb-2">
                GitHub Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo or owner/repo"
                className="w-full px-4 py-3 border-2 border-[rgba(184,227,233,0.3)] rounded-xl focus:ring-2 focus:ring-[#B8E3E9] focus:border-[#B8E3E9] transition-all bg-[rgba(30,66,74,0.5)] text-[#E8F4F6] placeholder-[rgba(147,177,181,0.6)]"
                disabled={loading || isAnalyzing}
              />
            </div>
            
            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skipGithubArtifacts"
                checked={skipGithubArtifacts}
                onChange={(e) => setSkipGithubArtifacts(e.target.checked)}
                className="w-4 h-4 text-[#4F7C82] bg-[rgba(30,66,74,0.5)] border-[rgba(184,227,233,0.3)] rounded focus:ring-[#B8E3E9]"
                disabled={loading || isAnalyzing}
              />
              <label htmlFor="skipGithubArtifacts" className="text-sm text-[#B8E3E9]">
                Skip GitHub Artifacts (PRs, Issues, Commits) for faster analysis
              </label>
            </div>
            
            <Button type="submit" loading={loading} disabled={isAnalyzing}>
              Add Repository
            </Button>
          </form>

          {/* Current Repository Status */}
          {currentRepo && (
            <div className="bg-[rgba(30,66,74,0.5)] rounded-xl p-5 border-2 border-[rgba(184,227,233,0.2)]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-bold text-lg text-white mb-1">Current Repository</h4>
                  <p className="text-[#B8E3E9] font-medium">
                    {currentRepo.owner}/{currentRepo.name}
                  </p>
                  <p className="text-xs text-[#93B1B5] mt-1">{currentRepo.url}</p>
                </div>
                <span className="px-3 py-1 bg-[rgba(79,124,130,0.4)] text-[#B8E3E9] text-sm font-medium rounded-full border border-[rgba(184,227,233,0.3)]">
                  Active
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={handleAnalyze} 
                  size="sm" 
                  disabled={loading || isAnalyzing}
                  variant="primary"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="animate-spin mr-2">⚙️</span>
                      Analyzing...
                    </>
                  ) : (
                    '🔍 Analyze Repository'
                  )}
                </Button>
                <Button 
                  onClick={handleCheckUpdates} 
                  size="sm" 
                  variant="secondary" 
                  loading={checkingUpdates}
                  disabled={loading || isAnalyzing}
                >
                  🔄 Check Updates
                </Button>
                <Button 
                  onClick={handlePull} 
                  size="sm" 
                  variant="accent" 
                  disabled={loading || isAnalyzing}
                >
                  ⬇️ Pull & Analyze
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Analysis Progress */}
      {isAnalyzing && <AnalysisProgress />}

      {/* Analysis Results */}
      {analysisResults && !isAnalyzing && (
        <Card title="Analysis Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analysisResults.entities_extracted !== undefined && (
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analysisResults.entities_extracted}
                </div>
                <div className="text-sm text-gray-600">Entities Extracted</div>
              </div>
            )}
            {analysisResults.relationships_detected !== undefined && (
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {analysisResults.relationships_detected}
                </div>
                <div className="text-sm text-gray-600">Relationships</div>
              </div>
            )}
            {analysisResults.knowledge_graph?.nodes !== undefined && (
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analysisResults.knowledge_graph.nodes}
                </div>
                <div className="text-sm text-gray-600">Graph Nodes</div>
              </div>
            )}
            {analysisResults.knowledge_graph?.edges !== undefined && (
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analysisResults.knowledge_graph.edges}
                </div>
                <div className="text-sm text-gray-600">Graph Edges</div>
              </div>
            )}
          </div>
          
          {analysisResults.vector_sync && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">
                Vector Sync: {analysisResults.vector_sync.success ? '✅' : '❌'} 
                {analysisResults.vector_sync.vectors_synced !== undefined && 
                  ` - ${analysisResults.vector_sync.vectors_synced} vectors synced`}
              </span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
