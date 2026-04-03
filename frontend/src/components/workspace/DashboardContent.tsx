import React from 'react';
import { useRouter } from 'next/router';
import KGStats from '@/components/knowledge-graph/KGStats';
import KGCompassPanel from '@/components/kgcompass/KGCompassPanel';
import KuzuPanel from '@/components/kuzu/KuzuPanel';
import VectorPanel from '@/components/vectors/VectorPanel';
import GATRPanel from '@/components/gatr/GATRPanel';
import ExportPanel from '@/components/export/ExportPanel';
import KGVisualization from '@/components/knowledge-graph/KGVisualization';
import RepositoryAnalysisScreen from '@/components/repo/RepositoryAnalysisScreen';
import { WorkspaceSectionId } from '@/components/layout/workspace-nav';
import WorkspaceSectionHeader from '@/components/workspace/WorkspaceSectionHeader';
export default function DashboardContent() {
  const router = useRouter();
  const activeSection = (router.query.section as WorkspaceSectionId) || 'repo';

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {activeSection === 'repo' && (
        <RepositoryAnalysisScreen />
      )}
      {activeSection !== 'repo' && <WorkspaceSectionHeader />}
      {activeSection === 'kg' && <KGStats />}
      {activeSection === 'kgvis' && <KGVisualization />}
      {activeSection === 'kgcompass' && <KGCompassPanel />}
      {activeSection === 'kuzu' && <KuzuPanel />}
      {activeSection === 'vectors' && <VectorPanel />}
      {activeSection === 'gatr' && <GATRPanel />}
      {activeSection === 'export' && <ExportPanel />}
    </div>
  );
}
