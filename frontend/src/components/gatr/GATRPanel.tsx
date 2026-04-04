// Stitch screen `1c1c09567db14e808d96748bba31c9bf` — Test Repair View (API logic unchanged)

import React, { useState, useEffect } from 'react';
import { repairTest, getGATRStatus, getTestContext, type GATREngineStatus } from '@/lib/api/gatr';
import Button from '../ui/Button';
import DiffViewer from '../ui/DiffViewer';
import MaterialIcon from '../ui/MaterialIcon';
import { Loader2, X, AlertTriangle } from 'lucide-react';

interface RepairState {
  repairId: string | null;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  message: string;
  result: any;
}

type StepKey = 'input' | 'retrieval' | 'llm' | 'review';

function stepActive(s: StepKey, repairState: RepairState, hasContext: boolean): 'done' | 'active' | 'pending' {
  if (repairState.status === 'processing') {
    if (s === 'input') return 'done';
    if (s === 'retrieval') return 'active';
    return 'pending';
  }
  if (repairState.status === 'completed' || repairState.status === 'failed') {
    if (s === 'review') return repairState.status === 'completed' ? 'done' : 'active';
    if (s === 'llm') return 'done';
    if (s === 'retrieval') return 'done';
    if (s === 'input') return 'done';
  }
  if (hasContext && repairState.status === 'idle') {
    if (s === 'input') return 'done';
    if (s === 'retrieval') return 'done';
    if (s === 'llm') return 'pending';
    return 'pending';
  }
  if (s === 'input') return 'active';
  return 'pending';
}

export default function GATRPanel() {
  const [testCode, setTestCode] = useState('');
  const [testName, setTestName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
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
      const result = await repairTest({
        test_code: testCode,
        error_message: errorMessage,
        // Only send test_name if provided
        ...(testName && { test_name: testName }),
      });

      const errMsg =
        typeof result.error === 'string' ? result.error : result.error != null ? String(result.error) : 'Repair failed';
      setRepairState({
        repairId: typeof result.repair_id === 'string' ? result.repair_id : null,
        status: result.success ? 'completed' : 'failed',
        message: result.success ? 'Repair completed!' : errMsg,
        result: result,
      });
    } catch (err: any) {
      setError(err.message || 'Repair failed');
      setRepairState((prev) => ({ ...prev, status: 'failed', message: err.message }));
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
  const hasContext = !!context;
  const conf = repairState.result?.confidence != null ? Number(repairState.result.confidence) : null;

  const steps: { key: StepKey; label: string; icon: string }[] = [
    { key: 'input', label: 'Input', icon: 'data_object' },
    { key: 'retrieval', label: 'Retrieval', icon: 'search_insights' },
    { key: 'llm', label: 'LLM Inference', icon: 'auto_awesome' },
    { key: 'review', label: 'Review Diff', icon: 'difference' },
  ];

  const kgEntities = context?.kg_entities?.slice(0, 4) || [];
  const vecHint =
    context?.vector_results?.[0]?.score ?? context?.vector_results?.[0]?._distance;

  return (
    <form id="gatr-repair-form" onSubmit={handleRepair} className="space-y-8 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-2 font-semibold">
            <span>Pipelines</span>
            <MaterialIcon name="chevron_right" className="!text-[12px]" />
            <span className="text-primary">Repair Agent</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">Test Repair View</h1>
          {engineStatus && (
            <p className="text-[11px] font-mono text-on-surface-variant mt-2">
              Engine {engineStatus.available ? 'online' : 'offline'}
              {engineStatus.llm?.model ? ` · ${engineStatus.llm.model}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={resetRepair}
            className="px-4 py-2 bg-surface-container-high border border-outline-variant/20 rounded-lg text-sm font-medium hover:bg-surface-container-highest transition-colors flex items-center gap-2"
          >
            <MaterialIcon name="history" className="!text-[18px]" />
            Reset
          </button>
          <button
            type="submit"
            disabled={loading || repairState.status === 'processing' || !engineStatus?.available}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/10 hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading || repairState.status === 'processing' ? (
              <Loader2 className="w-[18px] h-[18px] animate-spin" />
            ) : (
              <MaterialIcon name="play_arrow" className="!text-[18px]" />
            )}
            Run Repair
          </button>
        </div>
      </header>

      {!llmAvailable && engineStatus && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-900/15 px-4 py-3 flex items-start gap-3 text-amber-200 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">LLM not available</p>
            <p className="text-xs text-amber-200/80 mt-1">
              Start Ollama or LM Studio. Provider: {engineStatus.llm?.provider || 'lm_studio'}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-2 relative px-2 overflow-x-auto pb-2">
        <div className="absolute top-1/2 left-0 w-full h-px bg-outline-variant/20 -z-10 pointer-events-none" />
        {steps.map((s) => {
          const st = stepActive(s.key, repairState, hasContext);
          const dim = st === 'pending';
          return (
            <div key={s.key} className="flex flex-col items-center gap-2 bg-[#131315] px-3 shrink-0">
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                  st === 'done'
                    ? 'border-primary bg-primary/10 text-primary'
                    : st === 'active'
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <MaterialIcon name={s.icon} className="!text-[20px]" />
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                  dim ? 'text-on-surface-variant' : 'text-on-surface'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <section className="bg-surface-container-low rounded-lg border border-outline-variant/10 overflow-hidden">
            <div className="px-4 py-3 bg-surface-container flex justify-between items-center border-b border-outline-variant/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <MaterialIcon name="account_tree" className="!text-[16px]" />
                Retrieval Context
              </h3>
              <span className="text-[10px] font-mono text-on-surface-variant">
                {kgEntities.length} nodes
              </span>
            </div>
            <div className="p-4 space-y-4">
              {kgEntities.length === 0 && !hasContext && (
                <p className="text-[11px] text-on-surface-variant">
                  Run <span className="text-primary font-mono">Get context</span> after entering test code to load KG
                  entities.
                </p>
              )}
              {kgEntities.map((entity: any, i: number) => (
                <div
                  key={i}
                  className={`p-3 bg-surface-container-highest rounded border ${
                    i === 0 ? 'border-primary/20' : 'border-outline-variant/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-bold font-mono">
                      {(entity.type || 'NODE').toString().toUpperCase().slice(0, 8)}
                    </span>
                    <span className="text-xs font-mono font-medium text-on-surface truncate">
                      {entity.name || entity.id}
                    </span>
                  </div>
                  {entity.file && (
                    <p className="text-[10px] text-on-surface-variant font-mono truncate">{entity.file}</p>
                  )}
                </div>
              ))}

              <div className="relative h-36 mt-2 rounded bg-[#0e0e0f] overflow-hidden border border-outline-variant/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 bg-surface/80 px-3 py-1 rounded-full backdrop-blur-sm">
                    Live KG Explorer
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Vector Similarity</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-on-surface-variant">Top match</span>
                <span className="text-primary">{vecHint != null ? Number(vecHint).toFixed(4) : '—'}</span>
              </div>
              <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary transition-all"
                  style={{ width: `${Math.min(100, (vecHint != null ? Number(vecHint) : 0) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-on-surface-variant italic leading-snug">
                {hasContext
                  ? 'Context retrieved via hybrid search and graph entities.'
                  : 'Context appears after loading retrieval.'}
              </p>
            </div>
          </section>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleGetContext}
              disabled={loading || !engineStatus?.available}
              className="w-full py-2.5 border border-outline-variant/30 rounded-lg text-sm font-medium hover:bg-surface-container-low transition-colors"
            >
              Get context only
            </button>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          <section className="bg-surface-container-low rounded-lg border border-error/20 overflow-hidden">
            <div className="px-4 py-3 bg-error-container/10 flex justify-between items-center border-b border-error/10 flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-error flex items-center gap-2">
                <MaterialIcon name="bug_report" className="!text-[16px]" />
                Broken Test Input
              </h3>
              <div className="flex gap-2 text-[10px] font-mono text-error/70">
                <span>Auto-extracts class & file from code</span>
              </div>
            </div>
            <div className="p-4 space-y-4 bg-[#0e0e0f]">
              {/* Test Name - Optional */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/50">
                  Test Name <span className="text-on-surface-variant/40">(optional - auto-extracted)</span>
                </label>
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Leave empty to auto-extract from code"
                  className="ghost-input bg-surface-container-lowest font-mono w-full text-on-surface-variant/60"
                />
              </div>

              {/* Test Code */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
                  Broken Test Code <span className="text-error">*</span>
                </label>
                <textarea
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  placeholder="Paste failing test code here..."
                  rows={10}
                  className="w-full font-mono text-[13px] leading-relaxed p-4 rounded border border-outline-variant/20 bg-[#0e0e0f] text-on-surface-variant resize-y min-h-[200px] focus:outline-none focus:border-primary/40"
                />
                <p className="text-[10px] text-on-surface-variant/50 font-mono">
                  💡 Tip: Include the full test method (def test_foo or @Test public void testFoo)
                </p>
              </div>

              {/* Error Message */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-error/70">
                  Error Message / Assertion <span className="text-error">*</span>
                </label>
                <textarea
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  placeholder="Paste the assertion error or traceback here..."
                  rows={4}
                  className="w-full font-mono text-[12px] p-3 rounded border border-error/20 bg-error-container/5 text-error/90 resize-y focus:outline-none"
                />
              </div>
            </div>
          </section>

          <div className="flex justify-center -my-2 relative z-10">
            <div className="bg-surface border border-outline-variant/20 p-2 rounded-full shadow-lg">
              <MaterialIcon name="keyboard_double_arrow_down" className="text-primary !text-[20px]" />
            </div>
          </div>

          {repairState.status === 'processing' && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-outline-variant/15 bg-surface-container-low">
              <Loader2 className="w-6 h-6 text-primary animate-spin shrink-0" />
              <p className="text-sm text-on-surface-variant">{repairState.message}</p>
            </div>
          )}

          {repairState.result?.success && (
            <section className="bg-surface-container-low rounded-lg border border-primary/20 overflow-hidden shadow-2xl shadow-primary/5">
              <div className="px-4 py-3 bg-primary-container/10 flex justify-between items-center border-b border-primary/10 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <MaterialIcon name="verified" className="!text-[16px]" />
                    Repaired Output
                  </h3>
                  <div className="h-4 w-px bg-outline-variant/20 hidden sm:block" />
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    Confidence: {conf != null ? `${(conf * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
              {repairState.result.repaired_code && (
                <pre className="font-mono text-[13px] p-4 overflow-x-auto text-on-surface-variant bg-[#0e0e0f] border-b border-outline-variant/10 whitespace-pre-wrap">
                  {repairState.result.repaired_code}
                </pre>
              )}
              {repairState.result.diff_content && testCode && (
                <div className="p-4 border-t border-outline-variant/10">
                  <p className="text-[10px] font-mono uppercase text-on-surface-variant mb-2">Diff</p>
                  <div className="border border-outline-variant/10 rounded overflow-hidden">
                    <DiffViewer original={testCode} modified={repairState.result.repaired_code || ''} />
                  </div>
                </div>
              )}
              {repairState.result.repair_strategy && (
                <div className="m-4 p-4 bg-surface-container-highest border border-primary/10 rounded flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MaterialIcon name="info" className="text-primary !text-[18px]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface mb-1 uppercase tracking-wider">Reasoning</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Strategy: <code className="bg-[#0e0e0f] px-1 rounded text-tertiary">{repairState.result.repair_strategy}</code>
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {repairState.result && !repairState.result.success && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-error/30 bg-error-container/10">
              <X className="w-6 h-6 text-error shrink-0" />
              <div>
                <p className="font-semibold text-on-surface">Repair failed</p>
                <p className="text-sm text-error/90 mt-1">{repairState.result.error || repairState.message}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-error border border-error/30 rounded-lg px-4 py-3 bg-error-container/10">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4 pt-2">
            <Button type="button" variant="ghost" onClick={resetRepair}>
              Regenerate
            </Button>
            <Button type="submit" loading={loading} disabled={!engineStatus?.available}>
              Run repair
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
