// GATR Test Repair Panel

import React, { useState, useEffect } from 'react';
import { repairTest, getRepairStatus, getRepairResults, getTestContext } from '@/lib/api/gatr';
import Card from '../ui/Card';
import Button from '../ui/Button';
import DiffViewer from '../ui/DiffViewer';

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

  // Poll for repair status
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
          <p className="text-gray-600 text-sm">
            Paste your failing test code below to get AI-powered repair suggestions using RAG context.
          </p>

          <form onSubmit={handleRepair} className="space-y-4">
            {/* Test Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="test_function_name"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test File Path
                </label>
                <input
                  type="text"
                  value={testFile}
                  onChange={(e) => setTestFile(e.target.value)}
                  placeholder="tests/test_example.py"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Test Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Code (Paste your failing test)
              </label>
              <textarea
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder={`def test_example():
    result = my_function(arg1, arg2)
    assert result == expected_value`}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent font-mono text-sm"
                rows={10}
              />
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confidence Threshold: {confidenceThreshold}
                </label>
                <input
                  type="range"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  min={0.1}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Top K Context: {topKContext}
                </label>
                <input
                  type="range"
                  value={topKContext}
                  onChange={(e) => setTopKContext(parseInt(e.target.value))}
                  min={1}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button type="submit" loading={loading} disabled={repairState.status === 'processing'}>
                🔧 Repair Test
              </Button>
              <Button type="button" onClick={handleGetContext} variant="secondary" disabled={loading}>
                📋 Get Context Only
              </Button>
              {repairState.status !== 'idle' && (
                <Button type="button" onClick={resetRepair} variant="outline">
                  Reset
                </Button>
              )}
            </div>
          </form>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Repair Progress */}
      {repairState.status === 'processing' && (
        <Card title="Repair Progress">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
              <div>
                <div className="font-medium">{repairState.message}</div>
                <div className="text-sm text-gray-500">Step {repairState.currentStep}/9</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all"
                style={{ width: `${(repairState.currentStep / 9) * 100}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Context Preview */}
      {context && (
        <Card title="Retrieved Context">
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Found {context.retrieved_entities?.length || 0} relevant entities
            </div>
            {context.code_snippets?.map((snippet: string, i: number) => (
              <pre key={i} className="text-xs bg-gray-800 text-green-400 p-3 rounded-lg overflow-x-auto">
                {snippet}
              </pre>
            ))}
          </div>
        </Card>
      )}

      {/* Repair Results */}
      {repairState.result && (
        <Card title="Repair Results">
          <div className="space-y-4">
            {repairState.result.success ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <span className="text-2xl">✅</span>
                  <span className="font-medium">Repair Successful</span>
                  {repairState.result.confidence && (
                    <span className="text-sm bg-green-100 px-2 py-1 rounded">
                      {(repairState.result.confidence * 100).toFixed(1)}% confidence
                    </span>
                  )}
                </div>

                {repairState.result.explanation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-medium text-blue-800 mb-2">Explanation:</h5>
                    <p className="text-blue-700 text-sm">{repairState.result.explanation}</p>
                  </div>
                )}

                {repairState.result.repaired_code && (
                  <div>
                    <h5 className="font-medium mb-2">Repaired Code:</h5>
                    <pre className="text-sm bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto">
                      {repairState.result.repaired_code}
                    </pre>
                  </div>
                )}

                {repairState.result.original_code && repairState.result.repaired_code && (
                  <DiffViewer
                    original={repairState.result.original_code}
                    modified={repairState.result.repaired_code}
                  />
                )}

                {repairState.result.changes && repairState.result.changes.length > 0 && (
                  <div>
                    <h5 className="font-medium mb-2">Changes Made:</h5>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {repairState.result.changes.map((change: string, i: number) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <span className="text-2xl">❌</span>
                <span className="font-medium">Repair Failed</span>
                {repairState.result.error && (
                  <span className="text-sm">{repairState.result.error}</span>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
