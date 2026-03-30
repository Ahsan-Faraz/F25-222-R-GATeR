// GATR Test Repair Panel

import React, { useState, useEffect } from 'react';
import { repairTest, getRepairStatus, getRepairResults, getTestContext } from '@/lib/api/gatr';
import Card from '../ui/Card';
import Button from '../ui/Button';
import DiffViewer from '../ui/DiffViewer';
import { Wrench, SearchCode, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface RepairState {
  jobId: string | null;
  status: string;
  currentStep: number;
  message: string;
  result: any;
}

export default function GATRPanel() {
  const [testCode, setTestCode] = useState('');
  const [testName, setTestName] = useState('');
  const [testFile, setTestFile] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [topKContext, setTopKContext] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairState, setRepairState] = useState<RepairState>({
    jobId: null,
    status: 'idle',
    currentStep: 0,
    message: '',
    result: null,
  });
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    if (repairState.jobId && repairState.status === 'processing') {
      const interval = setInterval(async () => {
        try {
          const status = await getRepairStatus(repairState.jobId!);
          setRepairState(prev => ({
            ...prev,
            status: status.status,
            currentStep: status.current_step,
            message: status.message,
          }));

          if (status.status === 'completed') {
            const results = await getRepairResults(repairState.jobId!);
            setRepairState(prev => ({
              ...prev,
              result: results,
            }));
            clearInterval(interval);
          } else if (status.status === 'failed') {
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Failed to poll status:', err);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [repairState.jobId, repairState.status]);

  const handleRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testCode.trim()) {
      setError('Please enter test code');
      return;
    }

    setLoading(true);
    setError(null);
    setRepairState({
      jobId: null,
      status: 'processing',
      currentStep: 0,
      message: 'Starting repair...',
      result: null,
    });

    try {
      const job = await repairTest({
        test_code: testCode,
        test_name: testName || 'unknown_test',
        test_file: testFile || 'test.py',
        confidence_threshold: confidenceThreshold,
        top_k_context: topKContext,
      });

      setRepairState(prev => ({
        ...prev,
        jobId: job.job_id,
        status: job.status,
        message: job.message,
      }));
    } catch (err: any) {
      setError(err.message || 'Repair failed');
      setRepairState(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setLoading(false);
    }
  };

  const handleGetContext = async () => {
    if (!testCode.trim()) {
      setError('Please enter test code');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ctx = await getTestContext({
        test_code: testCode,
        top_k: topKContext,
      });
      setContext(ctx);
    } catch (err: any) {
      setError(err.message || 'Failed to get context');
    } finally {
      setLoading(false);
    }
  };

  const resetRepair = () => {
    setRepairState({
      jobId: null,
      status: 'idle',
      currentStep: 0,
      message: '',
      result: null,
    });
    setContext(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <Card title="GATR - Test Repair">
        <div className="space-y-4">
          <p className="text-[var(--color-text-muted)] text-sm mb-4">
            Paste your failing test code below to get AI-powered repair suggestions using RAG context.
          </p>

          <form onSubmit={handleRepair} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Test Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="test_function_name"
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Test File Path
                </label>
                <input
                  type="text"
                  value={testFile}
                  onChange={(e) => setTestFile(e.target.value)}
                  placeholder="tests/test_example.py"
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none placeholder:text-white/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Test Code (Paste your failing test)
              </label>
              <textarea
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder={`def test_example():\n    result = my_function(arg1, arg2)\n    assert result == expected_value`}
                className="w-full px-4 py-3 bg-[#0A0A0E] border border-white/10 text-emerald-400 rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] font-mono text-sm resize-y"
                rows={10}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <div>
                <label className="block text-xs font-bold text-[var(--color-accent)] mb-2 uppercase tracking-wider">
                  Confidence Threshold: {confidenceThreshold}
                </label>
                <input
                  type="range"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  min={0.1}
                  max={1}
                  step={0.1}
                  className="w-full accent-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-cyan)] mb-2 uppercase tracking-wider">
                  Top K Context: {topKContext}
                </label>
                <input
                  type="range"
                  value={topKContext}
                  onChange={(e) => setTopKContext(parseInt(e.target.value))}
                  min={1}
                  max={20}
                  step={1}
                  className="w-full accent-[var(--color-cyan)]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" loading={loading} disabled={repairState.status === 'processing'} className="gap-2">
                <Wrench className="w-4 h-4" /> Repair Test
              </Button>
              <Button type="button" onClick={handleGetContext} variant="secondary" disabled={loading} className="gap-2">
                <SearchCode className="w-4 h-4" /> Get Context Only
              </Button>
              {repairState.status !== 'idle' && (
                <div className="flex-1 text-right">
                  <Button type="button" onClick={resetRepair} variant="ghost">
                    Reset
                  </Button>
                </div>
              )}
            </div>
          </form>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>
      </Card>

      {repairState.status === 'processing' && (
        <Card title="Repair Progress">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Loader2 className="animate-spin text-[var(--color-cyan)] w-8 h-8" />
              <div>
                <div className="font-medium text-white">{repairState.message}</div>
                <div className="text-sm text-[var(--color-text-faint)] mt-1 tracking-wider uppercase">Step {repairState.currentStep}/9</div>
              </div>
            </div>
            <div className="w-full bg-black/50 rounded-full h-1.5 border border-white/5">
              <div
                className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-cyan)] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(repairState.currentStep / 9) * 100}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {context && (
        <Card title="Retrieved Context">
          <div className="space-y-4">
            <div className="text-sm text-[var(--color-cyan)] px-2 py-1 bg-[var(--color-cyan)]/10 rounded inline-block border border-[var(--color-cyan)]/20">
              Found {context.retrieved_entities?.length || 0} relevant entities
            </div>
            {context.code_snippets?.map((snippet: string, i: number) => (
              <pre key={i} className="text-xs bg-[#0A0A0E] border border-white/5 text-emerald-400 p-4 rounded-lg overflow-x-auto">
                {snippet}
              </pre>
            ))}
          </div>
        </Card>
      )}

      {repairState.result && (
        <Card title="Repair Results">
          <div className="space-y-6">
            {repairState.result.success ? (
              <>
                <div className="flex items-center gap-3 text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                  <span className="font-display font-bold text-xl tracking-wide">Repair Successful</span>
                  {repairState.result.confidence && (
                    <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded ml-2 font-mono">
                      {(repairState.result.confidence * 100).toFixed(1)}% confidence
                    </span>
                  )}
                </div>

                {repairState.result.explanation && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h5 className="font-bold text-blue-400 mb-2 uppercase tracking-wide text-xs">Explanation:</h5>
                    <p className="text-blue-100/80 text-sm leading-relaxed">{repairState.result.explanation}</p>
                  </div>
                )}

                {repairState.result.repaired_code && (
                  <div>
                    <h5 className="font-bold text-white mb-3 tracking-wide uppercase text-xs">Repaired Code:</h5>
                    <pre className="text-sm bg-[#0A0A0E] text-emerald-400 p-4 rounded-lg overflow-x-auto border border-emerald-500/20">
                      {repairState.result.repaired_code}
                    </pre>
                  </div>
                )}

                {repairState.result.original_code && repairState.result.repaired_code && (
                  <div className="border border-white/10 rounded-lg overflow-hidden relative">
                     <DiffViewer
                        original={repairState.result.original_code}
                        modified={repairState.result.repaired_code}
                      />
                  </div>
                )}

                {repairState.result.changes && repairState.result.changes.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h5 className="font-bold text-white mb-3 text-xs uppercase tracking-wider">Changes Made:</h5>
                    <ul className="list-disc list-inside text-sm text-[var(--color-text-muted)] space-y-1">
                      {repairState.result.changes.map((change: string, i: number) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 text-red-400">
                <XCircle className="w-8 h-8" />
                <span className="font-display font-bold text-xl tracking-wide">Repair Failed</span>
                {repairState.result.error && (
                  <span className="text-sm bg-red-500/10 border border-red-500/20 px-3 py-1 rounded ml-2 text-red-300">
                    {repairState.result.error}
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
