// Main Dashboard Page - Command Center

import React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import RepoManager from '@/components/repo/RepoManager';
import KGStats from '@/components/knowledge-graph/KGStats';
import KGCompassPanel from '@/components/kgcompass/KGCompassPanel';
import KuzuPanel from '@/components/kuzu/KuzuPanel';
import VectorPanel from '@/components/vectors/VectorPanel';
import GATRPanel from '@/components/gatr/GATRPanel';
import ExportPanel from '@/components/export/ExportPanel';
import KGVisualization from '@/components/knowledge-graph/KGVisualization';
import LandingPage from '@/components/landing/LandingPage';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Get active section from URL query
  const activeSection = (router.query.section as string) || 'repo';

  // Loading skeleton
  if (status === 'loading') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-32 rounded-card" />
        <div className="skeleton h-64 rounded-card" />
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (status === 'unauthenticated') {
    return <LandingPage />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Content Sections */}
      {activeSection === 'repo' && <RepoManager />}
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
