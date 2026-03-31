// Knowledge Graph Statistics Component

import React, { useState, useEffect } from 'react';
import { getGraphStats, clearKuzuDatabase } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

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
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleClearDatabase = async () => {
    setClearing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await clearKuzuDatabase();
      if (result.success) {
        setSuccessMessage('KUZU database cleared successfully');
        setShowClearConfirm(false);
        // Reload stats after clearing
        await loadStats();
      } else {
        setError(result.message || 'Failed to clear database');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clear KUZU database');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (loading && !stats) {
    return (
      <Card title="Knowledge Graph Statistics">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B8E3E9]"></div>
        </div>
      </Card>
    );
  }

  if (error && !stats) {
    return (
      <Card title="Knowledge Graph Statistics">
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={loadStats} size="sm">Retry</Button>
        </div>
      </Card>
    );
  }

  const nodeCount = stats?.total_nodes ?? stats?.nodes ?? 0;
  const edgeCount = stats?.total_edges ?? stats?.edges ?? 0;
  const entityTypes = stats?.node_types ?? stats?.entity_types ?? {};
  const relationshipTypes = stats?.relationship_types ?? {};

  return (
    <Card title="Knowledge Graph Statistics (KUZU)">
      <div className="space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-emerald-900/40 border border-emerald-500/50 text-emerald-300 rounded-lg p-3 text-sm">
            ✓ {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-900/40 border border-red-500/50 text-red-300 rounded-lg p-3 text-sm">
            ✗ {error}
          </div>
        )}

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
            <h4 className="font-semibold text-white mb-3 text-lg">Entity Types</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(entityTypes).map(([type, count]) => (
                <div key={type} className="bg-[#16424a] rounded-lg p-3 border border-[#4F7C82]">
                  <div className="text-lg font-bold text-[#B8E3E9]">{count}</div>
                  <div className="text-xs text-[#93B1B5] capitalize">{type.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Relationship Types Breakdown */}
        {Object.keys(relationshipTypes).length > 0 && (
          <div>
            <h4 className="font-semibold text-white mb-3 text-lg">Relationship Types</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(relationshipTypes).map(([type, count]) => (
                <div key={type} className="bg-[#2a3f36] rounded-lg p-3 border border-[#D4A574]">
                  <div className="text-lg font-bold text-[#D4A574]">{count}</div>
                  <div className="text-xs text-[#E8D4B8] capitalize">{type.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2 border-t border-[#4F7C82]/30">
          <div className="flex gap-2">
            {!showClearConfirm ? (
              <Button 
                onClick={() => setShowClearConfirm(true)} 
                size="sm" 
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Clear Database
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-300">Delete all data?</span>
                <Button 
                  onClick={handleClearDatabase} 
                  size="sm" 
                  loading={clearing}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Yes, Clear
                </Button>
                <Button 
                  onClick={() => setShowClearConfirm(false)} 
                  size="sm" 
                  variant="ghost"
                  className="text-[#93B1B5]"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <Button onClick={loadStats} size="sm" variant="secondary" loading={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
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
    blue: 'bg-[#1a4a52] text-[#B8E3E9] border-[#4F7C82]',
    purple: 'bg-[#2a3830] text-[#D4A574] border-[#A67C52]',
    green: 'bg-[#1a3a3f] text-[#93B1B5] border-[#4F7C82]',
    orange: 'bg-[#2a3530] text-[#E8D4B8] border-[#D4A574]',
  };

  return (
    <div className={`rounded-xl p-4 border-2 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-[#B8E3E9]">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
