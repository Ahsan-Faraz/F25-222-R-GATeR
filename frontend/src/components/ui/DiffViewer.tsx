// Diff Viewer Component with Syntax Highlighting

import React from 'react';

interface DiffViewerProps {
  original: string;
  modified: string;
  originalLabel?: string;
  modifiedLabel?: string;
}

export default function DiffViewer({ 
  original, 
  modified, 
  originalLabel = 'Original Code',
  modifiedLabel = 'Modified Code'
}: DiffViewerProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-primary">Code Comparison</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-red-600 flex items-center gap-2">
            <span>❌</span> {originalLabel}
          </h5>
          <pre className="bg-red-950 text-red-200 p-4 rounded-lg overflow-x-auto text-sm max-h-80">
            <code>{original}</code>
          </pre>
        </div>
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-green-600 flex items-center gap-2">
            <span>✅</span> {modifiedLabel}
          </h5>
          <pre className="bg-green-950 text-green-200 p-4 rounded-lg overflow-x-auto text-sm max-h-80">
            <code>{modified}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
