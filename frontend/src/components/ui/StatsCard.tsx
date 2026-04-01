import React from 'react';

export interface StatsCardMetric {
  label: string;
  /** Main number string, e.g. "94.2" */
  value: string;
  /** Suffix inside styled span: "%", "k", etc. */
  suffix: string;
  /** Bar fill width 0–100 */
  barPercent: number;
  barClassName: string;
}

export interface StatsCardProps {
  title: string;
  subtitle: string;
  badge: string;
  metrics: StatsCardMetric[];
}

/**
 * Stitch f8392340720a469cb944211c9fac7ea3 — Knowledge Coverage (col-span-8).
 */
export default function StatsCard({ title, subtitle, badge, metrics }: StatsCardProps) {
  return (
    <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div>
          <h3 className="text-lg font-headline font-bold mb-1">{title}</h3>
          <p className="text-xs text-on-surface-variant/70">{subtitle}</p>
        </div>
        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded shrink-0">
          {badge}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        {metrics.map((m) => (
          <div key={m.label} className="space-y-2">
            <p className="text-sm font-medium text-on-surface-variant/60">{m.label}</p>
            <p className="text-4xl font-headline font-black text-on-surface">
              {m.value}
              {m.suffix ? <span className="text-lg text-primary">{m.suffix}</span> : null}
            </p>
            <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
              <div
                className={`h-full ${m.barClassName}`}
                style={{ width: `${Math.min(100, Math.max(0, m.barPercent))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
