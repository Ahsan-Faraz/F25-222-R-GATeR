import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getVectorStats } from '@/lib/api/vectors';
import { getGATRStatus } from '@/lib/api/gatr';
import { getAccessToken } from '@/lib/api-client';

const FALLBACK_EMB = '142,852 NODES';
const FALLBACK_MODEL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_STITCH_MODEL
    ? process.env.NEXT_PUBLIC_STITCH_MODEL
    : 'GPT-4-TURBO-GR';

/**
 * Top bar metrics (Stitch: Embeddings + Active Model) — same APIs as dashboard, cached lightly.
 */
export function useWorkspaceTopbarMetrics() {
  const { status } = useSession();
  const [embeddingsDisplay, setEmbeddingsDisplay] = useState(FALLBACK_EMB);
  const [activeModelDisplay, setActiveModelDisplay] = useState(FALLBACK_MODEL);

  useEffect(() => {
    // Skip API calls if not authenticated or token not ready
    if (status !== 'authenticated' || !getAccessToken()) {
      return;
    }
    
    let cancelled = false;
    (async () => {
      try {
        const [v, g] = await Promise.all([
          getVectorStats().catch(() => null),
          getGATRStatus().catch(() => null),
        ]);
        if (cancelled) return;
        const n = Number((v as { total_vectors?: number })?.total_vectors ?? 0);
        if (n > 0) {
          setEmbeddingsDisplay(`${n.toLocaleString('en-US')} NODES`);
        }
        const m = (g as { llm?: { model?: string } })?.llm?.model;
        if (m) {
          setActiveModelDisplay(m.replace(/\s+/g, '-').toUpperCase().slice(0, 28));
        }
      } catch {
        /* keep fallbacks */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return { embeddingsDisplay, activeModelDisplay };
}
