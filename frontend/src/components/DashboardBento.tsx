import React from 'react';
import { useRouter } from 'next/router';
import { useAppState } from '@/context/AppStateContext';
import { useDashboardBentoData } from '@/hooks/useDashboardBentoData';
import StatsCard from '@/components/ui/StatsCard';
import ActionCard from '@/components/ui/ActionCard';
import GraphCard from '@/components/ui/GraphCard';
import StorageMetricsCard from '@/components/ui/StorageMetricsCard';
import ActivityCard from '@/components/ui/ActivityCard';
import DashboardFab from '@/components/ui/DashboardFab';

/**
 * Stitch screen `f8392340720a469cb944211c9fac7ea3` — Workspace Dashboard bento (production).
 * Data from existing Flask APIs via {@link useDashboardBentoData}; no backend changes.
 */
export default function DashboardBento() {
  const router = useRouter();
  const { currentRepo } = useAppState();
  const repoLabel = currentRepo ? `${currentRepo.owner}/${currentRepo.name}` : null;
  const data = useDashboardBentoData(repoLabel);

  const basePath = router.pathname.startsWith('/workspace') ? '/workspace' : '/';

  const startAnalysis = () => {
    router.push(`${basePath}?section=repo`);
    requestAnimationFrame(() => {
      document.getElementById('gater-repo-operations')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const fabScroll = () => {
    document.getElementById('gater-repo-operations')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="space-y-8 animate-fade-in">
      {/* Hero — Stitch */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">
            Workspace Dashboard
          </h2>
          <p className="text-on-surface-variant mt-1">
            Analyzing <span className="text-primary font-mono">{data.versionTag}</span> for graph
            inconsistencies.
          </p>
        </div>
        <button
          type="button"
          onClick={startAnalysis}
          className="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-bold rounded hover:opacity-90 transition-opacity uppercase tracking-wide shrink-0"
        >
          START NEW ANALYSIS
        </button>
      </div>

      {data.error && (
        <p className="text-sm text-error font-mono border border-error/30 rounded-lg px-4 py-2 bg-error/5">
          {data.error}
        </p>
      )}

      {data.loading && !data.statsMetrics.length ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 h-64 skeleton rounded-lg" />
          <div className="col-span-12 lg:col-span-4 h-64 skeleton rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <StatsCard
            title="Knowledge Coverage"
            subtitle="Repository traversal metrics for current branch"
            badge="LIVE UPDATING"
            metrics={data.statsMetrics}
          />

          <div className="col-span-12 lg:col-span-4">
            <ActionCard items={data.urgentIssues} onViewAll={() => router.push(`${basePath}?section=kg`)} />
          </div>

          <GraphCard />

          <StorageMetricsCard rows={data.storageRows} />
          <ActivityCard logs={data.activityLogs} />
        </div>
      )}

      <DashboardFab onClick={fabScroll} />
    </section>
  );
}
