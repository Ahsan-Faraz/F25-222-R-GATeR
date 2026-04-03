// Stitch screen `79e779870a344d769ec7f6aa99fd8a1e` — Export & PR Integration

import React, { useState } from 'react';
import { exportAsCSV, exportAsJSON, exportAsJSONL } from '@/lib/api/export';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { Check, AlertCircle } from 'lucide-react';

type Format = 'json' | 'csv' | 'jsonl';

export default function ExportPanel() {
  const [loading, setLoading] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<Format>('json');
  const [includeMeta, setIncludeMeta] = useState(true);
  const [anonymize, setAnonymize] = useState(false);

  const handleExport = async () => {
    setLoading(selectedFormat);
    setError(null);
    setSuccess(null);
    try {
      const fn =
        selectedFormat === 'csv'
          ? exportAsCSV
          : selectedFormat === 'jsonl'
            ? exportAsJSONL
            : exportAsJSON;
      await fn();
      setSuccess(`Exported as ${selectedFormat.toUpperCase()}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container/15 px-4 py-3 text-sm text-on-error-container flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-on-surface flex items-center gap-2">
          <Check className="w-4 h-4 text-primary shrink-0" />
          {success}
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-2">
          Export Center
        </h2>
        <p className="text-on-surface-variant max-w-xl text-sm leading-relaxed">
          Generate snapshots of graph topology, vectors, and analysis metadata. Same backend export APIs.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-8">
          <section className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden border border-outline-variant/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
            <h3 className="text-sm font-mono text-primary uppercase tracking-[0.3em] mb-8">01. Output Configuration</h3>
            <div className="space-y-10">
              <div className="space-y-4">
                <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {(
                    [
                      { id: 'json' as const, icon: 'data_object', label: 'JSON' },
                      { id: 'csv' as const, icon: 'table_rows', label: 'CSV' },
                      { id: 'jsonl' as const, icon: 'view_list', label: 'JSONL' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFormat(f.id)}
                      className={`flex flex-col items-center gap-3 p-6 rounded-lg border transition-all ${
                        selectedFormat === f.id
                          ? 'bg-surface-container-highest border-primary text-primary'
                          : 'bg-surface-container border-outline-variant/20 hover:bg-surface-container-highest'
                      }`}
                    >
                      <MaterialIcon name={f.icon} className="!text-3xl" />
                      <span className="font-mono text-sm">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest">
                  Metadata Controls
                </label>
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container/50 border border-outline-variant/10">
                  <div className="flex items-center gap-4">
                    <MaterialIcon name="info" className="text-primary" />
                    <div>
                      <p className="text-sm font-medium text-on-surface">Include Graph Metadata</p>
                      <p className="text-xs text-on-surface-variant">Schema and timestamps when supported by the API.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeMeta}
                    onClick={() => setIncludeMeta((v) => !v)}
                    className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${
                      includeMeta ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 bg-on-primary rounded-full transition-transform ${
                        includeMeta ? 'ml-auto' : ''
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container/50 border border-outline-variant/10">
                  <div className="flex items-center gap-4">
                    <MaterialIcon name="fingerprint" className="text-on-surface-variant" />
                    <div>
                      <p className="text-sm font-medium text-on-surface">Anonymize identifiers</p>
                      <p className="text-xs text-on-surface-variant">UI preference — backend may ignore if unsupported.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={anonymize}
                    onClick={() => setAnonymize((v) => !v)}
                    className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${
                      anonymize ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full transition-transform ${
                        anonymize ? 'bg-on-primary ml-auto' : 'bg-on-surface-variant/50'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={!!loading}
                className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? (
                  <span className="text-sm font-mono">Exporting…</span>
                ) : (
                  <>
                    <MaterialIcon name="download" />
                    GENERATE EXPORT PACKAGE
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/5">
            <h3 className="text-sm font-mono text-secondary uppercase tracking-[0.3em] mb-6">02. Repository Integration</h3>
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center border border-secondary/20 shrink-0">
                <MaterialIcon name="alt_route" className="text-3xl text-secondary" />
              </div>
              <div className="space-y-4 min-w-0">
                <div>
                  <h4 className="text-xl font-bold font-headline text-on-surface">Pull Request workflow</h4>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Export packages can be attached to a PR from your CI or GitHub Actions workflow.
                  </p>
                </div>
                <div className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded border border-outline-variant/10 font-mono text-xs">
                  <span className="text-secondary">main</span>
                  <span className="text-on-surface-variant/50">→</span>
                  <span className="text-primary">feature/kg-export</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <section className="bg-surface-container-lowest h-full min-h-[320px] border border-outline-variant/10 rounded-xl flex flex-col">
            <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-on-surface-variant">Export History</h3>
              <span className="text-[10px] font-mono text-on-surface-variant/60">SESSION</span>
            </div>
            <div className="p-6 text-sm text-on-surface-variant">
              <p className="leading-relaxed">
                Browser downloads are not listed here. Use your downloads folder for generated{' '}
                <span className="font-mono text-primary">.json</span>, <span className="font-mono text-primary">.csv</span>, or{' '}
                <span className="font-mono text-primary">.jsonl</span> files.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
