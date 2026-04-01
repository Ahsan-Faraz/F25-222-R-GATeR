import React from 'react';

export interface StorageMetricRow {
  label: string;
  value: string;
  /** Explains the metric (e.g. LRU vs request hit rate). */
  title?: string;
}

export interface StorageMetricsCardProps {
  rows: StorageMetricRow[];
}

/**
 * Stitch f8392340720a469cb944211c9fac7ea3 — Storage Metrics (col-span-4 bottom).
 */
export default function StorageMetricsCard({ rows }: StorageMetricsCardProps) {
  return (
    <div className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-6">
      <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-[0.2em] mb-4">
        Storage Metrics
      </p>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center gap-4">
            <span className="text-sm font-mono text-on-surface-variant" title={row.title}>
              {row.label}
            </span>
            <span className="text-sm font-mono font-bold text-primary text-right" title={row.title}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
