// Knowledge Graph Statistics Component - Minimalist-Futurism Design

import React, { useState, useEffect } from 'react';
import { getGraphStats, clearKuzuDatabase } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Trash2, RefreshCw, AlertTriangle, Database, GitBranch, Box, Link2 } from 'lucide-react';

interface GraphStats {
  total_nodes?: number;
  total_edges?: number;
  node_types?: Record<string, number>;
  relationship_types?: Record<string, number>;
  files_covered?: string[] | number;
  largest_component_size?: number;
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

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (loading && !stats) {
    return (
      <Card title="Knowledge Graph">
        <div className="space-y-3">
          <div className="skeleton h-16 rounded-md" />
          <div className="skeleton h-32 rounded-md" />
        </div>
      </Card>
    );
  }

  if (error && !stats) {
    return (
      <Card title="Knowledge Graph">
        <div className="text-center py-8">
          <p className="text-red-400 mb-4 text-sm">{error}</p>
          <Button onClick={loadStats} size="sm" variant="ghost">Retry</Button>
        </div>
      </Card>
    );
  }

  const nodeCount = stats?.total_nodes ?? stats?.nodes ?? 0;
  const edgeCount = stats?.total_edges ?? stats?.edges ?? 0;
  const entityTypes = stats?.node_types ?? stats?.entity_types ?? {};
  const relationshipTypes = stats?.relationship_types ?? {};

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 text-green-400 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Statistical Ribbon */}
      <Card>
        <div className="stat-ribbon">
          <div className="stat-item">
            <Box className="w-4 h-4 text-text-muted mb-1" />
            <span className="stat-label">Nodes</span>
            <span className="stat-value">{nodeCount.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <Link2 className="w-4 h-4 text-text-muted mb-1" />
            <span className="stat-label">Edges</span>
            <span className="stat-value">{edgeCount.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <Database className="w-4 h-4 text-text-muted mb-1" />
            <span className="stat-label">Entity Types</span>
            <span className="stat-value">{Object.keys(entityTypes).length}</span>
          </div>
          <div className="stat-item">
            <GitBranch className="w-4 h-4 text-text-muted mb-1" />
            <span className="stat-label">Relationships</span>
            <span className="stat-value">{Object.keys(relationshipTypes).length}</span>
          </div>
        </div>
      </Card>

      {/* Entity Types */}
      {Object.keys(entityTypes).length > 0 && (
        <Card title="Entity Types">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Object.entries(entityTypes).map(([type, count]) => (
              <div key={type} className="bg-surface-elevated border border-border rounded-md px-3 py-2">
                <div className="text-lg font-mono font-semibold text-text-primary">{count}</div>
                <div className="text-xs text-text-muted uppercase tracking-wider truncate">{type.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Relationship Types */}
      {Object.keys(relationshipTypes).length > 0 && (
        <Card title="Relationship Types">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Object.entries(relationshipTypes).map(([type, count]) => (
              <div key={type} className="bg-surface-elevated border border-border rounded-md px-3 py-2">
                <div className="text-lg font-mono font-semibold text-text-primary">{count}</div>
                <div className="text-xs text-text-muted uppercase tracking-wider truncate">{type.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div>
          {!showClearConfirm ? (
            <Button 
              onClick={() => setShowClearConfirm(true)} 
              size="sm" 
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:border-red-400/50"
              icon={<Trash2 className="w-4 h-4" />}
            >
              Clear Database
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 rounded-md px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">Delete all data?</span>
              <Button 
                onClick={handleClearDatabase} 
                size="sm" 
                variant="danger"
                loading={clearing}
              >
                Confirm
              </Button>
              <Button 
                onClick={() => setShowClearConfirm(false)} 
                size="sm" 
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
        <Button 
          onClick={loadStats} 
          size="sm" 
          variant="ghost" 
          loading={loading}
          icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
