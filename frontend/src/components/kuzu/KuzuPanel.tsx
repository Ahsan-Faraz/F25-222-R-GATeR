// KUZU Database Panel Component

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getKuzuStats, getKuzuNodes, getKuzuRelationships } from '@/lib/api/kuzu';
import { getGraphStats } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface KuzuStats {
  // Backend field names
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
  // Legacy fields
  node_count?: number;
  relationship_count?: number;
  tables?: string[];
  storage_size?: string;
  // Error state
  error?: string;
}

// Backend returns nodes as: { table: string, data: {...} }
interface KuzuNode {
  table?: string;
  data?: Record<string, any>;
  // Legacy format support
  id?: string;
  labels?: string[];
  properties?: Record<string, any>;
}

interface KuzuRelationship {
  type?: string;
  source?: string;
  target?: string;
  properties?: Record<string, any>;
  // Backend format
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

  // Track authentication status
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
      console.log('[KuzuPanel] Fetching stats from /kuzu/stats...');
      const data = await getKuzuStats();
      console.log('[KuzuPanel] Received stats:', data);
      
      // Check if backend returned an error in the response body
      if (data && 'error' in data && data.error) {
        console.log('[KuzuPanel] KUZU not available, trying fallback to knowledge-graph/stats...');
        
        // Try fallback to in-memory knowledge graph
        try {
          const fallbackData = await getGraphStats();
          console.log('[KuzuPanel] Fallback data:', fallbackData);
          
          // Convert fallback format to KuzuStats format
          const convertedStats: KuzuStats = {
            kuzu_available: false,
            total_nodes: fallbackData.total_entities || fallbackData.node_count || 0,
            total_relationships: fallbackData.total_relationships || fallbackData.relationship_count || 0,
            codeentity_count: fallbackData.entity_types?.code_entity || 0,
            error: 'KUZU database not available, showing in-memory graph stats'
          };
          
          setStats(convertedStats);
          setUsingFallback(true);
          setError('KUZU database connection failed. Showing in-memory Knowledge Graph data instead. Try restarting the backend server.');
        } catch (fallbackErr) {
          // Both failed
          setError('KUZU database not available and fallback also failed. Please restart the backend.');
          setStats(data);
        }
      } else {
        setStats(data);
      }
    } catch (err: any) {
      console.error('[KuzuPanel] Error fetching stats:', err);
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
      // Ensure we always have an array
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
      // Ensure we always have an array
      setRelationships(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load relationships');
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  };

  // Load stats when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'nodes') {
        loadNodes();
      } else if (activeTab === 'relationships') {
        loadRelationships();
      }
    }
  }, [activeTab, limit, isAuthenticated]);

  return (
    <Card title="KUZU Database Explorer">
      <div className="space-y-4">
        <p className="text-gray-600 text-sm">
          Explore the persistent knowledge graph stored in KUZU database.
        </p>

        {/* Auth Status */}
        {status === 'loading' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-3 text-sm">
            Checking authentication status...
          </div>
        )}
        
        {status === 'unauthenticated' && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
            Please log in with GitHub to access KUZU database features.
          </div>
        )}

        {/* Fallback indicator */}
        {usingFallback && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-3 text-sm">
            <strong>⚠️ Using In-Memory Graph:</strong> KUZU database is unavailable. Showing data from the in-memory NetworkX graph instead.
            <br />
            <span className="text-xs">To fix: Restart the backend server (python web_server.py)</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          {(['stats', 'nodes', 'relationships'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Error - only show if not using fallback (fallback has its own message) */}
        {error && !usingFallback && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 whitespace-pre-line">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && !loading && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.total_nodes ?? stats.node_count ?? 0}</div>
                <div className="text-sm text-gray-600">Total Nodes</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.total_relationships ?? stats.relationship_count ?? 0}</div>
                <div className="text-sm text-gray-600">Relationships</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.kuzu_available ? '✓' : '✗'}</div>
                <div className="text-sm text-gray-600">DB Status</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <div className="text-xl font-bold text-orange-600">{stats.codeentity_count ?? 0}</div>
                <div className="text-sm text-gray-600">Code Entities</div>
              </div>
            </div>
            
            {/* Detailed breakdown */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Node Types</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                <div><span className="font-medium">CodeEntity:</span> {stats.codeentity_count ?? 0}</div>
                <div><span className="font-medium">Commit:</span> {stats.commit_count ?? 0}</div>
                <div><span className="font-medium">Issue:</span> {stats.issue_count ?? 0}</div>
                <div><span className="font-medium">PullRequest:</span> {stats.pullrequest_count ?? 0}</div>
                <div><span className="font-medium">Repository:</span> {stats.repository_count ?? 0}</div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Relationship Types</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div><span className="font-medium">BELONGS_TO:</span> {stats.belongs_to_count ?? 0}</div>
                <div><span className="font-medium">CALLS:</span> {stats.calls_count ?? 0}</div>
                <div><span className="font-medium">IMPORTS:</span> {stats.imports_count ?? 0}</div>
                <div><span className="font-medium">MODIFIES:</span> {stats.modifies_count ?? 0}</div>
                <div><span className="font-medium">TESTS:</span> {stats.tests_count ?? 0}</div>
                <div><span className="font-medium">CREATES:</span> {stats.creates_count ?? 0}</div>
              </div>
            </div>
            
            {/* Debug info */}
            {(stats.total_nodes === 0 || !stats.kuzu_available) && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
                <p className="font-medium">No data in KUZU database</p>
                <p>To populate the database, analyze a GitHub repository using the Repository Manager panel.</p>
              </div>
            )}
          </div>
        )}
        
        {/* No stats loaded yet */}
        {activeTab === 'stats' && !loading && !stats && !error && (
          <div className="text-center py-8 text-gray-500">
            <p>Click "Refresh" to load KUZU database statistics.</p>
          </div>
        )}

        {/* Nodes Tab */}
        {activeTab === 'nodes' && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Showing {nodes.length} nodes</span>
              <div className="flex items-center gap-2">
                <span className="text-sm">Limit:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="border rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {nodes.map((node, i) => {
                // Handle backend format: { table: string, data: {...} }
                const nodeTable = node.table || (node.labels && node.labels[0]) || 'unknown';
                const nodeId = node.data?.entity_id || node.data?.id || node.id || `node-${i}`;
                const nodeName = node.data?.name || node.data?.entity_id || nodeId;
                const nodeProperties = node.data || node.properties || {};
                
                return (
                  <div key={nodeId} className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-primary">{nodeName}</span>
                      <span className="text-xs bg-accent bg-opacity-20 text-accent px-2 py-0.5 rounded-full">
                        {nodeTable}
                      </span>
                    </div>
                    {Object.keys(nodeProperties).length > 0 && (
                      <div className="text-xs text-gray-600">
                        {Object.entries(nodeProperties)
                          .filter(([key]) => !['entity_id', 'id', 'name'].includes(key))
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <span key={key} className="mr-3">
                              <strong>{key}:</strong> {String(value).slice(0, 50)}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {nodes.length === 0 && (
                <div className="text-center py-8 text-gray-500">
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
              <span className="text-sm text-gray-600">Showing {relationships.length} relationships</span>
              <div className="flex items-center gap-2">
                <span className="text-sm">Limit:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="border rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {relationships.map((rel, i) => {
                const relType = rel.type || rel.rel_type || 'unknown';
                const relSource = rel.source || rel.from_id || 'unknown';
                const relTarget = rel.target || rel.to_id || 'unknown';
                
                return (
                  <div key={`${relSource}-${relType}-${relTarget}-${i}`} className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-gray-700">{relSource}</span>
                      <span className="text-accent font-medium">→ {relType} →</span>
                      <span className="font-mono text-sm text-gray-700">{relTarget}</span>
                    </div>
                  </div>
                );
              })}
              {relationships.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No relationships found. Analyze a repository first.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (activeTab === 'stats') loadStats();
              else if (activeTab === 'nodes') loadNodes();
              else loadRelationships();
            }}
            size="sm"
            variant="secondary"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>
    </Card>
  );
}
