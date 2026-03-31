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
  score?: number;
  total_score?: number;  // Backend might send this instead of score
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
      
      // Debug: Log the raw response to see what's coming from the backend
      console.log('KGCompass API Response:', JSON.stringify(data, null, 2));
      if (data.top_candidates && data.top_candidates.length > 0) {
        console.log('First candidate raw:', data.top_candidates[0]);
        console.log('Score field:', data.top_candidates[0].score, 'Type:', typeof data.top_candidates[0].score);
      }
      
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
          <p className="text-[#B8E3E9] text-sm">
            Find the most relevant code entities for your problem using hybrid scoring:
            semantic similarity, textual matching, and graph distance.
          </p>

          <form onSubmit={handleCalculate} className="space-y-4">
            {/* Problem Description */}
            <div>
              <label className="block text-sm font-medium text-[#B8E3E9] mb-2">
                Problem Description
              </label>
              <textarea
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Describe the failing test or the problem you want to fix..."
                className="w-full px-4 py-3 border-2 border-[#4F7C82] rounded-xl focus:ring-2 focus:ring-[#B8E3E9] focus:border-[#B8E3E9] resize-none bg-[#0B2E33] text-[#B8E3E9] placeholder-[#93B1B5]/60 focus:outline-none"
                rows={4}
              />
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#B8E3E9] mb-2">
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
                <label className="block text-sm font-medium text-[#B8E3E9] mb-2">
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
                <label className="block text-sm font-medium text-[#B8E3E9] mb-2">
                  Top K Results
                </label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                  min={1}
                  max={50}
                  className="w-full px-3 py-2 border-2 border-[#4F7C82] rounded-lg focus:ring-2 focus:ring-[#B8E3E9] bg-[#0B2E33] text-[#E8F4F6]"
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
            <div className="bg-red-900/30 border border-red-500/50 text-[#fca5a5] rounded-lg p-3">
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
              // Helper function to safely parse numbers that might be null, undefined, NaN, or strings
              const safeNumber = (val: any): number | null => {
                if (val === null || val === undefined) return null;
                const num = typeof val === 'string' ? parseFloat(val) : Number(val);
                return !isNaN(num) && isFinite(num) ? num : null;
              };

              // Check both 'score' and 'total_score' fields for compatibility
              const rawScore = result.score !== undefined ? result.score : result.total_score;
              const score = safeNumber(rawScore);
              const semanticSim = safeNumber(result.semantic_similarity);
              const textualSim = safeNumber(result.textual_similarity);
                
              return (
                <div 
                  key={result.entity_id || index}
                  className="bg-[#16424a] rounded-lg p-4 border border-[#4F7C82] hover:border-[#B8E3E9] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-[#D4A574]">#{index + 1}</span>
                        <h4 className="font-semibold text-white">{result.entity_name}</h4>
                        <span className="text-xs px-2 py-0.5 bg-[#4F7C82] text-[#B8E3E9] rounded-full border border-[#B8E3E9]/30">
                          {result.entity_type}
                        </span>
                      </div>
                      {result.file_path && (
                        <div className="text-sm text-[#B8E3E9]">
                          📁 {result.file_path}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#4ade80]">
                        {score !== null ? `${(score * 100).toFixed(1)}%` : '0.0%'}
                      </div>
                      <div className="text-xs text-[#93B1B5]">relevance</div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="bg-[#1a3a5a] rounded p-2 text-center border border-[#60a5fa]/40">
                      <div className="font-bold text-[#60a5fa]">
                        {semanticSim !== null ? `${(semanticSim * 100).toFixed(1)}%` : '0.0%'}
                      </div>
                      <div className="text-[#B8E3E9]">Semantic</div>
                    </div>
                    <div className="bg-[#2a2a4a] rounded p-2 text-center border border-[#c084fc]/40">
                      <div className="font-bold text-[#c084fc]">
                        {textualSim !== null ? `${(textualSim * 100).toFixed(1)}%` : '0.0%'}
                      </div>
                      <div className="text-[#B8E3E9]">Textual</div>
                    </div>
                    {result.path_length !== undefined && (
                      <div className="bg-[#2a3530] rounded p-2 text-center border border-[#D4A574]/40">
                        <div className="font-bold text-[#D4A574]">
                          {result.path_length}
                        </div>
                        <div className="text-[#B8E3E9]">Path Length</div>
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
          <pre className="text-xs bg-[#0B2E33] text-[#4ade80] p-4 rounded-lg overflow-x-auto border border-[#4F7C82]">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
