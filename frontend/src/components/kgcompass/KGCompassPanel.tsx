// Stitch screen `f427898ce83c44e1886e137df7ec87ca` — KGCompass Search

import React, { useState } from 'react';
import { calculateRelevance } from '@/lib/api/kgcompass';
import Slider from '../ui/Slider';
import MaterialIcon from '../ui/MaterialIcon';

interface RelevanceResult {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  score?: number;
  total_score?: number;
  semantic_similarity?: number;
  textual_similarity?: number;
  path_length?: number;
  path_decay_factor?: number;
  file_path?: string;
}

const SUGGESTIONS = [
  'Find all tests related to auth-service',
  'Trace dependency path: API → Database',
  'Show circular logic in core-engine.ts',
  'Unused nodes in graph cluster 07',
];

export default function KGCompassPanel() {
  const [problemDescription, setProblemDescription] = useState('');
  const [alpha, setAlpha] = useState(0.5);
  const [beta, setBeta] = useState(0.5);
  const [topK, setTopK] = useState(10);
  const [results, setResults] = useState<RelevanceResult[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await calculateRelevance({
        problem_description: problemDescription,
        alpha,
        beta,
        top_k: topK,
      });
      setResults((data.top_candidates || []) as unknown as RelevanceResult[]);
      setDebugInfo(data.debug_info || null);
    } catch (err: any) {
      setError(err.message || 'Relevance calculation failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const top = results[0];

  return (
    <div className="max-w-6xl mx-auto space-y-16 animate-fade-in px-0 md:px-2">
      <section>
        <h2 className="font-headline text-[2.5rem] md:text-[3.5rem] font-extrabold tracking-tighter text-on-surface leading-tight mb-4">
          KGCompass
        </h2>
        <p className="text-lg text-on-surface-variant font-body max-w-2xl leading-relaxed">
          Traverse your codebase through graph-aware relevance scoring. Query relationships, dependencies, and logical
          nodes with natural language.
        </p>
      </section>

      <section className="relative mb-8">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-secondary/10 blur-[100px] rounded-full pointer-events-none" />
        <form onSubmit={handleCalculate} className="relative">
          <div className="rounded-xl border border-outline-variant/10 bg-[rgba(53,52,54,0.55)] backdrop-blur-xl p-1.5 shadow-2xl">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 px-4 md:px-6 min-h-[4.5rem] bg-surface-container-lowest rounded-lg border border-outline-variant/20 focus-within:border-primary transition-all">
              <MaterialIcon name="search" className="text-primary text-3xl shrink-0 hidden sm:block" />
              <input
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Query the Knowledge Graph..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-body text-on-surface placeholder:text-on-surface-variant/50 py-3"
              />
              <div className="flex items-center gap-2 shrink-0 pb-3 lg:pb-0">
                <span className="px-2 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-mono rounded">
                  CMD
                </span>
                <span className="px-2 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-mono rounded">
                  K
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 px-6 md:px-8 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold rounded-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  Execute
                  <MaterialIcon name="bolt" className="!text-lg" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 items-center">
            <span className="text-xs font-mono text-on-surface-variant/60 uppercase tracking-widest mr-2">Suggestions:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setProblemDescription(s)}
                className="h-8 px-4 rounded-full bg-surface-container-low border border-outline-variant/10 text-xs text-on-surface-variant hover:border-primary/50 hover:text-primary transition-all text-left max-w-full"
              >
                &quot;{s}&quot;
              </button>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/70 mb-2">
                  Alpha (semantic){' '}
                  <span className="text-primary font-mono">{alpha.toFixed(2)}</span>
                </label>
                <Slider value={alpha} onChange={setAlpha} min={0} max={1} step={0.05} />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/70 mb-2">
                  Beta (textual){' '}
                  <span className="text-primary font-mono">{beta.toFixed(2)}</span>
                </label>
                <Slider value={beta} onChange={setBeta} min={0} max={1} step={0.05} />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/70 mb-2">
                  Top K
                </label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 10)))}
                  min={1}
                  max={50}
                  className="ghost-input w-full font-mono bg-surface-container-low"
                />
              </div>
            </div>
          </div>
        </form>
      </section>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container/15 px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <h3 className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-2">Workspace</h3>
              <h4 className="text-2xl font-headline font-bold text-on-surface">Top relevance</h4>
            </div>
            <div className="flex gap-2">
              <span className="p-2 rounded bg-surface-container-low border border-outline-variant/20 text-on-surface-variant">
                <MaterialIcon name="grid_view" />
              </span>
              <span className="p-2 rounded bg-surface-container-high border border-outline-variant/20 text-primary">
                <MaterialIcon name="view_quilt" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 md:p-8 hover:border-primary/30 transition-all">
              <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center border border-primary/20 shrink-0">
                    <MaterialIcon name="mediation" className="text-primary text-2xl" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-primary uppercase tracking-widest">Top candidate</p>
                    <h5 className="text-xl font-bold font-headline truncate">{top?.entity_name || '—'}</h5>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-surface-container text-tertiary text-[10px] font-mono border border-tertiary/20">
                  {top?.entity_type || '—'}
                </span>
              </div>
              <div className="aspect-video w-full bg-[#1c1b1d] rounded-lg mb-6 overflow-hidden relative border border-outline-variant/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50" />
                <div className="absolute bottom-4 left-4 p-3 bg-surface-container-lowest/85 backdrop-blur rounded border border-outline-variant/20 max-w-[90%]">
                  <p className="text-[10px] font-mono text-on-surface-variant">
                    Showing {results.length} ranked entities for your query
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-8 border-t border-outline-variant/10 pt-6 flex-wrap">
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1">Rank</p>
                  <p className="text-lg font-bold font-mono">1</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1">Score</p>
                  <p className="text-lg font-bold font-mono text-primary">
                    {top?.score != null || top?.total_score != null
                      ? `${(((top?.score ?? top?.total_score) as number) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <div className="flex-1 bg-surface-container-low border border-outline-variant/10 rounded-xl p-6">
                <h5 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <MaterialIcon name="auto_awesome" className="text-secondary text-lg" filled />
                  Relevance mix
                </h5>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Alpha weights semantic alignment; beta weights textual overlap. Tune sliders and re-run Execute.
                </p>
                <div className="mt-6 p-3 bg-surface-container-lowest rounded border border-outline-variant/20">
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase mb-2">Confidence (top)</p>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all"
                      style={{
                        width: `${Math.min(100, ((top?.score ?? top?.total_score ?? 0) as number) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 bg-surface-container-lowest border border-outline-variant/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/10 flex justify-between items-center">
                <h5 className="text-sm font-bold font-headline uppercase tracking-widest">Matched Nodes ({results.length})</h5>
                <span className="text-xs font-mono text-primary flex items-center gap-1">
                  <MaterialIcon name="filter_list" className="!text-sm" />
                  Sorted by score
                </span>
              </div>
              <div className="divide-y divide-outline-variant/5">
                {results.map((result, index) => {
                  const safeNumber = (val: any): number | null => {
                    if (val === null || val === undefined) return null;
                    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
                    return !isNaN(num) && isFinite(num) ? num : null;
                  };
                  const rawScore = result.score !== undefined ? result.score : result.total_score;
                  const score = safeNumber(rawScore);
                  const dot = index % 3 === 0 ? 'bg-secondary' : index % 3 === 1 ? 'bg-primary' : 'bg-tertiary';
                  return (
                    <div
                      key={result.entity_id || index}
                      className="px-6 py-4 flex items-center gap-6 hover:bg-surface-container-low transition-all cursor-default"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-on-surface truncate">{result.entity_name}</p>
                        <p className="text-xs text-on-surface-variant/70 truncate">
                          {result.file_path || result.entity_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="px-2 py-1 bg-surface-container-highest rounded text-[10px] font-mono text-on-surface-variant uppercase">
                          {result.entity_type}
                        </div>
                        <span className="text-sm font-mono text-primary w-14 text-right">
                          {score !== null ? `${(score * 100).toFixed(0)}%` : '—'}
                        </span>
                        <MaterialIcon name="chevron_right" className="text-on-surface-variant/40 !text-sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {debugInfo && (
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
          <h4 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-3">Debug</h4>
          <pre className="text-xs text-primary-fixed-dim p-4 rounded-lg overflow-x-auto font-mono bg-[#0e0e0f] border border-outline-variant/15 max-h-64">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </section>
      )}

      <div className="fixed bottom-8 left-8 z-30 flex items-center gap-4">
        <div className="bg-surface-container-highest px-4 py-2 rounded-full border border-outline-variant/20 shadow-xl flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
          <span className="text-xs font-mono text-on-surface">KG index ready</span>
        </div>
      </div>
    </div>
  );
}
