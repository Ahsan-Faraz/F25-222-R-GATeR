import React from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export interface UrgentIssueItem {
  title: string;
  impact: string;
}

export interface ActionCardProps {
  items: UrgentIssueItem[];
  onViewAll?: () => void;
}

/**
 * Stitch f8392340720a469cb944211c9fac7ea3 — Urgent Fixes (glass panel, col-span-4).
 */
export default function ActionCard({ items, onViewAll }: ActionCardProps) {
  return (
    <div className="glass-panel border border-outline-variant/20 rounded-lg p-6 flex flex-col justify-between min-h-[280px]">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MaterialIcon name="warning" className="text-tertiary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-tertiary">Urgent Fixes</h3>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-on-surface-variant/80 font-mono leading-tight">
            No urgent issues detected for the current graph.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((li) => (
              <li key={li.title} className="flex items-start gap-3 group cursor-pointer">
                <div className="w-1.5 h-1.5 rounded-full bg-error mt-1.5 group-hover:scale-150 transition-transform shrink-0" />
                <div>
                  <p className="text-sm font-mono text-on-surface leading-tight">{li.title}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Impact: {li.impact}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onViewAll}
        className="w-full py-2 border border-outline-variant/30 rounded text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors mt-6 uppercase tracking-widest"
      >
        View All Issues
      </button>
    </div>
  );
}
