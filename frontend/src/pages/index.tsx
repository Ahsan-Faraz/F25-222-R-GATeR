// Main Dashboard Page - Integrates all features

import React, { useState, useEffect } from 'react';
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
import Card from '@/components/ui/Card';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>('repo');

  // Redirect to login if unauthenticated - use useEffect to avoid hydration issues
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render content while redirecting
  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'repo', label: 'Repository', icon: '📁' },
    { id: 'kg', label: 'Knowledge Graph', icon: '🕸️' },
    { id: 'kgvis', label: 'KG Visualization', icon: '📊' },
    { id: 'kgcompass', label: 'KGCompass', icon: '🧭' },
    { id: 'kuzu', label: 'KUZU DB', icon: '💾' },
    { id: 'vectors', label: 'Vector Search', icon: '🔍' },
    { id: 'gatr', label: 'Test Repair', icon: '🔧' },
    { id: 'export', label: 'Export', icon: '📤' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="bg-accent p-3 rounded-xl">
            <span className="text-3xl">🔬</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-primary">
              Welcome to GATeR Dashboard
            </h2>
            <p className="text-gray-600">
              Analyze repositories, explore knowledge graphs, and repair failing tests using AI-powered RAG
            </p>
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl shadow-card p-2 flex gap-2 overflow-x-auto">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeSection === section.id
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="mr-2">{section.icon}</span>
            {section.label}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      <div className="space-y-6">
        {activeSection === 'repo' && <RepoManager />}

        {activeSection === 'kg' && <KGStats />}

        {activeSection === 'kgvis' && <KGVisualization />}

        {activeSection === 'kgcompass' && <KGCompassPanel />}

        {activeSection === 'kuzu' && <KuzuPanel />}

        {activeSection === 'vectors' && <VectorPanel />}

        {activeSection === 'gatr' && <GATRPanel />}

        {activeSection === 'export' && <ExportPanel />}
      </div>
    </div>
  );
}
