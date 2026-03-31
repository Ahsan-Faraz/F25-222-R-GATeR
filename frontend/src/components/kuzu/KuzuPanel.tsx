// KUZU Database Panel Component - Minimalist-Futurism Design

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getKuzuStats, getKuzuNodes, getKuzuRelationships } from '@/lib/api/kuzu';
import { getGraphStats } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { RefreshCw, Database, Box, Link2, AlertTriangle, Loader2 } from 'lucide-react';

interface KuzuStats {
  total_nodes?: number;
  total_relationships?: number;
  kuzu_available?: boolean;
  codeentity_count?: number;
  commit_count?: number;
  issue_count?: number;
  pullrequest_count?: number;
  repository_count?: number;
  belongs_to_count?: number;
  calls_count?: number;
  imports_count?: number;
  modifies_count?: number;
  tests_count?: number;
  mentions_issue_count?: number;
  mentions_pr_count?: number;
  creates_count?: number;
  uses_count?: number;
  node_count?: number;
  relationship_count?: number;
  tables?: string[];
  storage_size?: string;
  error?: string;
}

interface KuzuNode {
  table?: string;
  data?: Record<string, any>;
  id?: string;
  labels?: string[];
  properties?: Record<string, any>;
}

interface KuzuRelationship {
  type?: string;
  source?: string;
  target?: string;
  properties?: Record<string, any>;
  rel_type?: string;
  from_id?: string;
  to_id?: string;
}

export default function KuzuPanel() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<KuzuStats | null>(null);
  const [nodes, setNodes] = useState<KuzuNode[]>([]);
  const [relationships, setRelationships] = useState<KuzuRelationship[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'nodes' | 'relationships'>('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      setIsAuthenticated(true);
    } else if (status === 'unauthenticated') {
      setIsAuthenticated(false);
      setError('Authentication required. Please log in to view KUZU database.');
    }
  }, [session, status]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    setUsingFallback(false);
    
    try {
      const data = await getKuzuStats();
      if (data && 'error' in data && data.error) {
        try {
          const fallbackData = await getGraphStats() as unknown as Record<string, any>;
          const convertedStats: KuzuStats = {
            kuzu_available: false,
            total_nodes: fallbackData['total_entities'] || fallbackData['node_count'] || fallbackData['nodes'] || fallbackData['total_nodes'] || 0,
            total_relationships: fallbackData['total_relationships'] || fallbackData['relationship_count'] || fallbackData['edges'] || fallbackData['total_edges'] || 0,
            codeentity_count: fallbackData['entity_types']?.['code_entity'] || 0,
            error: 'KUZU database not available, showing in-memory graph stats'
          };
          setStats(convertedStats);
          setUsingFallback(true);
          setError('KUZU database connection failed. Showing in-memory Knowledge Graph data instead.');
        } catch (fallbackErr) {
          setError('KUZU database not available and fallback also failed. Please restart the backend.');
          setStats(data);
        }
      } else {
        setStats(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load KUZU stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const loadNodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKuzuNodes({ limit });
      setNodes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load nodes');
      setNodes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRelationships = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKuzuRelationships({ limit });
      setRelationships(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load relationships');
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'nodes') loadNodes();
      else if (activeTab === 'relationships') loadRelationships();
    }
  }, [activeTab, limit, isAuthenticated]);

  return (
    <div className="space-y-6">
      {/* Auth Status */}
      {status === 'loading' && (
        <div className="bg-surface-elevated border border-border text-text-secondary rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking authentication...
        </div>
      )}
      
      {status === 'unauthenticated' && (
        <div className="bg-amber-900/20 border border-amber-500/30 text-amber-400 rounded-md px-4 py-3 text-sm">
          Please log in with GitHub to access KUZU database.
        </div>
      )}

      {usingFallback && (
        <div className="bg-surface-elevated border border-border text-text-secondary rounded-md px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>KUZU database unavailable. Showing in-memory graph data.</span>
        </div>
      )}

      {/* Stats Ribbon */}
      {stats && (
        <div className="stat-ribbon">
          <div className="stat-item">
            <span className="stat-value">{stats.total_nodes ?? stats.node_count ?? 0}</span>
            <span className="stat-label">Nodes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.total_relationships ?? stats.relationship_count ?? 0}</span>
            <span className="stat-label">Relationships</span>
          </div>
          <div className="stat-item">
            <span className={`inline-flex items-center gap-1.5 ${stats.kuzu_available ? 'text-green-400' : 'text-amber-400'}`}>
              <span className={`w-2 h-2 rounded-full ${stats.kuzu_available ? 'bg-green-400' : 'bg-amber-400'}`} />
              <span className="stat-value">{stats.kuzu_available ? 'Online' : 'Fallback'}</span>
            </span>
            <span className="stat-label">Status</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.codeentity_count ?? 0}</span>
            <span className="stat-label">Entities</span>
          </div>
        </div>
      )}

      <Card 
        title="KUZU Explorer"
        action={
          <Button
            onClick={() => {
              if (activeTab === 'stats') loadStats();
              else if (activeTab === 'nodes') loadNodes();
              else loadRelationships();
            }}
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border pb-2">
            {(['stats', 'nodes', 'relationships'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-surface-elevated text-text-primary border border-border'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {error && !usingFallback && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && !loading && stats && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Node Types</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'CodeEntity', value: stats.codeentity_count ?? 0 },
                    { label: 'Commit', value: stats.commit_count ?? 0 },
                    { label: 'Issue', value: stats.issue_count ?? 0 },
                    { label: 'PullRequest', value: stats.pullrequest_count ?? 0 },
                    { label: 'Repository', value: stats.repository_count ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="bg-surface-elevated border border-border rounded-md p-3">
                      <div className="text-xl font-mono text-text-primary">{item.value}</div>
                      <div className="text-xs text-text-muted">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Relationship Types</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'BELONGS_TO', value: stats.belongs_to_count ?? 0 },
                    { label: 'CALLS', value: stats.calls_count ?? 0 },
                    { label: 'IMPORTS', value: stats.imports_count ?? 0 },
                    { label: 'MODIFIES', value: stats.modifies_count ?? 0 },
                    { label: 'TESTS', value: stats.tests_count ?? 0 },
                    { label: 'CREATES', value: stats.creates_count ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="bg-surface-elevated border border-border rounded-md p-3">
                      <div className="text-xl font-mono text-text-primary">{item.value}</div>
                      <div className="text-xs text-text-muted">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {(stats.total_nodes === 0 || !stats.kuzu_available) && (
                <div className="bg-amber-900/20 border border-amber-500/30 text-amber-400 rounded-md px-4 py-3 text-sm">
                  <p className="font-medium">No data in database</p>
                  <p className="text-amber-300/70 mt-1">Analyze a repository to populate the knowledge graph.</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'stats' && !loading && !stats && !error && (
            <div className="text-center py-8 text-text-muted text-sm">
              Click "Refresh" to load database statistics.
            </div>
          )}

          {/* Nodes Tab */}
          {activeTab === 'nodes' && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">{nodes.length} nodes</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="ghost-input w-20 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {nodes.map((node, i) => {
                  const nodeTable = node.table || (node.labels && node.labels[0]) || 'unknown';
                  const nodeId = node.data?.entity_id || node.data?.id || node.id || `node-${i}`;
                  const nodeName = node.data?.name || node.data?.entity_id || nodeId;
                  const nodeProperties = node.data || node.properties || {};
                  
                  return (
                    <div key={nodeId} className="bg-surface-elevated border border-border rounded-md p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm text-text-primary">{nodeName}</span>
                        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                          {nodeTable}
                        </span>
                      </div>
                      {Object.keys(nodeProperties).length > 0 && (
                        <div className="text-xs text-text-muted space-y-1">
                          {Object.entries(nodeProperties)
                            .filter(([key]) => !['entity_id', 'id', 'name'].includes(key))
                            .slice(0, 3)
                            .map(([key, value]) => (
                              <div key={key} className="truncate font-mono">
                                <span className="text-text-secondary">{key}:</span> {String(value).slice(0, 80)}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {nodes.length === 0 && (
                  <div className="text-center py-8 text-text-muted text-sm">
                    No nodes found. Analyze a repository first.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Relationships Tab */}
          {activeTab === 'relationships' && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">{relationships.length} relationships</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="ghost-input w-20 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {relationships.map((rel, i) => {
                  const relType = rel.type || rel.rel_type || 'unknown';
                  const relSource = rel.source || rel.from_id || 'unknown';
                  const relTarget = rel.target || rel.to_id || 'unknown';
                  
                  return (
                    <div key={`${relSource}-${relType}-${relTarget}-${i}`} className="bg-surface-elevated border border-border rounded-md p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-text-secondary">{relSource}</span>
                        <span className="text-accent font-medium text-xs px-2 py-0.5 bg-accent/10 border border-accent/20 rounded">
                          → {relType} →
                        </span>
                        <span className="font-mono text-xs text-text-secondary">{relTarget}</span>
                      </div>
                    </div>
                  );
                })}
                {relationships.length === 0 && (
                  <div className="text-center py-8 text-text-muted text-sm">
                    No relationships found. Analyze a repository first.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
