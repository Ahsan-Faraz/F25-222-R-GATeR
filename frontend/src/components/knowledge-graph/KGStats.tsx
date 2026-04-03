// Knowledge Graph statistics — Stitch GATeR Obsidian (Knowledge Graph tab)

import React, { useState, useEffect } from 'react';
import { getGraphStats, clearKuzuDatabase } from '@/lib/api/knowledge-graph';
import Button from '../ui/Button';
import MaterialIcon from '../ui/MaterialIcon';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

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
      <div className="space-y-4 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass-panel rounded-lg border border-outline-variant/15 p-5">
              <div className="skeleton h-4 w-24 rounded mb-3" />
              <div className="skeleton h-8 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low p-8 text-center">
        <MaterialIcon name="error" className="text-error mb-3 !text-[32px]" />
        <p className="text-sm text-on-error-container mb-4 font-mono">{error}</p>
        <Button onClick={loadStats} size="sm" variant="ghost">
          Retry
        </Button>
      </div>
    );
  }

  const nodeCount = stats?.total_nodes ?? stats?.nodes ?? 0;
  const edgeCount = stats?.total_edges ?? stats?.edges ?? 0;
  const entityTypes = stats?.node_types ?? stats?.entity_types ?? {};
  const relationshipTypes = stats?.relationship_types ?? {};

  const statTiles = [
    {
      icon: 'bubble_chart' as const,
      label: 'Nodes',
      value: nodeCount.toLocaleString(),
      accent: 'text-primary/90',
    },
    {
      icon: 'link' as const,
      label: 'Edges',
      value: edgeCount.toLocaleString(),
      accent: 'text-secondary/90',
    },
    {
      icon: 'category' as const,
      label: 'Entity types',
      value: String(Object.keys(entityTypes).length),
      accent: 'text-tertiary/90',
    },
    {
      icon: 'account_tree' as const,
      label: 'Relationship kinds',
      value: String(Object.keys(relationshipTypes).length),
      accent: 'text-on-surface-variant',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {successMessage && (
        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(195,245,255,0.45)]" />
          <span className="font-mono text-xs">{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-mono text-xs">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statTiles.map((t) => (
          <div
            key={t.label}
            className="glass-panel rounded-lg border border-outline-variant/15 p-5 flex flex-col gap-2 transition-colors hover:border-outline-variant/25"
          >
            <div className="flex items-center gap-2 text-on-surface-variant/60">
              <MaterialIcon name={t.icon} className={`!text-[20px] ${t.accent}`} />
              <span className="text-[10px] font-mono uppercase tracking-widest">{t.label}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-mono font-semibold text-on-surface tracking-tight">{t.value}</p>
          </div>
        ))}
      </div>

      {Object.keys(entityTypes).length > 0 && (
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/80">
              Entity types
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(entityTypes).map(([type, count]) => (
                <div
                  key={type}
                  className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-3 py-3 transition-colors hover:bg-surface-container-high"
                >
                  <div className="text-lg font-mono font-semibold text-on-surface">{count}</div>
                  <div className="text-[10px] text-on-surface-variant/70 uppercase tracking-wider truncate mt-1">
                    {type.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {Object.keys(relationshipTypes).length > 0 && (
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/80">
              Relationship types
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(relationshipTypes).map(([type, count]) => (
                <div
                  key={type}
                  className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-3 py-3 transition-colors hover:bg-surface-container-high"
                >
                  <div className="text-lg font-mono font-semibold text-on-surface">{count}</div>
                  <div className="text-[10px] text-on-surface-variant/70 uppercase tracking-wider truncate mt-1">
                    {type.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {!showClearConfirm ? (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-error border border-outline-variant/20 rounded-lg px-4 py-2 hover:bg-error-container/10 hover:border-error/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear database
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-error/25 bg-error-container/15 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-on-error-container shrink-0" />
              <span className="text-sm text-on-error-container font-mono">Delete all graph data?</span>
              <Button onClick={handleClearDatabase} size="sm" variant="danger" loading={clearing}>
                Confirm
              </Button>
              <Button onClick={() => setShowClearConfirm(false)} size="sm" variant="ghost">
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
          className="border-outline-variant/20 self-start sm:self-auto"
          icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh stats
        </Button>
      </div>
    </div>
  );
}
