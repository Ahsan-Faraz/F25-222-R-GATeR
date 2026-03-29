// KGCompass Relevance Scoring Panel

import React, { useState } from 'react';
import { calculateRelevance } from '@/lib/api/kgcompass';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Slider from '../ui/Slider';

interface RelevanceResult {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  score: number;
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
      <Card title="KGCompass - Relevance Scoring">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Find the most relevant code entities for your problem using hybrid scoring:
            semantic similarity, textual matching, and graph distance.
          </p>

          <form onSubmit={handleCalculate} className="space-y-4">
            {/* Problem Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Problem Description
              </label>
              <textarea
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Describe the failing test or the problem you want to fix..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                rows={4}
              />
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alpha (Semantic Weight): {alpha.toFixed(2)}
                </label>
                <Slider
                  value={alpha}
                  onChange={setAlpha}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Beta (Textual Weight): {beta.toFixed(2)}
                </label>
                <Slider
                  value={beta}
                  onChange={setBeta}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Top K Results
                </label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                  min={1}
                  max={50}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={loading}>
                🧭 Calculate Relevance
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

      {/* Results */}
      {results.length > 0 && (
        <Card title={`Relevant Entities (${results.length})`}>
          <div className="space-y-3">
            {results.map((result, index) => {
              // Handle potential NaN or undefined values
              const score = typeof result.score === 'number' && !isNaN(result.score) 
                ? result.score 
                : null;
              const semanticSim = typeof result.semantic_similarity === 'number' && !isNaN(result.semantic_similarity)
                ? result.semantic_similarity
                : null;
              const textualSim = typeof result.textual_similarity === 'number' && !isNaN(result.textual_similarity)
                ? result.textual_similarity
                : null;
                
              return (
                <div 
                  key={result.entity_id || index}
                  className="bg-gray-50 rounded-lg p-4 border hover:border-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
                        <h4 className="font-semibold text-primary">{result.entity_name}</h4>
                        <span className="text-xs px-2 py-0.5 bg-accent bg-opacity-20 text-accent rounded-full">
                          {result.entity_type}
                        </span>
                      </div>
                      {result.file_path && (
                        <div className="text-sm text-gray-600">
                          📁 {result.file_path}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {score !== null ? `${(score * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">relevance</div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="bg-blue-50 rounded p-2 text-center">
                      <div className="font-bold text-blue-600">
                        {semanticSim !== null ? `${(semanticSim * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                      <div className="text-gray-600">Semantic</div>
                    </div>
                    <div className="bg-purple-50 rounded p-2 text-center">
                      <div className="font-bold text-purple-600">
                        {textualSim !== null ? `${(textualSim * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                      <div className="text-gray-600">Textual</div>
                    </div>
                    {result.path_length !== undefined && (
                      <div className="bg-orange-50 rounded p-2 text-center">
                        <div className="font-bold text-orange-600">
                          {result.path_length}
                        </div>
                        <div className="text-gray-600">Path Length</div>
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
        <Card title="Debug Information">
          <pre className="text-xs bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
