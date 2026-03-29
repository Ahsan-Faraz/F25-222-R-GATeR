// Knowledge Graph Statistics Component

import React, { useState, useEffect } from 'react';
import { getGraphStats } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface GraphStats {
  // Backend uses these names
  total_nodes?: number;
  total_edges?: number;
  node_types?: Record<string, number>;
  relationship_types?: Record<string, number>;
  files_covered?: string[] | number;
  largest_component_size?: number;
  // Legacy names for compatibility
  nodes?: number;
  edges?: number;
  entity_types?: Record<string, number>;
}

export default function KGStats() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGraphStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading && !stats) {
    return (
      <Card title="Knowledge Graph Statistics">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Knowledge Graph Statistics">
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadStats} size="sm">Retry</Button>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card title="Knowledge Graph Statistics">
        <div className="text-center py-8">
          <p className="text-gray-500">No graph data available. Analyze a repository first.</p>
        </div>
      </Card>
    );
  }

  const nodeCount = stats.total_nodes ?? stats.nodes ?? 0;
  const edgeCount = stats.total_edges ?? stats.edges ?? 0;
  const entityTypes = stats.node_types ?? stats.entity_types ?? {};
  const relationshipTypes = stats.relationship_types ?? {};

  return (
    <Card title="Knowledge Graph Statistics">
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Nodes" value={nodeCount} icon="🔵" color="blue" />
          <StatCard label="Total Edges" value={edgeCount} icon="🔗" color="purple" />
          <StatCard 
            label="Entity Types" 
            value={Object.keys(entityTypes).length} 
            icon="📊" 
            color="green" 
          />
          <StatCard 
            label="Relationship Types" 
            value={Object.keys(relationshipTypes).length} 
            icon="↔️" 
            color="orange" 
          />
        </div>

        {/* Entity Types Breakdown */}
        {Object.keys(entityTypes).length > 0 && (
          <div>
            <h4 className="font-semibold text-primary mb-3">Entity Types</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(entityTypes).map(([type, count]) => (
                <div key={type} className="bg-gray-50 rounded-lg p-3 border">
                  <div className="text-lg font-bold text-primary">{count}</div>
                  <div className="text-xs text-gray-600 capitalize">{type.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Relationship Types Breakdown */}
        {Object.keys(relationshipTypes).length > 0 && (
          <div>
            <h4 className="font-semibold text-primary mb-3">Relationship Types</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(relationshipTypes).map(([type, count]) => (
                <div key={type} className="bg-gray-50 rounded-lg p-3 border">
                  <div className="text-lg font-bold text-accent">{count}</div>
                  <div className="text-xs text-gray-600 capitalize">{type.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={loadStats} size="sm" variant="secondary" loading={loading}>
            🔄 Refresh Stats
          </Button>
        </div>
      </div>
    </Card>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color 
}: { 
  label: string; 
  value: number; 
  icon: string; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  return (
    <div className={`rounded-xl p-4 border-2 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
