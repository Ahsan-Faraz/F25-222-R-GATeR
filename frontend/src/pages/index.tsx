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
import LandingPage from '@/components/landing/LandingPage';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>('repo');

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

  // Show landing page for unauthenticated users
  if (status === 'unauthenticated') {
    return <LandingPage />;
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
          <div className="w-16 h-16 bg-gradient-to-br from-[#4F7C82] to-[#3a5e64] p-3 rounded-xl shadow-lg flex items-center justify-center">
            <span className="text-3xl">🔬</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Welcome to GATeR Dashboard
            </h2>
            <p className="text-[#B8E3E9] text-base">
              Analyze repositories, explore knowledge graphs, and repair failing tests using AI-powered RAG
            </p>
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="bg-gradient-to-r from-[rgba(30,66,74,0.8)] via-[rgba(45,80,88,0.7)] to-[rgba(30,66,74,0.8)] border border-[rgba(184,227,233,0.25)] backdrop-blur-md rounded-2xl shadow-lg p-2 flex gap-2 overflow-x-auto">
        {sections.map((section, index) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeSection === section.id
                ? index % 2 === 0 
                  ? 'bg-gradient-to-r from-[#4F7C82] to-[#3a5e64] text-white shadow-md border border-[rgba(184,227,233,0.4)]'
                  : 'bg-gradient-to-r from-[#D4A574] to-[#A67C52] text-[#0B2E33] shadow-md border border-[rgba(212,165,116,0.4)]'
                : 'bg-transparent text-[#B8E3E9] hover:bg-[rgba(79,124,130,0.3)] hover:text-white'
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
