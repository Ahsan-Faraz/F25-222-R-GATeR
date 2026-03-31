// KGCompass Relevance Scoring Panel - Minimalist-Futurism Design

import React, { useState } from 'react';
import { calculateRelevance } from '@/lib/api/kgcompass';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Slider from '../ui/Slider';
import { Compass, FileCode } from 'lucide-react';

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
      
      console.log('KGCompass API Response:', JSON.stringify(data, null, 2));
      setResults(data.top_candidates || []);
      setDebugInfo(data.debug_info || null);
    } catch (err: any) {
      setError(err.message || 'Relevance calculation failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="KGCompass">
        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
              Problem Description
            </label>
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Describe the failing test or problem..."
              className="ghost-input w-full resize-none"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                Alpha (Semantic): <span className="text-text-primary font-mono">{alpha.toFixed(2)}</span>
              </label>
              <Slider value={alpha} onChange={setAlpha} min={0} max={1} step={0.1} />
            </div>
            
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                Beta (Textual): <span className="text-text-primary font-mono">{beta.toFixed(2)}</span>
              </label>
              <Slider value={beta} onChange={setBeta} min={0} max={1} step={0.1} />
            </div>

            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                Top K Results
              </label>
              <input
                type="number"
                value={topK}
                onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                min={1}
                max={50}
                className="ghost-input w-full"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={loading} icon={<Compass className="w-4 h-4" />}>
              Calculate Relevance
            </Button>
          </div>
        </form>

        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card title={`Results (${results.length})`}>
          <div className="space-y-2">
            {results.map((result, index) => {
              const safeNumber = (val: any): number | null => {
                if (val === null || val === undefined) return null;
                const num = typeof val === 'string' ? parseFloat(val) : Number(val);
                return !isNaN(num) && isFinite(num) ? num : null;
              };

              const rawScore = result.score !== undefined ? result.score : result.total_score;
              const score = safeNumber(rawScore);
              const semanticSim = safeNumber(result.semantic_similarity);
              const textualSim = safeNumber(result.textual_similarity);
                
              return (
                <div 
                  key={result.entity_id || index}
                  className="bg-surface-elevated border border-border rounded-md p-4 hover:border-border-hover transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-text-muted">#{index + 1}</span>
                        <h4 className="font-mono font-medium text-text-primary">{result.entity_name}</h4>
                        <span className="text-xs px-2 py-0.5 bg-surface border border-border text-text-secondary rounded">
                          {result.entity_type}
                        </span>
                      </div>
                      {result.file_path && (
                        <div className="text-xs text-text-muted font-mono flex items-center gap-1.5 mt-1">
                          <FileCode className="w-3 h-3" /> {result.file_path}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-mono font-semibold text-accent">
                        {score !== null ? `${(score * 100).toFixed(1)}%` : '0.0%'}
                      </div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider">relevance</div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-surface border border-border rounded-md px-3 py-2 text-center">
                      <div className="font-mono font-semibold text-blue-400">
                        {semanticSim !== null ? `${(semanticSim * 100).toFixed(1)}%` : '0.0%'}
                      </div>
                      <div className="text-text-muted">Semantic</div>
                    </div>
                    <div className="bg-surface border border-border rounded-md px-3 py-2 text-center">
                      <div className="font-mono font-semibold text-purple-400">
                        {textualSim !== null ? `${(textualSim * 100).toFixed(1)}%` : '0.0%'}
                      </div>
                      <div className="text-text-muted">Textual</div>
                    </div>
                    {result.path_length !== undefined && (
                      <div className="bg-surface border border-border rounded-md px-3 py-2 text-center">
                        <div className="font-mono font-semibold text-amber-400">
                          {result.path_length}
                        </div>
                        <div className="text-text-muted">Path</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Debug Info */}
      {debugInfo && (
        <Card title="Debug">
          <pre className="text-xs bg-bg text-green-400 p-4 rounded-md overflow-x-auto border border-border font-mono">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
