// KUZU Database Panel Component

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getKuzuStats, getKuzuNodes, getKuzuRelationships } from '@/lib/api/kuzu';
import { getGraphStats } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { RefreshCw, Database } from 'lucide-react';

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
          const fallbackData = await getGraphStats() as any;
          const convertedStats: KuzuStats = {
            kuzu_available: false,
            total_nodes: fallbackData.total_entities || fallbackData.node_count || fallbackData.nodes || fallbackData.total_nodes || 0,
            total_relationships: fallbackData.total_relationships || fallbackData.relationship_count || fallbackData.edges || fallbackData.total_edges || 0,
            codeentity_count: fallbackData.entity_types?.code_entity || 0,
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
    <Card title="KUZU Database Explorer">
      <div className="space-y-4">
        <p className="text-[var(--color-text-muted)] text-sm">
          Explore the persistent knowledge graph stored in KUZU database.
        </p>

        {status === 'loading' && (
          <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg p-3 text-sm">
            Checking authentication status...
          </div>
        )}
        
        {status === 'unauthenticated' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg p-3 text-sm">
            Please log in with GitHub to access KUZU database features.
          </div>
        )}

        {usingFallback && (
          <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg p-3 text-sm">
            <strong>⚠️ Using In-Memory Graph:</strong> KUZU database is unavailable. Showing data from the in-memory NetworkX graph instead.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/5 pb-2">
          {(['stats', 'nodes', 'relationships'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white/10 text-white border border-white/10 shadow-glow'
                  : 'bg-transparent text-[var(--color-text-muted)] hover:bg-white/5'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {error && !usingFallback && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 whitespace-pre-line">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full" />
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && !loading && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-500/10 rounded-lg p-4 text-center border border-blue-500/20">
                <div className="text-3xl font-bold font-display tracking-wider text-blue-400">{stats.total_nodes ?? stats.node_count ?? 0}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Total Nodes</div>
              </div>
              <div className="bg-purple-500/10 rounded-lg p-4 text-center border border-purple-500/20">
                <div className="text-3xl font-bold font-display tracking-wider text-purple-400">{stats.total_relationships ?? stats.relationship_count ?? 0}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Relationships</div>
              </div>
              <div className="bg-emerald-500/10 rounded-lg p-4 text-center border border-emerald-500/20">
                <div className="flex justify-center mb-1"><Database className={`w-8 h-8 ${stats.kuzu_available ? 'text-emerald-400' : 'text-[var(--color-text-faint)]'}`} /></div>
                <div className="text-sm text-[var(--color-text-muted)]">DB Status</div>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-4 text-center border border-orange-500/20">
                <div className="text-3xl font-bold font-display tracking-wider text-orange-400">{stats.codeentity_count ?? 0}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Code Entities</div>
              </div>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4 border border-white/5">
              <h4 className="font-medium mb-2 text-white">Node Types</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm text-[var(--color-text-muted)]">
                <div><span className="font-medium text-white">CodeEntity:</span> {stats.codeentity_count ?? 0}</div>
                <div><span className="font-medium text-white">Commit:</span> {stats.commit_count ?? 0}</div>
                <div><span className="font-medium text-white">Issue:</span> {stats.issue_count ?? 0}</div>
                <div><span className="font-medium text-white">PullRequest:</span> {stats.pullrequest_count ?? 0}</div>
                <div><span className="font-medium text-white">Repository:</span> {stats.repository_count ?? 0}</div>
              </div>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4 border border-white/5">
              <h4 className="font-medium mb-2 text-white">Relationship Types</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-[var(--color-text-muted)]">
                <div><span className="font-medium text-white">BELONGS_TO:</span> {stats.belongs_to_count ?? 0}</div>
                <div><span className="font-medium text-white">CALLS:</span> {stats.calls_count ?? 0}</div>
                <div><span className="font-medium text-white">IMPORTS:</span> {stats.imports_count ?? 0}</div>
                <div><span className="font-medium text-white">MODIFIES:</span> {stats.modifies_count ?? 0}</div>
                <div><span className="font-medium text-white">TESTS:</span> {stats.tests_count ?? 0}</div>
                <div><span className="font-medium text-white">CREATES:</span> {stats.creates_count ?? 0}</div>
              </div>
            </div>
            
            {(stats.total_nodes === 0 || !stats.kuzu_available) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-lg p-3 text-sm">
                <p className="font-medium">No data in KUZU database</p>
                <p className="opacity-80">To populate the database, analyze a GitHub repository using the Repository Manager panel.</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'stats' && !loading && !stats && !error && (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <p>Click "Refresh" to load KUZU database statistics.</p>
          </div>
        )}

        {/* Nodes Tab */}
        {activeTab === 'nodes' && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Showing {nodes.length} nodes</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">Limit:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="bg-black/40 border border-white/20 text-white rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {nodes.map((node, i) => {
                const nodeTable = node.table || (node.labels && node.labels[0]) || 'unknown';
                const nodeId = node.data?.entity_id || node.data?.id || node.id || `node-${i}`;
                const nodeName = node.data?.name || node.data?.entity_id || nodeId;
                const nodeProperties = node.data || node.properties || {};
                
                return (
                  <div key={nodeId} className="bg-white/5 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-white">{nodeName}</span>
                      <span className="text-xs bg-[var(--color-accent)]/20 text-[var(--color-cyan)] px-2 py-0.5 rounded-full border border-[var(--color-cyan)]/30">
                        {nodeTable}
                      </span>
                    </div>
                    {Object.keys(nodeProperties).length > 0 && (
                      <div className="text-xs text-[var(--color-text-faint)] mt-2">
                        {Object.entries(nodeProperties)
                          .filter(([key]) => !['entity_id', 'id', 'name'].includes(key))
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <div key={key} className="mb-1 truncate font-mono">
                              <span className="text-[var(--color-cyan)]/80 mr-1">{key}:</span> 
                              {String(value).slice(0, 80)}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {nodes.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
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
              <span className="text-sm text-[var(--color-text-muted)]">Showing {relationships.length} relationships</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">Limit:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="bg-black/40 border border-white/20 text-white rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {relationships.map((rel, i) => {
                const relType = rel.type || rel.rel_type || 'unknown';
                const relSource = rel.source || rel.from_id || 'unknown';
                const relTarget = rel.target || rel.to_id || 'unknown';
                
                return (
                  <div key={`${relSource}-${relType}-${relTarget}-${i}`} className="bg-white/5 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-[var(--color-text-muted)]">{relSource}</span>
                      <span className="text-[var(--color-accent)] font-medium px-2 py-0.5 bg-[var(--color-accent)]/10 rounded border border-[var(--color-accent)]/20">→ {relType} →</span>
                      <span className="font-mono text-sm text-[var(--color-text-muted)]">{relTarget}</span>
                    </div>
                  </div>
                );
              })}
              {relationships.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  No relationships found. Analyze a repository first.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-white/5 mt-4">
          <Button
            onClick={() => {
              if (activeTab === 'stats') loadStats();
              else if (activeTab === 'nodes') loadNodes();
              else loadRelationships();
            }}
            size="sm"
            variant="ghost"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>
    </Card>
  );
}
