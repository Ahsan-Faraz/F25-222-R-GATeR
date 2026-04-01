import React from 'react';
import { useRouter } from 'next/router';
import { WORKSPACE_NAV_ITEMS, WorkspaceSectionId } from '@/components/layout/workspace-nav';
import { useAppState } from '@/context/AppStateContext';
import Button from '@/components/ui/Button';

/**
 * Stitch Workspace Dashboard — hero row: title, subtitle, primary CTA (screen f8392340720a469cb944211c9fac7ea3).
 */
export default function WorkspaceSectionHeader() {
  const router = useRouter();
  const { currentRepo } = useAppState();
  const section = (router.query.section as WorkspaceSectionId) || 'repo';
  const meta = WORKSPACE_NAV_ITEMS.find((i) => i.id === section);

  const title =
    section === 'repo' ? 'Workspace Dashboard' : (meta?.label ?? 'Workspace');

  const repoLine = currentRepo
    ? `${currentRepo.owner}/${currentRepo.name}`
    : 'No repository selected';

  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">
          {title}
        </h2>
        <p className="text-on-surface-variant mt-2 text-sm max-w-2xl leading-relaxed">
          Analyzing <span className="font-mono text-on-surface/90">{repoLine}</span> for graph
          inconsistencies.
        </p>
      </div>
      <Button
        type="button"
        className="shrink-0 uppercase tracking-wide text-xs font-semibold px-6 py-2.5"
        onClick={() => {
          const base = router.pathname.startsWith('/workspace') ? '/workspace' : '/';
          router.push(`${base}?section=repo`);
        }}
      >
        Start new analysis
      </Button>
    </div>
  );
}
