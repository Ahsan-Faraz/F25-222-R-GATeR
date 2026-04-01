import React from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export interface TopbarProps {
  embeddingsDisplay: string;
  activeModelDisplay: string;
  onOpenCommandPalette: () => void;
}

/**
 * Stitch screen f8392340720a469cb944211c9fac7ea3 — top status bar (verbatim).
 */
export default function Topbar({
  embeddingsDisplay,
  activeModelDisplay,
  onOpenCommandPalette,
}: TopbarProps) {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-[#0e0e0f] border-b border-outline-variant/5 sticky top-0 z-40">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(195,245,255,0.6)]" />
          <span className="text-[11px] font-mono text-primary/80 uppercase tracking-tighter">
            Graph Loaded
          </span>
        </div>
        <div className="h-4 w-[1px] bg-outline-variant/20" />
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant/50 uppercase leading-none mb-1">
            Embeddings
          </span>
          <span className="text-xs font-mono font-medium text-on-surface tracking-tight">
            {embeddingsDisplay}
          </span>
        </div>
        <div className="h-4 w-[1px] bg-outline-variant/20" />
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant/50 uppercase leading-none mb-1">
            Active Model
          </span>
          <span className="text-xs font-mono font-medium text-on-surface tracking-tight">
            {activeModelDisplay}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-4 py-1.5 rounded bg-surface-container-low border border-outline-variant/20 text-on-surface-variant/70 text-sm hover:border-primary/40 transition-colors"
        >
          <MaterialIcon name="search" className="!text-[18px]" />
          <span className="text-xs font-mono">CMD + K</span>
        </button>
        <div className="w-[1px] h-6 bg-outline-variant/20" />
        <button
          type="button"
          className="text-on-surface-variant hover:text-primary transition-colors"
          aria-label="Notifications"
        >
          <MaterialIcon name="notifications" />
        </button>
        <button
          type="button"
          className="text-on-surface-variant hover:text-primary transition-colors"
          aria-label="Settings"
        >
          <MaterialIcon name="settings" />
        </button>
      </div>
    </header>
  );
}
