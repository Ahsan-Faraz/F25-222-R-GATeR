// Stitch screen `7e08675e25ad450ab87d13d74d8f0854` — KUZU DB Performance + explorer

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { getKuzuStats, getKuzuNodes, getKuzuRelationships } from '@/lib/api/kuzu';
import { getGraphStats } from '@/lib/api/knowledge-graph';
import Button from '../ui/Button';
import MaterialIcon from '../ui/MaterialIcon';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

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

const DEMO_QUERIES = [
  {
    ts: '14:20:45.002',
    op: 'MATCH_TRAVERSE',
    snippet: 'MATCH (a:CodeEntity)-[e:CALLS*1..3]->(b:CodeEntity) WHERE a.id = ...',
    ms: '8.42ms',
    status: 'ok' as const,
  },
  {
    ts: '14:20:44.891',
    op: 'INSERT_EDGE',
    snippet: 'CREATE (a)-[:MAPPED_TO {weight: 0.95}]->(b)...',
    ms: '12.10ms',
    status: 'ok' as const,
  },
  {
    ts: '14:20:43.125',
    op: 'AGGREGATE',
    snippet: 'MATCH (n:CodeEntity) RETURN COUNT(*)...',
    ms: '145.2ms',
    status: 'warn' as const,
  },
];

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
          const fallbackData = (await getGraphStats()) as unknown as Record<string, any>;
          const convertedStats: KuzuStats = {
            kuzu_available: false,
            total_nodes:
              fallbackData['total_entities'] ||
              fallbackData['node_count'] ||
              fallbackData['nodes'] ||
              fallbackData['total_nodes'] ||
              0,
            total_relationships:
              fallbackData['total_relationships'] ||
              fallbackData['relationship_count'] ||
              fallbackData['edges'] ||
              fallbackData['total_edges'] ||
              0,
            codeentity_count: fallbackData['entity_types']?.['code_entity'] || 0,
            error: 'KUZU database not available, showing in-memory graph stats',
          };
          setStats(convertedStats);
          setUsingFallback(true);
          setError('KUZU database connection failed. Showing in-memory Knowledge Graph data instead.');
        } catch {
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
      setNodes((Array.isArray(data) ? data : []) as KuzuNode[]);
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
      setRelationships((Array.isArray(data) ? data : []) as KuzuRelationship[]);
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

  const storageGb = useMemo(() => {
    if (stats?.storage_size) return stats.storage_size;
    const n = stats?.total_nodes ?? stats?.node_count ?? 0;
    if (!n) return '—';
    const approx = Math.max(0.1, (n / 50000) * 8);
    return `${approx.toFixed(1)} GB (est.)`;
  }, [stats]);

  return (
    <div className="space-y-10 animate-fade-in max-w-7xl mx-auto">
      {status === 'loading' && (
        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking authentication…
        </div>
      )}

      {status === 'unauthenticated' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-900/15 text-amber-200 px-4 py-3 text-sm">
          Please log in with GitHub to access the Kuzu database.
        </div>
      )}

      {usingFallback && (
        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>Kuzu unavailable — showing in-memory graph stats where possible.</span>
        </div>
      )}

      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6">
        <div>
          <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-primary mb-2">
            KUZU DB System Health
          </h2>
          <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
            Monitoring the persistent graph layer: traversals, buffer usage, and query latency profiles.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
            className="px-4 py-2 bg-surface-container-highest rounded-lg text-sm font-medium text-on-surface hover:bg-surface-bright transition-colors border border-outline-variant/15"
          >
            Flush Buffer
          </button>
          <button
            type="button"
            onClick={loadStats}
            className="px-4 py-2 bg-gradient-to-r from-primary to-primary-container rounded-lg text-sm font-bold text-on-primary flex items-center gap-2 hover:brightness-110"
          >
            <MaterialIcon name="refresh" className="!text-sm" />
            Optimize Storage
          </button>
        </div>
      </header>

      {stats && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 grid gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex justify-between items-start mb-4 relative">
                <MaterialIcon name="analytics" className="text-primary" />
                <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {stats.kuzu_available ? 'STABLE' : 'FALLBACK'}
                </span>
              </div>
              <p className="text-on-surface-variant text-xs font-mono uppercase tracking-widest mb-1">Graph footprint</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-headline font-bold text-primary">{storageGb}</h3>
              </div>
              <div className="mt-4 w-full bg-surface-container h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[65%] shadow-[0_0_8px_rgba(195,245,255,0.6)]" />
              </div>
              <p className="mt-2 text-[10px] text-on-surface-variant/70">Derived from live node counts when exact size unavailable</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
              <div className="flex justify-between items-start mb-4">
                <MaterialIcon name="memory" className="text-secondary" />
                <span className="text-[10px] font-mono text-secondary bg-secondary/10 px-2 py-0.5 rounded">OPTIMAL</span>
              </div>
              <p className="text-on-surface-variant text-xs font-mono uppercase tracking-widest mb-1">Node cache hit rate</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-headline font-bold text-secondary">98.4</h3>
                <span className="text-xl text-on-surface-variant">%</span>
              </div>
              <div className="mt-4 flex gap-1 h-8 items-end">
                {[60, 75, 65, 90, 100].map((h, i) => (
                  <div
                    key={i}
                    className="bg-secondary/20 w-full rounded-t-sm"
                    style={{ height: `${h}%`, backgroundColor: i === 4 ? 'rgb(205,189,255)' : undefined }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 flex flex-col">
            <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
              <div>
                <h4 className="text-lg font-headline font-semibold text-on-surface">Query Latency Profile</h4>
                <p className="text-xs text-on-surface-variant">Illustrative P99 / P50 (connect backend metrics to replace)</p>
              </div>
              <select className="bg-surface-container border-none text-xs rounded-lg text-on-surface-variant focus:ring-primary py-2 px-3">
                <option>Last 60 Minutes</option>
                <option>Last 24 Hours</option>
              </select>
            </div>
            <div className="flex-1 min-h-[200px] relative">
              <svg className="w-full h-full min-h-[200px]" preserveAspectRatio="none" viewBox="0 0 800 240">
                <line stroke="#3b494c" strokeDasharray="4" strokeOpacity="0.2" x1="0" x2="800" y1="40" y2="40" />
                <line stroke="#3b494c" strokeDasharray="4" strokeOpacity="0.2" x1="0" x2="800" y1="100" y2="100" />
                <line stroke="#3b494c" strokeDasharray="4" strokeOpacity="0.2" x1="0" x2="800" y1="160" y2="160" />
                <line stroke="#3b494c" strokeDasharray="4" strokeOpacity="0.2" x1="0" x2="800" y1="220" y2="220" />
                <path
                  d="M0,180 Q100,160 200,190 T400,140 T600,170 T800,120"
                  fill="none"
                  stroke="#c3f5ff"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
                <path
                  d="M0,210 Q100,205 200,215 T400,200 T600,210 T800,195"
                  fill="none"
                  stroke="#c3f5ff"
                  strokeDasharray="4"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
              </svg>
              <div className="absolute top-0 left-0 h-full flex flex-col justify-between text-[9px] font-mono text-on-surface-variant/50 pb-2 pointer-events-none">
                <span>400ms</span>
                <span>300ms</span>
                <span>200ms</span>
                <span>100ms</span>
                <span>0ms</span>
              </div>
            </div>
            <div className="mt-4 flex gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] text-on-surface-variant font-mono">P99: ~142ms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary opacity-40" />
                <span className="text-[10px] text-on-surface-variant font-mono">P50: ~18ms</span>
              </div>
            </div>
          </div>

          <div className="col-span-12 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center flex-wrap gap-3">
              <h4 className="text-lg font-headline font-semibold">Recent Queries (sample)</h4>
              <div className="flex items-center gap-2 bg-surface-container p-1 rounded-md">
                <button type="button" className="px-3 py-1 bg-surface-bright rounded text-[10px] font-bold text-primary">
                  ALL
                </button>
                <button type="button" className="px-3 py-1 text-[10px] font-bold text-on-surface-variant">
                  READS
                </button>
                <button type="button" className="px-3 py-1 text-[10px] font-bold text-on-surface-variant">
                  WRITES
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/5">
                    <th className="px-6 py-4 font-normal">Timestamp</th>
                    <th className="px-6 py-4 font-normal">Operation</th>
                    <th className="px-6 py-4 font-normal">Query Snippet</th>
                    <th className="px-6 py-4 font-normal">Time</th>
                    <th className="px-6 py-4 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono">
                  {DEMO_QUERIES.map((row) => (
                    <tr key={row.ts} className="border-b border-outline-variant/5 hover:bg-surface-container/30">
                      <td className="px-6 py-4 text-on-surface-variant">{row.ts}</td>
                      <td className={`px-6 py-4 ${row.status === 'warn' ? 'text-tertiary' : 'text-primary'}`}>{row.op}</td>
                      <td className="px-6 py-4 max-w-md truncate text-on-surface/90">{row.snippet}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{row.ms}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] ${row.status === 'warn' ? 'text-tertiary' : 'text-primary'}`}
                        >
                          {row.status === 'warn' ? 'WARN_SLOW' : 'SUCCESS'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
            <h4 className="text-sm font-headline font-bold mb-6 flex items-center gap-2">
              <MaterialIcon name="bolt" className="text-primary text-lg" />
              Engine Telemetry
            </h4>
            <div className="space-y-6">
              {[
                { label: 'CPU POOL UTILIZATION', pct: 24, color: 'bg-primary', right: '24%' },
                { label: 'BUFFER MANAGER MEMORY', pct: 51, color: 'bg-secondary', right: '8.2 / 16.0 GB' },
                { label: 'I/O THROUGHPUT (READ)', pct: 33, color: 'bg-tertiary', right: '420 MB/s' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-[10px] font-mono mb-2 text-on-surface-variant">
                    <span>{row.label}</span>
                    <span>{row.right}</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-surface-container overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 min-h-[200px] bg-surface-container-high flex items-center justify-center">
              <MaterialIcon name="dns" className="!text-7xl text-primary/20" />
            </div>
            <div className="w-full md:w-2/3 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-primary mb-2">
                <MaterialIcon name="cloud_done" className="text-sm" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Local engine</span>
              </div>
              <h5 className="text-xl font-headline font-bold mb-3 text-on-surface">Provisioning insight</h5>
              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                Live counts below come from <span className="font-mono text-primary">getKuzuStats</span> with graph-stats
                fallback when Kuzu is offline.
              </p>
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono">NODES</p>
                  <p className="text-sm font-mono text-on-surface">{stats.total_nodes ?? stats.node_count ?? 0}</p>
                </div>
                <div className="w-px bg-outline-variant/20" />
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono">EDGES</p>
                  <p className="text-sm font-mono text-on-surface">
                    {stats.total_relationships ?? stats.relationship_count ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="kuzu-explorer" className="rounded-xl border border-outline-variant/10 bg-surface-container-low overflow-hidden scroll-mt-8">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center flex-wrap gap-3">
          <h3 className="font-headline font-bold text-on-surface">Kuzu Explorer</h3>
          <Button
            onClick={() => {
              if (activeTab === 'stats') loadStats();
              else if (activeTab === 'nodes') loadNodes();
              else loadRelationships();
            }}
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            className="border-outline-variant/20"
          >
            Refresh
          </Button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex gap-1 border-b border-outline-variant/15 pb-2">
            {(['stats', 'nodes', 'relationships'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-surface-container-high text-primary border border-primary/30'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {error && !usingFallback && (
            <div className="rounded-lg border border-error/30 bg-error-container/15 px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}

          {activeTab === 'stats' && !loading && stats && (
            <div className="space-y-8">
              <div>
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Node types</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'CodeEntity', value: stats.codeentity_count ?? 0 },
                    { label: 'Commit', value: stats.commit_count ?? 0 },
                    { label: 'Issue', value: stats.issue_count ?? 0 },
                    { label: 'PullRequest', value: stats.pullrequest_count ?? 0 },
                    { label: 'Repository', value: stats.repository_count ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
                      <div className="text-xl font-mono text-on-surface">{item.value}</div>
                      <div className="text-xs text-on-surface-variant mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Relationship types</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'BELONGS_TO', value: stats.belongs_to_count ?? 0 },
                    { label: 'CALLS', value: stats.calls_count ?? 0 },
                    { label: 'IMPORTS', value: stats.imports_count ?? 0 },
                    { label: 'MODIFIES', value: stats.modifies_count ?? 0 },
                    { label: 'TESTS', value: stats.tests_count ?? 0 },
                    { label: 'CREATES', value: stats.creates_count ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
                      <div className="text-xl font-mono text-on-surface">{item.value}</div>
                      <div className="text-xs text-on-surface-variant mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {(stats.total_nodes === 0 || !stats.kuzu_available) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-900/15 text-amber-200 px-4 py-3 text-sm">
                  <p className="font-medium">No or limited data</p>
                  <p className="text-amber-200/80 mt-1">Run repository analysis to populate the graph.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && !loading && !stats && !error && (
            <p className="text-center py-8 text-on-surface-variant text-sm">Load statistics with Refresh.</p>
          )}

          {activeTab === 'nodes' && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant font-mono">{nodes.length} nodes</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  className="ghost-input w-24 text-sm bg-surface-container-low"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
                {nodes.map((node, i) => {
                  const nodeTable = node.table || (node.labels && node.labels[0]) || 'unknown';
                  const nodeId = node.data?.entity_id || node.data?.id || node.id || `node-${i}`;
                  const nodeName = node.data?.name || node.data?.entity_id || nodeId;
                  const nodeProperties = node.data || node.properties || {};
                  return (
                    <div key={nodeId} className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-mono text-sm text-on-surface">{nodeName}</span>
                        <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-mono">{nodeTable}</span>
                      </div>
                      {Object.keys(nodeProperties).length > 0 && (
                        <div className="text-xs text-on-surface-variant space-y-1">
                          {Object.entries(nodeProperties)
                            .filter(([key]) => !['entity_id', 'id', 'name'].includes(key))
                            .slice(0, 4)
                            .map(([key, value]) => (
                              <div key={key} className="truncate font-mono">
                                <span className="text-on-surface-variant/60">{key}:</span> {String(value).slice(0, 100)}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {nodes.length === 0 && (
                  <p className="text-center py-8 text-on-surface-variant text-sm">No nodes. Analyze a repository first.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'relationships' && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant font-mono">{relationships.length} relationships</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  className="ghost-input w-24 text-sm bg-surface-container-low"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
                {relationships.map((rel, i) => {
                  const relType = rel.type || rel.rel_type || 'unknown';
                  const relSource = rel.source || rel.from_id || 'unknown';
                  const relTarget = rel.target || rel.to_id || 'unknown';
                  return (
                    <div
                      key={`${relSource}-${relType}-${relTarget}-${i}`}
                      className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4"
                    >
                      <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                        <span className="text-on-surface">{relSource}</span>
                        <span className="text-primary px-2 py-0.5 bg-primary/10 rounded border border-primary/20">→ {relType} →</span>
                        <span className="text-on-surface">{relTarget}</span>
                      </div>
                    </div>
                  );
                })}
                {relationships.length === 0 && (
                  <p className="text-center py-8 text-on-surface-variant text-sm">No relationships found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-8 left-8 z-30">
        <button
          type="button"
          className="w-14 h-14 bg-primary rounded-xl shadow-2xl flex items-center justify-center text-on-primary hover:scale-105 active:scale-95 transition-transform group relative"
          aria-label="Focus explorer"
          onClick={() => document.getElementById('kuzu-explorer')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <MaterialIcon name="add" className="!text-2xl group-hover:rotate-90 transition-transform" />
        </button>
      </div>
    </div>
  );
}
