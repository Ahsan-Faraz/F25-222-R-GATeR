// Vector Search Panel Component - Minimalist-Futurism Design

import React, { useState, useEffect } from 'react';
import { semanticSearch, getVectorStats, clearVectors } from '@/lib/api/vectors';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Search, FileCode, Trash2, RefreshCw, AlertTriangle, Database, Layers } from 'lucide-react';

interface SearchResult {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  similarity_score: number;
  file_path?: string;
  source_code?: string;
  metadata?: Record<string, any>;
}

export default function VectorPanel() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(10);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const data = await semanticSearch({ text: query, topK });
      setResults(data || []);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getVectorStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load vector stats:', err);
    }
  };

  const handleClearVectors = async () => {
    setClearing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await clearVectors();
      if (result.success) {
        setSuccessMessage('Vector database cleared successfully');
        setShowClearConfirm(false);
        setResults([]);
        await loadStats();
      } else {
        setError('Failed to clear vector database');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clear vector database');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 text-green-400 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Stats Ribbon */}
      {stats && (
        <Card>
          <div className="stat-ribbon">
            <div className="stat-item">
              <Database className="w-4 h-4 text-text-muted mb-1" />
              <span className="stat-label">Vectors</span>
              <span className="stat-value">{stats.total_vectors || 0}</span>
            </div>
            <div className="stat-item">
              <Layers className="w-4 h-4 text-text-muted mb-1" />
              <span className="stat-label">Tables</span>
              <span className="stat-value">{stats.table_names?.length || 0}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Search Form */}
      <Card title="Semantic Search">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you're looking for..."
              className="ghost-input w-full resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs text-text-muted uppercase tracking-wider">Top K</label>
              <input
                type="number"
                value={topK}
                onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                min={1}
                max={50}
                className="ghost-input w-20 text-center"
              />
            </div>
            <Button type="submit" loading={loading} icon={<Search className="w-4 h-4" />}>
              Search
            </Button>
          </div>
        </form>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div>
          {!showClearConfirm ? (
            <Button 
              onClick={() => setShowClearConfirm(true)} 
              size="sm" 
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:border-red-400/50"
              icon={<Trash2 className="w-4 h-4" />}
            >
              Clear Vector DB
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 rounded-md px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">Delete all vectors?</span>
              <Button onClick={handleClearVectors} size="sm" variant="danger" loading={clearing}>
                Confirm
              </Button>
              <Button onClick={() => setShowClearConfirm(false)} size="sm" variant="ghost">
                Cancel
              </Button>
            </div>
          )}
        </div>
        <Button 
          onClick={loadStats} 
          size="sm" 
          variant="ghost"
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <Card title={`Results (${results.length})`}>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div 
                key={`${result.entity_id}-${result.entity_name}-${index}`}
                className="bg-surface-elevated border border-border rounded-md p-4 hover:border-border-hover transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-mono font-medium text-text-primary">{result.entity_name}</h4>
                    <span className="text-xs px-2 py-0.5 bg-surface border border-border text-text-secondary rounded mt-1 inline-block">
                      {result.entity_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-semibold text-accent">
                      {(result.similarity_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">similarity</div>
                  </div>
                </div>
                
                {result.file_path && (
                  <div className="text-xs text-text-muted mt-2 font-mono flex items-center gap-1.5">
                    <FileCode className="w-3 h-3" /> {result.file_path}
                  </div>
                )}
                
                {result.source_code && (
                  <pre className="text-xs bg-bg text-green-400 p-3 rounded-md overflow-x-auto mt-3 max-h-40 border border-border font-mono">
                    {result.source_code.slice(0, 500)}
                    {result.source_code.length > 500 && '...'}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {results.length === 0 && query && !loading && !error && (
        <Card>
          <div className="text-center py-8 text-text-muted">
            No results found. Try a different query or analyze a repository first.
          </div>
        </Card>
      )}
    </div>
  );
}
