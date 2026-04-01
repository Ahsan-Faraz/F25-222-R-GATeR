// GATR Test Repair Panel - Minimalist-Futurism Design

import React, { useState, useEffect } from 'react';
import { repairTest, getGATRStatus, getTestContext, type GATREngineStatus } from '@/lib/api/gatr';
import Card from '../ui/Card';
import Button from '../ui/Button';
import DiffViewer from '../ui/DiffViewer';
import { Wrench, Search, Loader2, Check, X, AlertTriangle, Server, Database, Cpu, Clock, Zap } from 'lucide-react';

interface RepairState {
  repairId: string | null;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  message: string;
  result: any;
}

export default function GATRPanel() {
  const [testCode, setTestCode] = useState('');
  const [testName, setTestName] = useState('');
  const [testFile, setTestFile] = useState('');
  const [testClass, setTestClass] = useState('');
  const [errorMessage, setErrorMessage] = useState('');  // REQUIRED field
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<GATREngineStatus | null>(null);
  const [repairState, setRepairState] = useState<RepairState>({
    repairId: null,
    status: 'idle',
    message: '',
    result: null,
  });
  const [context, setContext] = useState<any>(null);

  // Fetch GATR engine status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await getGATRStatus();
        setEngineStatus(status);
      } catch (err) {
        console.error('Failed to fetch GATR status:', err);
        setEngineStatus({ available: false });
      }
    };
    fetchStatus();
  }, []);

  // Backend API is SYNCHRONOUS - no polling needed
  const handleRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testCode.trim()) {
      setError('Please enter test code');
      return;
    }
    if (!errorMessage.trim()) {
      setError('Please enter the error message from the failing test');
      return;
    }

    setLoading(true);
    setError(null);
    setRepairState({
      repairId: null,
      status: 'processing',
      message: 'Sending repair request...',
      result: null,
    });

    try {
      // Repair is SYNCHRONOUS - result comes back immediately
      const result = await repairTest({
        test_code: testCode,
        test_name: testName || 'unknown_test',
        test_file: testFile || '',
        test_class: testClass || '',
        error_message: errorMessage,
        include_debug_trace: true,
      });

      setRepairState({
        repairId: result.repair_id ?? null,
        status: result.success ? 'completed' : 'failed',
        message: result.success ? 'Repair completed!' : (result.error || 'Repair failed'),
        result: result,
      });
    } catch (err: any) {
      setError(err.message || 'Repair failed');
      setRepairState(prev => ({ ...prev, status: 'failed', message: err.message }));
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
        test_name: testName || 'unknown_test',
        error_message: errorMessage || 'Test failure',
        test_file: testFile,
        test_class: testClass,
      });
      setContext(ctx.context || ctx);
    } catch (err: any) {
      setError(err.message || 'Failed to get context');
    } finally {
      setLoading(false);
    }
  };

  const resetRepair = () => {
    setRepairState({
      repairId: null,
      status: 'idle',
      message: '',
      result: null,
    });
    setContext(null);
    setError(null);
  };

  const llmAvailable = engineStatus?.llm?.available;
  const llmError = engineStatus?.llm?.error;

  return (
    <div className="space-y-6">
      {/* Engine Status */}
      {engineStatus && (
        <div className="stat-ribbon">
          <div className="stat-item">
            <span className={`inline-flex items-center gap-1.5 ${engineStatus.available ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${engineStatus.available ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="stat-value">{engineStatus.available ? 'Online' : 'Offline'}</span>
            </span>
            <span className="stat-label">Engine</span>
          </div>
          <div className="stat-item">
            <span className={`stat-value ${llmAvailable ? 'text-green-400' : 'text-amber-400'}`}>
              {llmAvailable ? (engineStatus.llm?.model || 'Ready') : 'N/A'}
            </span>
            <span className="stat-label">LLM</span>
          </div>
          {engineStatus.databases?.kuzu && (
            <div className="stat-item">
              <span className="stat-value">{engineStatus.databases.kuzu.entities || 0}</span>
              <span className="stat-label">KG Entities</span>
            </div>
          )}
          {engineStatus.databases?.lancedb && (
            <div className="stat-item">
              <span className="stat-value">{engineStatus.databases.lancedb.embeddings || 0}</span>
              <span className="stat-label">Vectors</span>
            </div>
          )}
        </div>
      )}

      {/* LLM Warning */}
      {!llmAvailable && engineStatus && (
        <div className="bg-amber-900/20 border border-amber-500/30 text-amber-400 rounded-md px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">LLM Not Available</p>
            <p className="text-xs text-amber-300/70 mt-1">
              Test repair requires an LLM. Start LM Studio or Ollama with the configured model.
              Provider: {engineStatus.llm?.provider || 'lm_studio'}
            </p>
          </div>
        </div>
      )}

      <Card title="Test Repair">
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">
            Paste your failing test code and error message to get AI-powered repair suggestions.
          </p>

          <form onSubmit={handleRepair} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Test Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="test_function_name"
                  className="ghost-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Test File Path
                </label>
                <input
                  type="text"
                  value={testFile}
                  onChange={(e) => setTestFile(e.target.value)}
                  placeholder="tests/test_example.py"
                  className="ghost-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Test Class <span className="text-text-muted">(Optional)</span>
              </label>
              <input
                type="text"
                value={testClass}
                onChange={(e) => setTestClass(e.target.value)}
                placeholder="TestClassName"
                className="ghost-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Test Code <span className="text-red-400">*</span>
              </label>
              <textarea
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder={`def test_example():\n    result = my_function(arg1, arg2)\n    assert result == expected_value`}
                className="ghost-input w-full font-mono text-sm text-green-400"
                rows={8}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Error Message <span className="text-red-400">*</span>
              </label>
              <textarea
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder={`AssertionError: Expected 42 but got 0`}
                className="ghost-input w-full font-mono text-sm text-red-400"
                rows={4}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                type="submit" 
                loading={loading} 
                disabled={repairState.status === 'processing' || !engineStatus?.available}
                icon={<Wrench className="w-4 h-4" />}
              >
                Repair Test
              </Button>
              <Button 
                type="button" 
                onClick={handleGetContext} 
                variant="ghost" 
                disabled={loading || !engineStatus?.available}
                icon={<Search className="w-4 h-4" />}
              >
                Get Context Only
              </Button>
              {repairState.status !== 'idle' && (
                <Button type="button" onClick={resetRepair} variant="ghost" className="ml-auto">
                  Reset
                </Button>
              )}
            </div>
          </form>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Processing */}
      {repairState.status === 'processing' && (
        <Card title="Processing">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <div>
              <div className="font-medium text-text-primary">{repairState.message}</div>
              <div className="text-sm text-text-muted mt-1">This may take a minute...</div>
            </div>
          </div>
        </Card>
      )}

      {/* Context */}
      {context && (
        <Card title="Retrieved Context">
          <div className="space-y-4">
            {context.kg_entities && context.kg_entities.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Knowledge Graph Entities ({context.kg_entities.length})
                </h5>
                <div className="space-y-2">
                  {context.kg_entities.slice(0, 5).map((entity: any, i: number) => (
                    <div key={i} className="bg-surface-elevated border border-border rounded-md p-3">
                      <div className="font-mono text-sm text-text-primary">{entity.name || entity.id}</div>
                      <div className="text-xs text-text-muted mt-1">{entity.type} • {entity.file}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {context.vector_results && context.vector_results.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Vector Results ({context.vector_results.length})
                </h5>
                <div className="space-y-2">
                  {context.vector_results.slice(0, 5).map((result: any, i: number) => (
                    <div key={i} className="bg-surface-elevated border border-border rounded-md p-3">
                      <div className="font-mono text-sm text-text-primary">{result.name || result.id}</div>
                      <div className="text-xs text-text-muted mt-1">Score: {(result.score || result._distance || 0).toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {context.compressed_context && (
              <div>
                <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Compressed Context
                </h5>
                <pre className="text-xs bg-bg border border-border text-green-400 p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
                  {context.compressed_context}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Results */}
      {repairState.result && (
        <Card title="Repair Results">
          <div className="space-y-6">
            {repairState.result.success ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-900/30 border border-green-500/30 rounded-md flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-text-primary">Repair Successful</span>
                    <div className="flex gap-2 mt-1">
                      {repairState.result.confidence != null && (
                        <span className="text-xs bg-green-900/30 border border-green-500/30 text-green-400 px-2 py-0.5 rounded font-mono">
                          {(repairState.result.confidence * 100).toFixed(1)}%
                        </span>
                      )}
                      {repairState.result.repair_strategy && (
                        <span className="text-xs bg-accent/20 border border-accent/30 text-accent px-2 py-0.5 rounded font-mono">
                          {repairState.result.repair_strategy}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                {repairState.result.repair_method && (
                  <div className="stat-ribbon">
                    <div className="stat-item">
                      <span className="stat-value">{repairState.result.repair_method}</span>
                      <span className="stat-label">Method</span>
                    </div>
                    {repairState.result.llm_used && (
                      <div className="stat-item">
                        <span className="stat-value text-purple-400">Yes</span>
                        <span className="stat-label">LLM Used</span>
                      </div>
                    )}
                    {repairState.result.processing_time && (
                      <div className="stat-item">
                        <span className="stat-value">{repairState.result.processing_time.toFixed(2)}s</span>
                        <span className="stat-label">Time</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Repaired Code */}
                {repairState.result.repaired_code && (
                  <div>
                    <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                      Repaired Code
                    </h5>
                    <pre className="text-sm bg-bg text-green-400 p-4 rounded-md overflow-x-auto border border-green-500/20 font-mono">
                      {repairState.result.repaired_code}
                    </pre>
                  </div>
                )}

                {/* Diff */}
                {repairState.result.diff_content && (
                  <div>
                    <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                      Changes
                    </h5>
                    <div className="border border-border rounded-md overflow-hidden">
                      <DiffViewer
                        original={testCode}
                        modified={repairState.result.repaired_code || ''}
                      />
                    </div>
                  </div>
                )}

                {/* Pipeline Progress */}
                {repairState.result.pipeline_progress && Object.keys(repairState.result.pipeline_progress).length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                      Pipeline
                    </h5>
                    <div className="space-y-1">
                      {Object.entries(repairState.result.pipeline_progress).map(([step, info]: [string, any]) => (
                        <div key={step} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                          <span className="text-sm text-text-secondary">{step}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${info.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            {info.success ? 'Done' : 'Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-900/30 border border-red-500/30 rounded-md flex items-center justify-center">
                  <X className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <span className="font-semibold text-text-primary">Repair Failed</span>
                  {repairState.result.error && (
                    <p className="text-sm text-red-400 mt-1">{repairState.result.error}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
