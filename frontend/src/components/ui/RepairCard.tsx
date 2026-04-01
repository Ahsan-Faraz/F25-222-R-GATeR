import React from 'react';
import Link from 'next/link';
import MaterialIcon from '@/components/ui/MaterialIcon';

export interface RepairCardProps {
  /** e.g. engine online / last repair status */
  statusLine: string;
  detailLine?: string;
  repairHref: string;
}

/**
 * Pipeline CTA card — matches glass/insight density from Stitch dashboard column.
 */
export default function RepairCard({ statusLine, detailLine, repairHref }: RepairCardProps) {
  return (
    <div className="glass-panel border border-outline-variant/20 rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MaterialIcon name="build" className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Test Repair</h3>
      </div>
      <p className="text-sm font-mono text-on-surface leading-tight">{statusLine}</p>
      {detailLine && (
        <p className="text-[11px] text-on-surface-variant leading-snug">{detailLine}</p>
      )}
      <Link
        href={repairHref}
        className="mt-1 w-full py-2 text-center bg-gradient-to-r from-primary to-primary-container text-on-primary text-xs font-bold rounded hover:opacity-90 transition-opacity uppercase tracking-widest"
      >
        Open repair workspace
      </Link>
    </div>
  );
}
