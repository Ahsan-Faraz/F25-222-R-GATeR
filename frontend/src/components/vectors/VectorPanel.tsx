// Vector Search Panel Component

import React, { useState, useEffect } from 'react';
import { semanticSearch, getVectorStats, clearVectors } from '@/lib/api/vectors';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Search, FileCode, Trash2, RefreshCw, AlertTriangle, Database } from 'lucide-react';

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
    setResults([]); // Clear old results immediately when starting a new search
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
        // Reload stats after clearing
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

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return (
    <div className="space-y-6">
      <Card title="Vector Semantic Search (LanceDB)">
        <div className="space-y-4">
          <p className="text-[#B8E3E9] text-sm">
            Search code entities using natural language. Powered by sentence-transformers embeddings.
          </p>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="bg-emerald-900/40 border border-emerald-500/50 text-emerald-300 rounded-lg p-3 text-sm">
              ✓ {successMessage}
            </div>
          )}
          {error && (
            <div className="bg-red-900/40 border border-red-500/50 text-red-300 rounded-lg p-3 text-sm">
              ✗ {error}
            </div>
          )}

          {/* Stats Bar */}
          {stats && (
            <div className="bg-[#16424a] border border-[#4F7C82] rounded-lg p-3 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#B8E3E9]" />
                <span className="text-[#93B1B5]">Total Vectors:</span>
                <span className="text-[#B8E3E9] font-semibold">{stats.total_vectors || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#93B1B5]">Tables:</span>
                <span className="text-[#D4A574] font-semibold">{stats.table_names?.length || 0}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Search Query
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe what you're looking for (e.g., 'function that parses JSON data')"
                className="w-full px-4 py-3 bg-[#0B2E33] border-2 border-[#4F7C82] text-[#E8F4F6] rounded-xl focus:ring-2 focus:ring-[#B8E3E9] focus:border-[#B8E3E9] resize-none placeholder:text-[#93B1B5]/60"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Results (Top K)
                </label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                  min={1}
                  max={50}
                  className="w-24 px-3 py-2 bg-[#0B2E33] border-2 border-[#4F7C82] text-[#E8F4F6] rounded-lg focus:ring-2 focus:ring-[#B8E3E9] focus:border-transparent outline-none"
                />
              </div>
              <div className="flex-1" />
              <Button type="submit" loading={loading} className="gap-2 bg-[#4F7C82] text-white hover:bg-[#5d8f96]">
                <Search className="w-4 h-4" /> Search
              </Button>
            </div>
          </form>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-2 border-t border-[#4F7C82]/30">
            <div className="flex gap-2">
              {!showClearConfirm ? (
                <Button 
                  onClick={() => setShowClearConfirm(true)} 
                  size="sm" 
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Clear Vector DB
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">Delete all vectors?</span>
                  <Button 
                    onClick={handleClearVectors} 
                    size="sm" 
                    loading={clearing}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Yes, Clear
                  </Button>
                  <Button 
                    onClick={() => setShowClearConfirm(false)} 
                    size="sm" 
                    variant="ghost"
                    className="text-[#93B1B5]"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <Button onClick={loadStats} size="sm" variant="secondary">
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh Stats
            </Button>
          </div>
        </div>
      </Card>

      {results.length > 0 && (
        <Card title={`Search Results (${results.length})`}>
          <div className="space-y-3">
            {results.map((result, index) => (
              <div 
                key={`${result.entity_id}-${result.entity_name}-${index}`}
                className="bg-[#16424a] rounded-lg p-4 border border-[#4F7C82] hover:border-[#B8E3E9] transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white">{result.entity_name}</h4>
                    <span className="text-xs px-2 py-0.5 bg-[#4F7C82] text-[#B8E3E9] border border-[#B8E3E9]/30 rounded-full mt-1 inline-block">
                      {result.entity_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400 tracking-wider">
                      {(result.similarity_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[#93B1B5] uppercase tracking-widest">similarity</div>
                  </div>
                </div>
                
                {result.file_path && (
                  <div className="text-xs text-[#93B1B5] mt-2 font-mono flex items-center gap-1.5">
                    <FileCode className="w-3 h-3 text-[#B8E3E9]" /> {result.file_path}
                  </div>
                )}
                
                {result.source_code && (
                  <pre className="text-xs bg-[#0B2E33] text-emerald-400 p-3 rounded-lg overflow-x-auto mt-3 max-h-40 border border-[#4F7C82] font-mono">
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
          <div className="text-center py-8 text-[#93B1B5]">
            No results found. Try a different query or analyze a repository first.
          </div>
        </Card>
      )}
    </div>
  );
}
