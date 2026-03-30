// Export Panel Component

import React, { useState } from 'react';
import { exportAsCSV, exportAsJSON, exportAsJSONL } from '@/lib/api/export';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { FileSpreadsheet, FileJson, FileText, CheckCircle2, XCircle, Info } from 'lucide-react';

export default function ExportPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'json' | 'jsonl') => {
    setLoading(format);
    setError(null);
    setSuccess(null);

    try {
      switch (format) {
        case 'csv':
          await exportAsCSV();
          break;
        case 'json':
          await exportAsJSON();
          break;
        case 'jsonl':
          await exportAsJSONL();
          break;
      }
      setSuccess(`Successfully exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || `Failed to export as ${format}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card title="Export Data">
      <div className="space-y-6">
        <p className="text-[var(--color-text-muted)] text-sm">
          Export your analysis results in various formats. Choose the format that best suits your needs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CSV Export */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-[var(--color-cyan)]/50 transition-all flex flex-col h-full group">
            <div className="text-4xl mb-4 bg-[var(--color-cyan)]/10 w-16 h-16 rounded-2xl flex items-center justify-center text-[var(--color-cyan)] group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-lg text-white mb-2 tracking-wide">CSV Format</h4>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">
              Comma-separated values. Best for spreadsheets and data analysis tools.
            </p>
            <Button
              onClick={() => handleExport('csv')}
              loading={loading === 'csv'}
              variant="secondary"
              className="w-full bg-black/40 hover:bg-white/10"
            >
              Download CSV
            </Button>
          </div>

          {/* JSON Export */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-[var(--color-accent)]/50 transition-all flex flex-col h-full group">
            <div className="text-4xl mb-4 bg-[var(--color-accent)]/10 w-16 h-16 rounded-2xl flex items-center justify-center text-[var(--color-accent)] group-hover:scale-110 transition-transform">
              <FileJson className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-lg text-white mb-2 tracking-wide">JSON Format</h4>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">
              Standard JSON with nested structure. Best for APIs and web applications.
            </p>
            <Button
              onClick={() => handleExport('json')}
              loading={loading === 'json'}
              variant="secondary"
              className="w-full bg-black/40 hover:bg-white/10"
            >
              Download JSON
            </Button>
          </div>

          {/* JSONL Export */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-emerald-500/50 transition-all flex flex-col h-full group">
            <div className="text-4xl mb-4 bg-emerald-500/10 w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-lg text-white mb-2 tracking-wide">JSONL Format</h4>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">
              JSON Lines (one object per line). Best for streaming and large datasets.
            </p>
            <Button
              onClick={() => handleExport('jsonl')}
              loading={loading === 'jsonl'}
              variant="secondary"
              className="w-full bg-black/40 hover:bg-white/10"
            >
              Download JSONL
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}
        
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> {success}
          </div>
        )}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-5">
          <h5 className="font-bold text-blue-400 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <Info className="w-4 h-4" /> What's included in exports:
          </h5>
          <ul className="text-sm text-blue-100/70 space-y-2 font-mono ml-6 list-disc marker:text-blue-500/50">
            <li>All extracted code entities (functions, classes, tests)</li>
            <li>Knowledge graph relationships</li>
            <li>Analysis metadata and timestamps</li>
            <li>Entity properties and source code references</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
