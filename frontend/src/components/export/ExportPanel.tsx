// Export Panel Component

import React, { useState } from 'react';
import { exportAsCSV, exportAsJSON, exportAsJSONL } from '@/lib/api/export';
import Card from '../ui/Card';
import Button from '../ui/Button';

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
        <p className="text-gray-600">
          Export your analysis results in various formats. Choose the format that best suits your needs.
        </p>

        {/* Export Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CSV Export */}
          <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-accent transition-colors">
            <div className="text-4xl mb-4">📊</div>
            <h4 className="font-bold text-lg text-primary mb-2">CSV Format</h4>
            <p className="text-sm text-gray-600 mb-4">
              Comma-separated values. Best for spreadsheets and data analysis tools.
            </p>
            <Button
              onClick={() => handleExport('csv')}
              loading={loading === 'csv'}
              variant="secondary"
              className="w-full"
            >
              Download CSV
            </Button>
          </div>

          {/* JSON Export */}
          <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-accent transition-colors">
            <div className="text-4xl mb-4">📝</div>
            <h4 className="font-bold text-lg text-primary mb-2">JSON Format</h4>
            <p className="text-sm text-gray-600 mb-4">
              Standard JSON with nested structure. Best for APIs and web applications.
            </p>
            <Button
              onClick={() => handleExport('json')}
              loading={loading === 'json'}
              variant="secondary"
              className="w-full"
            >
              Download JSON
            </Button>
          </div>

          {/* JSONL Export */}
          <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-accent transition-colors">
            <div className="text-4xl mb-4">📋</div>
            <h4 className="font-bold text-lg text-primary mb-2">JSONL Format</h4>
            <p className="text-sm text-gray-600 mb-4">
              JSON Lines (one object per line). Best for streaming and large datasets.
            </p>
            <Button
              onClick={() => handleExport('jsonl')}
              loading={loading === 'jsonl'}
              variant="secondary"
              className="w-full"
            >
              Download JSONL
            </Button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            ❌ {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4">
            ✅ {success}
          </div>
        )}

        {/* Export Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="font-medium text-blue-800 mb-2">What's included in exports:</h5>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• All extracted code entities (functions, classes, tests)</li>
            <li>• Knowledge graph relationships</li>
            <li>• Analysis metadata and timestamps</li>
            <li>• Entity properties and source code references</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
