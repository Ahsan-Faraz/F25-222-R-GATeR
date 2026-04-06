// Unified Diff Viewer Component with Line-by-Line Changes

import React, { useMemo } from 'react';

interface DiffViewerProps {
  original: string;
  modified: string;
  originalLabel?: string;
  modifiedLabel?: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber?: number;
}

function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // Use LCS (Longest Common Subsequence) for better diff
  const lcs = computeLCS(originalLines, modifiedLines);
  const diff: DiffLine[] = [];
  
  let i = 0; // Index in original
  let j = 0; // Index in modified
  let lcsIndex = 0; // Index in LCS
  
  while (i < originalLines.length || j < modifiedLines.length) {
    // Check if current lines are in LCS (unchanged)
    if (lcsIndex < lcs.length && 
        i < originalLines.length && 
        j < modifiedLines.length &&
        originalLines[i] === lcs[lcsIndex] && 
        modifiedLines[j] === lcs[lcsIndex]) {
      // Unchanged line
      diff.push({ 
        type: 'unchanged', 
        content: originalLines[i], 
        lineNumber: i + 1 
      });
      i++;
      j++;
      lcsIndex++;
    } else if (lcsIndex < lcs.length && 
               j < modifiedLines.length && 
               modifiedLines[j] === lcs[lcsIndex]) {
      // Line was removed from original
      diff.push({ 
        type: 'remove', 
        content: originalLines[i], 
        lineNumber: i + 1 
      });
      i++;
    } else if (lcsIndex < lcs.length && 
               i < originalLines.length && 
               originalLines[i] === lcs[lcsIndex]) {
      // Line was added to modified
      diff.push({ 
        type: 'add', 
        content: modifiedLines[j], 
        lineNumber: j + 1 
      });
      j++;
    } else if (i < originalLines.length && j < modifiedLines.length) {
      // Both lines changed - show as remove + add
      diff.push({ 
        type: 'remove', 
        content: originalLines[i], 
        lineNumber: i + 1 
      });
      diff.push({ 
        type: 'add', 
        content: modifiedLines[j], 
        lineNumber: j + 1 
      });
      i++;
      j++;
    } else if (i < originalLines.length) {
      // Only original lines left (removed)
      diff.push({ 
        type: 'remove', 
        content: originalLines[i], 
        lineNumber: i + 1 
      });
      i++;
    } else if (j < modifiedLines.length) {
      // Only modified lines left (added)
      diff.push({ 
        type: 'add', 
        content: modifiedLines[j], 
        lineNumber: j + 1 
      });
      j++;
    }
  }
  
  return diff;
}

function computeLCS(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  
  // Create DP table
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

export default function DiffViewer({ 
  original, 
  modified, 
  originalLabel = 'Original Code',
  modifiedLabel = 'Modified Code'
}: DiffViewerProps) {
  const diffLines = useMemo(() => computeDiff(original, modified), [original, modified]);
  
  // Count changes
  const additions = diffLines.filter(l => l.type === 'add').length;
  const deletions = diffLines.filter(l => l.type === 'remove').length;
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-on-surface text-sm">Unified Diff</h4>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-green-400">+{additions} additions</span>
          <span className="text-red-400">-{deletions} deletions</span>
        </div>
      </div>
      
      <div className="bg-[#0e0e0f] rounded-lg border border-outline-variant/10 overflow-hidden">
        <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant/10 text-xs font-mono text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="text-red-400">--- {originalLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">+++ {modifiedLabel}</span>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full font-mono text-xs border-collapse">
            <tbody>
              {diffLines.map((line, idx) => {
                const bgColor = 
                  line.type === 'add' ? 'bg-green-900/20' :
                  line.type === 'remove' ? 'bg-red-900/20' :
                  'bg-transparent';
                
                const textColor = 
                  line.type === 'add' ? 'text-green-300' :
                  line.type === 'remove' ? 'text-red-300' :
                  'text-on-surface-variant';
                
                const prefix = 
                  line.type === 'add' ? '+' :
                  line.type === 'remove' ? '-' :
                  ' ';
                
                const prefixColor =
                  line.type === 'add' ? 'text-green-400' :
                  line.type === 'remove' ? 'text-red-400' :
                  'text-on-surface-variant/30';
                
                return (
                  <tr key={idx} className={`${bgColor} hover:bg-surface-container-low/50 transition-colors`}>
                    <td className="px-3 py-1 text-right text-on-surface-variant/40 select-none w-12 border-r border-outline-variant/10 align-top">
                      {line.lineNumber || ''}
                    </td>
                    <td className={`px-2 py-1 ${prefixColor} select-none w-8 align-top`}>
                      {prefix}
                    </td>
                    <td className={`px-2 py-1 ${textColor} align-top`} style={{ whiteSpace: 'pre', wordBreak: 'break-all' }}>
                      {line.content || '\u00A0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
