// Export Panel Component - Minimalist-Futurism Design

import React, { useState, useRef, useEffect } from 'react';
import { exportAsCSV, exportAsJSON, exportAsJSONL } from '@/lib/api/export';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Download, ChevronDown, Check, AlertCircle, Info } from 'lucide-react';

export default function ExportPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'csv' | 'json' | 'jsonl') => {
    setLoading(format);
    setError(null);
    setSuccess(null);
    setIsDropdownOpen(false);

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
      setSuccess(`Exported as ${format.toUpperCase()}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || `Failed to export as ${format}`);
    } finally {
      setLoading(null);
    }
  };

  const formats = [
    { id: 'csv', label: 'CSV', description: 'Comma-separated values' },
    { id: 'json', label: 'JSON', description: 'Standard JSON structure' },
    { id: 'jsonl', label: 'JSONL', description: 'JSON Lines (streaming)' },
  ];

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-900/20 border border-green-500/30 text-green-400 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      <Card title="Export Data">
        <div className="space-y-6">
          <p className="text-sm text-text-secondary">
            Export your analysis results in various formats.
          </p>

          {/* Export Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              loading={!!loading}
              className="flex items-center gap-2"
              icon={<Download className="w-4 h-4" />}
            >
              Export
              <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-surface-elevated border border-border rounded-md overflow-hidden z-10 animate-fade-in">
                {formats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleExport(format.id as 'csv' | 'json' | 'jsonl')}
                    disabled={loading === format.id}
                    className="w-full px-4 py-3 text-left hover:bg-surface-hover transition-colors border-b border-border last:border-b-0"
                  >
                    <div className="text-sm font-medium text-text-primary">{format.label}</div>
                    <div className="text-xs text-text-muted">{format.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-surface-elevated border border-border rounded-md p-4">
            <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              Included in exports
            </h5>
            <ul className="text-sm text-text-secondary space-y-1.5 font-mono">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-accent rounded-full" />
                Code entities (functions, classes, tests)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-accent rounded-full" />
                Knowledge graph relationships
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-accent rounded-full" />
                Analysis metadata
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-accent rounded-full" />
                Source code references
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
