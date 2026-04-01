import React from 'react';
import { useRouter } from 'next/router';

const STITCH_GRAPH_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC7lDYUqbFK0LtV8gQZTr8PvXBrwnTHopZCnz7b9MbKel5qOszz7LNCVG_lJq5x7kGLNvxgBlqQfNKDp-kVViF7tKgRnZGzZmd9XCzA_0JAmkzm_mUa8v2SaQBqtGD6xTjGEi4m-k5wtJIRsiqesQ5PmokCdeifsn6kTb-y5d4z6WEorXV162fjoeuDkrdO3Q4Rrd78jKZP_IFKbDhyUQVM35o1T2G1BwxaozvNm4TgdbIEKTeRyyTxnJHghTEuDbbX4KdDZ0B_dQp6';

export interface GraphCardProps {
  onExplore3d?: () => void;
  onExportCsv?: () => void;
}

/**
 * Stitch f8392340720a469cb944211c9fac7ea3 — Graph Spatial View full-width block.
 */
export default function GraphCard({ onExplore3d, onExportCsv }: GraphCardProps) {
  const router = useRouter();
  const base = router.pathname.startsWith('/workspace') ? '/workspace' : '/';

  const goVis = () => {
    if (onExplore3d) onExplore3d();
    else router.push(`${base}?section=kgvis`);
  };
  const goExport = () => {
    if (onExportCsv) onExportCsv();
    else router.push(`${base}?section=export`);
  };

  return (
    <div className="col-span-12 bg-surface-container-lowest border border-outline-variant/10 rounded-lg overflow-hidden h-[400px] relative">
      <div className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none">
        <img
          alt=""
          className="w-full h-full object-cover"
          src={STITCH_GRAPH_IMAGE}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0f] via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 p-8 w-full flex justify-between items-end">
        <div className="max-w-md">
          <h3 className="text-2xl font-headline font-extrabold text-on-surface leading-tight mb-2">
            Graph Spatial View
          </h3>
          <p className="text-sm text-on-surface-variant">
            Real-time visualization of the repository&apos;s semantic structure. Nodes represent
            functions; edges represent calls and dependencies.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={goVis}
            className="px-4 py-2 bg-surface-container-high rounded text-xs font-mono border border-outline-variant/20 hover:border-primary/50 transition-colors uppercase"
          >
            3D Explore
          </button>
          <button
            type="button"
            onClick={goExport}
            className="px-4 py-2 bg-surface-container-high rounded text-xs font-mono border border-outline-variant/20 hover:border-primary/50 transition-colors uppercase"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
