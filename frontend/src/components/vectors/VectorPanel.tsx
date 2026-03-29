// Vector Search Panel Component

import React, { useState } from 'react';
import { semanticSearch, getVectorStats } from '@/lib/api/vectors';
import Card from '../ui/Card';
import Button from '../ui/Button';

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
          <p className="text-gray-600 text-sm">
            Search code entities using natural language. Powered by sentence-transformers embeddings.
          </p>

          {/* Stats Summary */}
          {stats && (
            <div className="bg-gray-50 rounded-lg p-3 flex gap-4 text-sm">
              <span><strong>Total Vectors:</strong> {stats.total_vectors || 0}</span>
              <span><strong>Tables:</strong> {stats.table_names?.length || 0}</span>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Query
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe what you're looking for (e.g., 'function that parses JSON data')"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Results (Top K)
                </label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                  min={1}
                  max={50}
                  className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="flex-1" />
              <Button type="submit" loading={loading}>
                🔍 Search
              </Button>
            </div>
          </form>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Search Results */}
      {results.length > 0 && (
        <Card title={`Search Results (${results.length})`}>
          <div className="space-y-3">
            {results.map((result, index) => (
              <div 
                key={result.entity_id || index}
                className="bg-gray-50 rounded-lg p-4 border hover:border-accent transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-primary">{result.entity_name}</h4>
                    <span className="text-xs px-2 py-1 bg-accent bg-opacity-20 text-accent rounded-full">
                      {result.entity_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {(result.similarity_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">similarity</div>
                  </div>
                </div>
                
                {result.file_path && (
                  <div className="text-sm text-gray-600 mb-2">
                    📁 {result.file_path}
                  </div>
                )}
                
                {result.source_code && (
                  <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded-lg overflow-x-auto mt-2 max-h-40">
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
          <div className="text-center py-8 text-gray-500">
            No results found. Try a different query or analyze a repository first.
          </div>
        </Card>
      )}
    </div>
  );
}
