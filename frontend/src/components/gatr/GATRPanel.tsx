// GATR Test Repair Panel

import React, { useState, useEffect } from 'react';
import { repairTest, getGATRStatus, getTestContext } from '@/lib/api/gatr';
import Card from '../ui/Card';
import Button from '../ui/Button';
import DiffViewer from '../ui/DiffViewer';
import { Wrench, SearchCode, Loader2, CheckCircle2, XCircle, AlertTriangle, Server } from 'lucide-react';

interface RepairState {
  repairId: string | null;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  message: string;
  result: any;
}

interface GATREngineStatus {
  available: boolean;
  llm?: {
    available: boolean;
    model?: string;
    provider?: string;
    error?: string;
  };
  databases?: {
    kuzu?: { connected: boolean; entities?: number };
    lancedb?: { connected: boolean; embeddings?: number };
  };
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
        repairId: result.repair_id,
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
      {/* Engine Status Card */}
      {engineStatus && (
        <Card title="GATR Engine Status">
          <div className="flex flex-wrap gap-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${engineStatus.available ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              <Server className="w-4 h-4" />
              <span className="text-sm font-medium">
                Engine: {engineStatus.available ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${llmAvailable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <span className="text-sm font-medium">
                LLM: {llmAvailable ? `${engineStatus.llm?.model || 'Ready'}` : 'Not Available'}
              </span>
              {llmError && <span className="text-xs">({llmError})</span>}
            </div>
            {engineStatus.databases?.kuzu && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${engineStatus.databases.kuzu.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                <span className="text-sm font-medium">
                  KUZU: {engineStatus.databases.kuzu.connected ? `${engineStatus.databases.kuzu.entities || 0} entities` : 'Disconnected'}
                </span>
              </div>
            )}
            {engineStatus.databases?.lancedb && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${engineStatus.databases.lancedb.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                <span className="text-sm font-medium">
                  LanceDB: {engineStatus.databases.lancedb.connected ? `${engineStatus.databases.lancedb.embeddings || 0} embeddings` : 'Disconnected'}
                </span>
              </div>
            )}
          </div>
          {!llmAvailable && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">LLM Not Available</p>
                  <p className="text-sm text-amber-300/70 mt-1">
                    Test repair requires an LLM. Please start LM Studio or Ollama with the configured model.
                    Provider: {engineStatus.llm?.provider || 'lm_studio'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card title="GATR - Test Repair">
        <div className="space-y-4">
          <p className="text-[#B8E3E9] text-sm mb-4">
            Paste your failing test code and error message below to get AI-powered repair suggestions using RAG context.
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
                  className="w-full px-3 py-2 bg-[rgba(30,66,74,0.5)] border-2 border-[rgba(184,227,233,0.3)] text-[#E8F4F6] rounded-lg focus:ring-2 focus:ring-[#B8E3E9] focus:border-transparent outline-none placeholder:text-[rgba(147,177,181,0.6)]"
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
                  className="w-full px-3 py-2 bg-[rgba(30,66,74,0.5)] border-2 border-[rgba(184,227,233,0.3)] text-[#E8F4F6] rounded-lg focus:ring-2 focus:ring-[#B8E3E9] focus:border-transparent outline-none placeholder:text-[rgba(147,177,181,0.6)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Test Class (Optional)
              </label>
              <input
                type="text"
                value={testClass}
                onChange={(e) => setTestClass(e.target.value)}
                placeholder="TestClassName"
                className="w-full px-3 py-2 bg-[rgba(30,66,74,0.5)] border-2 border-[rgba(184,227,233,0.3)] text-[#E8F4F6] rounded-lg focus:ring-2 focus:ring-[#B8E3E9] focus:border-transparent outline-none placeholder:text-[rgba(147,177,181,0.6)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Test Code <span className="text-red-400">*</span>
              </label>
              <textarea
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder={`def test_example():\n    result = my_function(arg1, arg2)\n    assert result == expected_value`}
                className="w-full px-4 py-3 bg-[#0B2E33] border-2 border-[rgba(184,227,233,0.3)] text-emerald-400 rounded-xl focus:ring-2 focus:ring-[#B8E3E9] font-mono text-sm resize-y placeholder:text-[rgba(147,177,181,0.4)]"
                rows={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Error Message <span className="text-red-400">*</span>
                <span className="text-[#93B1B5] text-xs ml-2">(The failure output from running the test)</span>
              </label>
              <textarea
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder={`AssertionError: Expected 42 but got 0\n\nTraceback (most recent call last):\n  File "test_example.py", line 10, in test_example\n    assert result == 42`}
                className="w-full px-4 py-3 bg-[#0B2E33] border-2 border-[rgba(184,227,233,0.3)] text-red-400 rounded-xl focus:ring-2 focus:ring-[#B8E3E9] font-mono text-sm resize-y placeholder:text-[rgba(147,177,181,0.4)]"
                rows={5}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                loading={loading} 
                disabled={repairState.status === 'processing' || !engineStatus?.available} 
                className="gap-2"
              >
                <Wrench className="w-4 h-4" /> Repair Test
              </Button>
              <Button 
                type="button" 
                onClick={handleGetContext} 
                variant="secondary" 
                disabled={loading || !engineStatus?.available} 
                className="gap-2"
              >
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
        <Card title="Repair in Progress">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Loader2 className="animate-spin text-[#B8E3E9] w-8 h-8" />
              <div>
                <div className="font-medium text-white">{repairState.message}</div>
                <div className="text-sm text-[#93B1B5] mt-1">This may take a minute depending on LLM response time...</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {context && (
        <Card title="Retrieved Context">
          <div className="space-y-4">
            <div className="text-sm text-[#B8E3E9] px-2 py-1 bg-[rgba(184,227,233,0.1)] rounded inline-block border border-[rgba(184,227,233,0.2)]">
              Context retrieved successfully
            </div>
            
            {/* KG Entities */}
            {context.kg_entities && context.kg_entities.length > 0 && (
              <div>
                <h5 className="font-medium text-white mb-2">Knowledge Graph Entities ({context.kg_entities.length})</h5>
                <div className="space-y-2">
                  {context.kg_entities.slice(0, 5).map((entity: any, i: number) => (
                    <div key={i} className="bg-[rgba(30,66,74,0.5)] p-3 rounded-lg border border-[rgba(184,227,233,0.2)]">
                      <div className="font-medium text-[#B8E3E9]">{entity.name || entity.id}</div>
                      <div className="text-xs text-[#93B1B5]">{entity.type} • {entity.file}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vector Results */}
            {context.vector_results && context.vector_results.length > 0 && (
              <div>
                <h5 className="font-medium text-white mb-2">Vector Search Results ({context.vector_results.length})</h5>
                <div className="space-y-2">
                  {context.vector_results.slice(0, 5).map((result: any, i: number) => (
                    <div key={i} className="bg-[rgba(30,66,74,0.5)] p-3 rounded-lg border border-[rgba(184,227,233,0.2)]">
                      <div className="font-medium text-[#B8E3E9]">{result.name || result.id}</div>
                      <div className="text-xs text-[#93B1B5]">Score: {(result.score || result._distance || 0).toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compressed Context */}
            {context.compressed_context && (
              <div>
                <h5 className="font-medium text-white mb-2">Compressed Context</h5>
                <pre className="text-xs bg-[#0B2E33] border border-[rgba(184,227,233,0.2)] text-emerald-400 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {context.compressed_context}
                </pre>
              </div>
            )}

            {/* Raw code snippets fallback */}
            {context.code_snippets?.map((snippet: string, i: number) => (
              <pre key={i} className="text-xs bg-[#0B2E33] border border-[rgba(184,227,233,0.2)] text-emerald-400 p-4 rounded-lg overflow-x-auto">
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
                  {repairState.result.confidence != null && (
                    <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded ml-2 font-mono">
                      {(repairState.result.confidence * 100).toFixed(1)}% confidence
                    </span>
                  )}
                  {repairState.result.repair_strategy && (
                    <span className="text-xs bg-blue-500/20 border border-blue-500/30 px-2 py-1 rounded text-blue-400 font-mono">
                      {repairState.result.repair_strategy}
                    </span>
                  )}
                </div>

                {/* Repair Method Info */}
                {repairState.result.repair_method && (
                  <div className="bg-[rgba(30,66,74,0.5)] border border-[rgba(184,227,233,0.2)] rounded-lg p-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-[#93B1B5]">Method:</span>
                      <span className="text-white font-medium">{repairState.result.repair_method}</span>
                      {repairState.result.llm_used && (
                        <span className="text-xs bg-purple-500/20 border border-purple-500/30 px-2 py-1 rounded text-purple-400">
                          LLM Used
                        </span>
                      )}
                      {repairState.result.processing_time && (
                        <span className="text-[#93B1B5] ml-auto">
                          Processing time: {repairState.result.processing_time.toFixed(2)}s
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Context Summary */}
                {repairState.result.context_summary && (
                  <div className="bg-[rgba(30,66,74,0.5)] border border-[rgba(184,227,233,0.2)] rounded-lg p-4">
                    <h5 className="font-bold text-[#B8E3E9] mb-2 uppercase tracking-wide text-xs">Context Summary</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {Object.entries(repairState.result.context_summary).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-[#93B1B5]">{key.replace(/_/g, ' ')}: </span>
                          <span className="text-white">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repaired Code */}
                {repairState.result.repaired_code && (
                  <div>
                    <h5 className="font-bold text-white mb-3 tracking-wide uppercase text-xs">Repaired Code:</h5>
                    <pre className="text-sm bg-[#0B2E33] text-emerald-400 p-4 rounded-lg overflow-x-auto border border-emerald-500/20">
                      {repairState.result.repaired_code}
                    </pre>
                  </div>
                )}

                {/* Diff Content */}
                {repairState.result.diff_content && (
                  <div>
                    <h5 className="font-bold text-white mb-3 tracking-wide uppercase text-xs">Diff:</h5>
                    <div className="border border-[rgba(184,227,233,0.2)] rounded-lg overflow-hidden">
                      <DiffViewer
                        original={testCode}
                        modified={repairState.result.repaired_code || ''}
                      />
                    </div>
                  </div>
                )}

                {/* Pipeline Progress (debug info) */}
                {repairState.result.pipeline_progress && Object.keys(repairState.result.pipeline_progress).length > 0 && (
                  <div className="bg-[rgba(30,66,74,0.3)] p-4 rounded-lg border border-[rgba(184,227,233,0.1)]">
                    <h5 className="font-bold text-[#93B1B5] mb-3 text-xs uppercase tracking-wider">Pipeline Progress</h5>
                    <div className="space-y-2 text-sm">
                      {Object.entries(repairState.result.pipeline_progress).map(([step, info]: [string, any]) => (
                        <div key={step} className="flex justify-between items-center">
                          <span className="text-[#B8E3E9]">{step}</span>
                          <span className={`text-xs px-2 py-1 rounded ${info.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {info.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
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
