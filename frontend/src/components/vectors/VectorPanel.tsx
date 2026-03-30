// Vector Search Panel Component

import React, { useState } from 'react';
import { semanticSearch, getVectorStats } from '@/lib/api/vectors';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Search, FileCode } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
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

  React.useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <Card title="Vector Semantic Search">
        <div className="space-y-4">
          <p className="text-[var(--color-text-muted)] text-sm">
            Search code entities using natural language. Powered by sentence-transformers embeddings.
          </p>

          {stats && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex gap-4 text-sm text-[var(--color-text-muted)]">
              <span><strong className="text-white">Total Vectors:</strong> {stats.total_vectors || 0}</span>
              <span><strong className="text-white">Tables:</strong> {stats.table_names?.length || 0}</span>
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
                className="w-full px-4 py-3 bg-black/30 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-[var(--color-cyan)] focus:border-[var(--color-cyan)] resize-none placeholder:text-white/20"
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
                  className="w-24 px-3 py-2 bg-black/40 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-[var(--color-cyan)] focus:border-transparent outline-none"
                />
              </div>
              <div className="flex-1" />
              <Button type="submit" loading={loading} className="gap-2 bg-[var(--color-cyan)] text-[#0f0f13] hover:brightness-110">
                <Search className="w-4 h-4" /> Search
              </Button>
            </div>
          </form>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>
      </Card>

      {results.length > 0 && (
        <Card title={`Search Results (${results.length})`}>
          <div className="space-y-3">
            {results.map((result, index) => (
              <div 
                key={result.entity_id || index}
                className="bg-white/5 rounded-lg p-4 border border-white/5 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white">{result.entity_name}</h4>
                    <span className="text-xs px-2 py-0.5 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)] border border-[var(--color-cyan)]/20 rounded-full mt-1 inline-block">
                      {result.entity_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-display font-bold text-emerald-400 tracking-wider">
                      {(result.similarity_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[var(--color-text-faint)] uppercase tracking-widest">similarity</div>
                  </div>
                </div>
                
                {result.file_path && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-2 font-mono flex items-center gap-1.5 opacity-80">
                    <FileCode className="w-3 h-3 text-[var(--color-cyan)]" /> {result.file_path}
                  </div>
                )}
                
                {result.source_code && (
                  <pre className="text-xs bg-black/50 text-emerald-400 p-3 rounded-lg overflow-x-auto mt-3 max-h-40 border border-white/5 font-mono">
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
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            No results found. Try a different query or analyze a repository first.
          </div>
        </Card>
      )}
    </div>
  );
}
