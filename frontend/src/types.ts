// TypeScript interfaces for GATeR API

// ==================== Authentication ====================
export interface User {
  login: string;
  name?: string;
  id: number;
  avatar_url?: string;
  email?: string;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_at?: number;
}

// ==================== Repository ====================
export interface Repository {
  owner: string;
  name: string;
  url: string;
  local_path?: string;
  default_branch?: string;
}

export interface RepositoryStatus {
  exists: boolean;
  analyzed: boolean;
  last_analysis?: string;
  commits_behind?: number;
  up_to_date?: boolean;
}

export interface AnalysisResults {
  repository: Repository;
  entities_extracted: number;
  relationships_detected: number;
  github_artifacts?: {
    pulls: any[];
    issues: any[];
    commits: any[];
  };
  knowledge_graph: {
    nodes: number;
    edges: number;
  };
  vector_sync?: {
    vectors_synced: number;
    timestamp: string;
  };
}

export interface AnalysisProgress {
  step: number;
  step_name: string;
  step_description: string;  // Match Flask's naming
  description?: string;      // Alias for compatibility
  details: Record<string, any>;
  start_time: number | null;
  current_step_start: number | null;
  total_steps?: number;
  percentage?: number;
  status?: 'idle' | 'analyzing' | 'completed' | 'error';
}

// ==================== Knowledge Graph ====================
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  size?: number;
  metadata?: Record<string, any>;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
  metadata?: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphStats {
  nodes: number;
  edges: number;
  entity_types: Record<string, number>;
  relationship_types: Record<string, number>;
}

export interface CodeEntity {
  id: string;
  name: string;
  type: 'function' | 'class' | 'test' | 'import' | 'variable';
  file_path: string;
  line_start: number;
  line_end: number;
  source_code?: string;
  docstring?: string;
  parameters?: string[];
  return_type?: string;
  methods?: string[];
}

// ==================== KGCompass Relevance ====================
export interface RelevanceCandidate {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  score: number;
  semantic_similarity: number;
  textual_similarity: number;
  path_length: number;
  path_decay_factor: number;
  file_path: string;
  metadata?: Record<string, any>;
}

export interface RelevanceScoring {
  success: boolean;
  step: number;
  problem_description: string;
  top_candidates: RelevanceCandidate[];
  scoring_time: number;
  debug_info?: {
    graph_stats: GraphStats;
    score_distribution: {
      min: number;
      max: number;
      mean: number;
      count_above_0_5: number;
    };
  };
}

// ==================== KUZU Database ====================
export interface KuzuStats {
  // Backend returns these names
  total_nodes?: number;
  total_relationships?: number;
  kuzu_available?: boolean;
  // Individual table counts
  codeentity_count?: number;
  commit_count?: number;
  issue_count?: number;
  pullrequest_count?: number;
  repository_count?: number;
  // Relationship counts
  belongs_to_count?: number;
  calls_count?: number;
  imports_count?: number;
  modifies_count?: number;
  tests_count?: number;
  mentions_issue_count?: number;
  mentions_pr_count?: number;
  creates_count?: number;
  uses_count?: number;
  // Legacy fields (for backward compatibility)
  node_count?: number;
  relationship_count?: number;
  tables?: string[];
  storage_size?: string;
  // Error state
  error?: string;
}

export interface KuzuNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface KuzuRelationship {
  id: string;
  type: string;
  source: string;
  target: string;
  properties?: Record<string, any>;
}

// ==================== Vector Storage ====================
export interface VectorStats {
  total_vectors: number;
  table_names: string[];
  dimensions?: number;
  index_type?: string;
}

export interface VectorSearchResult {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  similarity_score: number;
  file_path: string;
  metadata?: Record<string, any>;
}

// ==================== GATR Test Repair ====================
export interface BrokenTestInfo {
  test_name: string;
  test_file: string;
  test_code: string;
  test_class?: string;
  error_message: string;  // REQUIRED by backend
}

export interface RepairJob {
  // Legacy fields (not used by actual API)
  job_id?: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed';
  current_step?: number;
  total_steps?: number;
  message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface PipelineStep {
  step_name: string;
  step_number: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time?: number;
  end_time?: number;
  duration?: number;
  input_summary?: Record<string, any>;
  output_summary?: Record<string, any>;
  details?: Record<string, any>;
}

export interface RepairResult {
  success: boolean;
  repair_id: string;
  test_name: string;
  project_name?: string;
  repaired_code?: string;
  repair_strategy?: string;
  llm_used?: boolean;
  repair_method?: string;
  confidence?: number;
  processing_time?: number;
  context_summary?: Record<string, any>;
  pipeline_progress?: Record<string, any>;
  raw_context_details?: Record<string, any>;
  compressed_context_details?: Record<string, any>;
  aggregated_context_details?: Record<string, any>;
  retrieval_trace?: Record<string, any>;
  final_rag_prompt?: Record<string, any>;
  diff_file_path?: string;
  diff_content?: string;
  error?: string;
}

export interface ContextRetrieval {
  success: boolean;
  test_name: string;
  context: {
    kg_entities?: any[];
    vector_results?: any[];
    compressed_context?: string;
    retrieved_entities?: any[];
    code_snippets?: string[];
    [key: string]: any;
  };
  error?: string;
}

export interface GATREngineStatus {
  available: boolean;
  kg_manager_available?: boolean;
  vector_storage_available?: boolean;
  relevance_scorer_available?: boolean;
  total_repairs?: number;
  successful_repairs?: number;
  databases?: {
    kuzu?: {
      connected: boolean;
      path?: string;
      entities?: number;
      edges?: number;
    };
    lancedb?: {
      connected: boolean;
      path?: string;
      embeddings?: number;
    };
  };
  llm?: {
    provider?: string;
    model?: string;
    url?: string;
    available?: boolean;
    target_model_available?: boolean;
    installed_models?: string[];
    error?: string;
  };
  error?: string;
}

// ==================== Export ====================
export type ExportFormat = 'csv' | 'json' | 'jsonl';

export interface ExportOptions {
  format: ExportFormat;
  include_metadata?: boolean;
  filter_type?: string;
}

// ==================== API Response Wrappers ====================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

// ==================== UI State ====================
export interface AppState {
  currentRepo: Repository | null;
  repoStatus: RepositoryStatus | null;
  analysisProgress: AnalysisProgress | null;
  isAnalyzing: boolean;
  selectedNode: GraphNode | null;
  gatrJobId: string | null;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
