// Stitch screen `3a1d8792207e4578b275313fd8a4703d` — Vector Search Retrieval

import React, { useState, useEffect, useMemo } from 'react';
import { semanticSearch, getVectorStats, clearVectors } from '@/lib/api/vectors';
import Button from '../ui/Button';
import MaterialIcon from '../ui/MaterialIcon';
import { FileCode, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

interface SearchResult {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  similarity_score: number;
  file_path?: string;
  source_code?: string;
  metadata?: Record<string, any>;
}

function ScoreRing({ score, color }: { score: number; color: 'primary' | 'secondary' | 'tertiary' }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, score)));
  const stroke =
    color === 'primary' ? '#c3f5ff' : color === 'secondary' ? '#cdbdff' : '#ffebc6';
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle className="text-surface-container-highest" cx="32" cy="32" fill="transparent" r={r} stroke="currentColor" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          fill="transparent"
          r={r}
          stroke={stroke}
          strokeWidth="4"
          strokeDasharray={175.9}
          strokeDashoffset={off}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-bold text-on-surface">
        {score.toFixed(2)}
      </span>
    </div>
  );
}

export default function VectorPanel() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(25);
  const [threshold, setThreshold] = useState(82);
  const [partition, setPartition] = useState('code');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const threshold01 = threshold / 100;

  const filteredResults = useMemo(
    () => results.filter((r) => r.similarity_score >= threshold01),
    [results, threshold01]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const data = await semanticSearch({ text: query, topK });
      setResults((data || []) as unknown as SearchResult[]);
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

  const ringColor = (i: number): 'primary' | 'secondary' | 'tertiary' =>
    i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'secondary' : 'tertiary';

  return (
    <div className="space-y-10 animate-fade-in max-w-7xl mx-auto">
      {successMessage && (
        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(195,245,255,0.45)]" />
          <span className="font-mono text-xs">{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-mono text-xs">{error}</span>
        </div>
      )}

      <div className="mb-2">
        <h2 className="font-headline text-[2.5rem] md:text-[3.5rem] font-extrabold tracking-tighter text-on-surface leading-tight mb-2">
          Vector Search
        </h2>
        <p className="text-on-surface-variant max-w-2xl text-base md:text-lg leading-relaxed">
          Query the high-dimensional latent space of your repository using semantic similarity. Find logic, not just
          strings.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-xl/5">
            <div className="flex items-center gap-2 text-on-surface-variant/70 mb-2">
              <MaterialIcon name="scatter_plot" className="!text-[22px] text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Index size</span>
            </div>
            <p className="text-3xl font-mono font-semibold text-on-surface tracking-tight">
              {(stats.total_vectors || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Stored embeddings</p>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-xl/5">
            <div className="flex items-center gap-2 text-on-surface-variant/70 mb-2">
              <MaterialIcon name="table_rows" className="!text-[22px] text-secondary" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Lance tables</span>
            </div>
            <p className="text-3xl font-mono font-semibold text-on-surface tracking-tight">
              {stats.table_names?.length || 0}
            </p>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Collections</p>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low rounded-xl p-6 md:p-8 mb-6 border border-outline-variant/10 shadow-2xl">
        <form onSubmit={handleSearch} className="space-y-8">
          <div className="relative">
            <MaterialIcon
              name="search_insights"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-primary text-2xl pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter natural language query or code fragment..."
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-5 pl-14 pr-6 text-lg font-body focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-on-surface-variant/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-8 md:gap-10 pt-4 border-t border-outline-variant/10">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-mono uppercase tracking-[0.2em] text-on-surface-variant/70">
                  Similarity Threshold
                </label>
                <span className="text-primary font-mono text-sm">{(threshold / 100).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between mt-2 font-mono text-[10px] text-on-surface-variant/50">
                <span>RELAXED (0.50)</span>
                <span>STRICT (0.95)</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-[0.2em] text-on-surface-variant/70">Result Limit</label>
                <select
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                  className="bg-surface-container-highest border-none rounded text-sm font-mono px-4 py-2 text-primary focus:ring-1 focus:ring-primary"
                >
                  <option value={10}>Top 10</option>
                  <option value={25}>Top 25</option>
                  <option value={50}>Top 50</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-[0.2em] text-on-surface-variant/70">Index Partition</label>
                <select
                  value={partition}
                  onChange={(e) => setPartition(e.target.value)}
                  className="bg-surface-container-highest border-none rounded text-sm font-mono px-4 py-2 text-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="code">Global Codebase</option>
                  <option value="docs">Documentation</option>
                  <option value="deps">Dependency Graph</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="ml-auto self-end bg-gradient-to-br from-primary to-[#00626e] text-on-primary px-8 py-4 rounded-lg font-bold hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <MaterialIcon name="bolt" className="!text-xl" />
                EXECUTE QUERY
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          type="button"
          onClick={loadStats}
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-on-surface-variant border border-outline-variant/20 rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors w-fit"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh stats
        </button>
        <div>
          {!showClearConfirm ? (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-error border border-outline-variant/20 rounded-lg px-4 py-2 hover:bg-error-container/10 hover:border-error/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear vector DB
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-error/25 bg-error-container/15 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-on-error-container shrink-0" />
              <span className="text-sm text-on-error-container font-mono">Delete all vectors?</span>
              <Button onClick={handleClearVectors} size="sm" variant="danger" loading={clearing}>
                Confirm
              </Button>
              <Button onClick={() => setShowClearConfirm(false)} size="sm" variant="ghost">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="font-mono text-sm uppercase tracking-widest text-on-surface-variant/80">
                {filteredResults.length} semantic matches
                {filteredResults.length < results.length && (
                  <span className="text-on-surface-variant/50"> ({results.length} raw)</span>
                )}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-primary'}`}
                aria-label="List view"
              >
                <MaterialIcon name="view_agenda" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-primary'}`}
                aria-label="Grid view"
              >
                <MaterialIcon name="grid_view" />
              </button>
            </div>
          </div>

          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
            {filteredResults.map((result, index) => (
              <div
                key={`${result.entity_id}-${result.entity_name}-${index}`}
                className="group bg-surface-container-low hover:bg-surface-container rounded-lg border border-outline-variant/10 transition-all overflow-hidden flex flex-col md:flex-row"
              >
                <div className="w-full md:w-48 bg-surface-container-highest/30 p-6 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-outline-variant/10">
                  <ScoreRing score={result.similarity_score} color={ringColor(index)} />
                  <span className="text-[10px] font-mono uppercase text-on-surface-variant/60 tracking-tighter mt-2">
                    Similarity
                  </span>
                </div>
                <div className="flex-1 p-6 min-w-0">
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-primary mb-1">
                        <MaterialIcon name="code" className="!text-sm" />
                        <h4 className="font-mono text-sm font-semibold truncate">{result.entity_name}</h4>
                      </div>
                      <p className="text-xs text-on-surface-variant/70 font-mono truncate">
                        {result.entity_type} · {result.entity_id?.slice(0, 24) || '—'}
                      </p>
                    </div>
                    <button type="button" className="text-on-surface-variant hover:text-primary shrink-0" aria-label="Open">
                      <MaterialIcon name="open_in_new" />
                    </button>
                  </div>
                  {result.file_path && (
                    <div className="text-xs text-on-surface-variant mb-3 font-mono flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                      <span className="break-all">{result.file_path}</span>
                    </div>
                  )}
                  {result.source_code && (
                    <pre className="text-xs p-4 rounded border border-outline-variant/10 bg-surface-container-lowest font-mono text-on-surface leading-relaxed overflow-x-auto max-h-52 code-scroll relative">
                      {result.source_code.slice(0, 500)}
                      {result.source_code.length > 500 && '…'}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="p-1 bg-surface-container rounded text-on-surface-variant hover:text-primary cursor-pointer">
                          <MaterialIcon name="content_copy" className="!text-xs" />
                        </span>
                      </div>
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredResults.length === 0 && results.length > 0 && (
            <p className="text-center text-sm text-on-surface-variant font-mono py-6">
              No results above threshold {(threshold01).toFixed(2)}. Lower the similarity slider.
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              className="px-10 py-3 border border-outline-variant/20 rounded-full text-on-surface-variant font-mono text-xs uppercase tracking-widest hover:bg-surface-container-high hover:text-primary transition-all"
            >
              Load next batch
            </button>
          </div>
        </div>
      )}

      {results.length === 0 && query && !loading && !error && (
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-6 py-12 text-center">
          <MaterialIcon name="search_off" className="mx-auto mb-3 text-on-surface-variant/40 !text-[40px]" />
          <p className="text-sm text-on-surface-variant font-mono">
            No results. Try a different query or run repository analysis first.
          </p>
        </div>
      )}

      <div className="fixed bottom-8 left-8 z-30">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-14 h-14 rounded-full bg-primary shadow-[0_0_20px_rgba(195,245,255,0.3)] flex items-center justify-center text-on-primary hover:scale-105 active:scale-95 transition-all"
          aria-label="Back to top"
        >
          <MaterialIcon name="terminal" className="!text-2xl" filled />
        </button>
      </div>
    </div>
  );
}
