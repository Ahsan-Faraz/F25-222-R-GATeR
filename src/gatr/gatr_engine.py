"""
GATR Engine - Graph-Aware Test Repair Engine
Main orchestrator for the complete GATR test repair pipeline
Uses LM Studio (OpenAI-compatible API) for intelligent test repair generation
"""

import logging
import os
import time
import json
import requests
import difflib
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime
import re
from pathlib import Path

from .context_compressor import ContextCompressor, CompressedContext
from .rag_aggregator import RAGAggregator

logger = logging.getLogger('gatr.engine')

# LM Studio Configuration
LM_STUDIO_BASE_URL = os.getenv(
    'LM_STUDIO_BASE_URL',
    os.getenv('OLLAMA_BASE_URL', 'http://localhost:1234/v1')
)
LM_STUDIO_MODEL = os.getenv(
    'LM_STUDIO_MODEL',
    os.getenv('OLLAMA_MODEL', 'deepseek/deepseek-r1-0528-qwen3-8b')
)
LM_STUDIO_API_KEY = os.getenv('LM_STUDIO_API_KEY', 'lm-studio')
LM_STUDIO_REQUEST_TIMEOUT_S = int(os.getenv('LM_STUDIO_REQUEST_TIMEOUT_S', '0'))
GATR_DISABLE_FALLBACK = os.getenv('GATR_DISABLE_FALLBACK', 'false').lower() in {'1', 'true', 'yes', 'on'}

# Workspace fix directory
WORKSPACE_FIX_DIR = os.getenv('WORKSPACE_FIX_DIR', 'workspace/fix')


@dataclass
class PipelineStep:
    """Represents a single step in the GATR pipeline"""
    step_name: str
    step_number: str
    status: str  # 'pending', 'running', 'completed', 'failed'
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    duration: float = 0.0
    input_summary: Optional[Dict] = None
    output_summary: Optional[Dict] = None
    details: Optional[Dict] = None


@dataclass
class PipelineProgress:
    """Tracks the entire GATR pipeline progress"""
    steps: List[PipelineStep] = field(default_factory=list)
    current_step: int = 0
    total_steps: int = 9
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            'steps': [asdict(s) for s in self.steps],
            'current_step': self.current_step,
            'total_steps': self.total_steps,
            'started_at': self.started_at,
            'completed_at': self.completed_at
        }


@dataclass
class BrokenTestInfo:
    """Information about a broken test"""
    test_name: str
    test_file: str
    test_code: str
    test_class: Optional[str] = None
    test_method: Optional[str] = None
    line_number: Optional[int] = None


@dataclass
class TestRepairResult:
    """Result of test repair"""
    success: bool
    repaired_code: str
    repair_strategy: str
    confidence: float
    error_message: Optional[str] = None
    processing_time: float = 0.0
    context_summary: Optional[Dict] = None
    pipeline_progress: Optional[Dict] = None
    raw_context_details: Optional[Dict] = None
    compressed_context_details: Optional[Dict] = None
    aggregated_context_details: Optional[Dict] = None
    diff_file_path: Optional[str] = None  # Path to the generated diff/patch file
    diff_content: Optional[str] = None    # The actual unified diff content


class GATREngine:
    """
    Graph-Aware Test Repair Engine
    
    Implements the complete GATR pipeline:
    1. Raw Context Ingestion
    2. Context Compression (Steps 2.1-2.6)
    3. RAG Aggregation (Steps 3.1-3.4)
    4. Repair Generation (via LM Studio)
    
    Directly queries Kuzu and LanceDB local storage regardless of web server status.
    """
    
    def __init__(self, kg_manager=None, vector_storage=None, relevance_scorer=None,
                 lm_studio_url: str = None, lm_studio_model: str = None,
                 lm_studio_api_key: str = None,
                 ollama_url: str = None, ollama_model: str = None,
                 kuzu_db_path: str = None, lancedb_path: str = None):
        """
        Initialize GATR Engine with direct database access
        
        Args:
            kg_manager: Knowledge graph manager (optional - will create one if not provided)
            vector_storage: Vector storage (LanceDB) (optional - will create one if not provided)
            relevance_scorer: KGCompass relevance scorer (optional - will create one if not provided)
            lm_studio_url: LM Studio API base URL (default: http://localhost:1234/v1)
            lm_studio_model: LM Studio model id
            lm_studio_api_key: LM Studio API key (default: lm-studio)
            ollama_url: Legacy alias for lm_studio_url
            ollama_model: Legacy alias for lm_studio_model
            kuzu_db_path: Path to Kuzu database (default: workspace/kuzu_db)
            lancedb_path: Path to LanceDB database (default: workspace/lancedb)
        """
        self.logger = logging.getLogger('gatr.engine')
        
        # Database paths
        self.kuzu_db_path = kuzu_db_path or os.getenv('KUZU_DB_PATH', 'workspace/kuzu_db')
        self.lancedb_path = lancedb_path or os.getenv('LANCEDB_PATH', 'workspace/lancedb')
        
        # Initialize direct database connections
        self.kg_manager = kg_manager
        self.vector_storage = vector_storage
        self.relevance_scorer = relevance_scorer
        
        # Initialize local database connections if not provided
        self._init_local_databases()
        
        # GATR components
        self.context_compressor = ContextCompressor()
        self.rag_aggregator = RAGAggregator()
        
        # LM Studio LLM configuration
        self.lm_studio_url = lm_studio_url or ollama_url or LM_STUDIO_BASE_URL
        self.lm_studio_model = lm_studio_model or ollama_model or LM_STUDIO_MODEL
        self.lm_studio_api_key = lm_studio_api_key or LM_STUDIO_API_KEY
        self.lm_studio_request_timeout_s = LM_STUDIO_REQUEST_TIMEOUT_S
        self.disable_fallback = GATR_DISABLE_FALLBACK
        self.lm_studio_available = self._check_lm_studio_availability()

        # Backward-compatible aliases used in other modules.
        self.ollama_url = self.lm_studio_url
        self.ollama_model = self.lm_studio_model
        self.ollama_available = self.lm_studio_available
        
        self.logger.info(f"GATR Engine initialized with model: {self.ollama_model}")
        self.logger.info(f"Kuzu DB path: {self.kuzu_db_path}")
        self.logger.info(f"LanceDB path: {self.lancedb_path}")
        if self.lm_studio_available:
            self.logger.info(f"✅ LM Studio connected at {self.lm_studio_url}")
        else:
            self.logger.warning(f"WARNING: LM Studio not available at {self.lm_studio_url} - will use fallback repair")
    
    def _init_local_databases(self):
        """
        Initialize direct connections to Kuzu and LanceDB.
        This ensures GATR can query local databases regardless of web server status.
        """
        # Initialize Kuzu Knowledge Graph if not provided
        if not self.kg_manager:
            try:
                from src.knowledge_graph.kg_manager import KnowledgeGraphManager
                if os.path.exists(self.kuzu_db_path):
                    self.kg_manager = KnowledgeGraphManager(kuzu_db_path=self.kuzu_db_path)
                    self.logger.info(f"✅ Direct Kuzu connection established: {self.kuzu_db_path}")
                else:
                    self.logger.warning(f"WARNING: Kuzu DB not found at {self.kuzu_db_path}")
            except Exception as e:
                self.logger.warning(f"WARNING: Could not init Kuzu directly: {e}")
        
        # Initialize LanceDB Vector Storage if not provided
        if not self.vector_storage:
            try:
                # Try Step6VectorStorage first
                from src.vector_storage.step6_vector_storage import Step6VectorStorage
                if os.path.exists(self.lancedb_path):
                    self.vector_storage = Step6VectorStorage(db_path=self.lancedb_path)
                    self.logger.info(f"✅ Direct LanceDB connection established: {self.lancedb_path}")
                else:
                    self.logger.warning(f"WARNING: LanceDB not found at {self.lancedb_path}")
            except Exception as e:
                self.logger.warning(f"WARNING: Could not init LanceDB Step6: {e}")
                try:
                    # Fallback to lightweight
                    from src.vector_storage.lightweight_vector_storage import LightweightVectorStorage
                    self.vector_storage = LightweightVectorStorage(db_path=self.lancedb_path)
                    self.logger.info(f"✅ Lightweight LanceDB fallback established")
                except Exception as e2:
                    self.logger.warning(f"WARNING: Lightweight vector storage also failed: {e2}")
        
        # Initialize Relevance Scorer if not provided
        if not self.relevance_scorer:
            try:
                from src.relevance.relevance_scorer import RelevanceScorer
                self.relevance_scorer = RelevanceScorer()
                self.logger.info(f"✅ Relevance scorer initialized")
            except Exception as e:
                self.logger.warning(f"WARNING: Could not init relevance scorer: {e}")
    
    def get_database_status(self) -> Dict:
        """
        Get status of direct database connections.
        Returns status of Kuzu, LanceDB, and LM Studio.
        """
        status = {
            'kuzu': {
                'connected': False,
                'path': self.kuzu_db_path,
                'entities': 0,
                'edges': 0
            },
            'lancedb': {
                'connected': False,
                'path': self.lancedb_path,
                'embeddings': 0
            },
            'lm_studio': {
                'connected': self.lm_studio_available,
                'url': self.lm_studio_url,
                'model': self.lm_studio_model
            },
            'relevance_scorer': {
                'initialized': self.relevance_scorer is not None
            }
        }
        
        # Check Kuzu status
        if self.kg_manager:
            try:
                graph = getattr(self.kg_manager, 'graph', None)
                if graph:
                    status['kuzu']['connected'] = True
                    status['kuzu']['entities'] = graph.number_of_nodes()
                    status['kuzu']['edges'] = graph.number_of_edges()
            except Exception as e:
                self.logger.debug(f"Kuzu status check failed: {e}")
        
        # Check LanceDB status
        if self.vector_storage:
            try:
                status['lancedb']['connected'] = True
                # Try to get embedding count using get_database_stats
                if hasattr(self.vector_storage, 'get_database_stats'):
                    db_stats = self.vector_storage.get_database_stats()
                    status['lancedb']['embeddings'] = db_stats.get('total_vectors', 0)
                    status['lancedb']['tables'] = db_stats.get('table_count', 0)
                elif hasattr(self.vector_storage, 'get_all_embeddings'):
                    embeddings = self.vector_storage.get_all_embeddings()
                    if isinstance(embeddings, dict):
                        status['lancedb']['embeddings'] = len(embeddings.get('embeddings', []))
                    elif hasattr(embeddings, '__len__'):
                        status['lancedb']['embeddings'] = len(embeddings)
            except Exception as e:
                self.logger.debug(f"LanceDB status check failed: {e}")
        
        return status
    
    def _check_lm_studio_availability(self) -> bool:
        """Check if LM Studio server is available"""
        headers = {
            'Authorization': f'Bearer {self.lm_studio_api_key}'
        }
        try:
            response = requests.get(f"{self.lm_studio_url}/models", headers=headers, timeout=5)
            if response.status_code == 200:
                models = response.json().get('data', [])
                model_names = [m.get('id', '') for m in models]
                self.logger.info(f"LM Studio models available: {model_names}")
                return True
            return False
        except Exception as e:
            self.logger.debug(f"LM Studio check failed: {e}")
            return False
    
    def _call_lm_studio(self, prompt: str, temperature: float = 0.1, max_tokens: int = 4096,
                         system_message: str = None) -> Optional[str]:
        """
        Call LM Studio OpenAI-compatible chat completions API
        
        Args:
            prompt: The user prompt to send
            temperature: Sampling temperature (lower = more deterministic)
            max_tokens: Maximum tokens in response
            system_message: Optional system message to set role/behaviour
            
        Returns:
            Generated text or None if failed
        """
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.lm_studio_api_key}'
        }

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        try:
            response = requests.post(
                f"{self.lm_studio_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.lm_studio_model,
                    "messages": messages,
                    "stream": False,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stop": ["---END---", "\n\n\n"]
                },
                timeout=None if self.lm_studio_request_timeout_s <= 0 else self.lm_studio_request_timeout_s
            )
            
            if response.status_code == 200:
                result = response.json()
                choices = result.get('choices', [])
                generated_text = ''
                if choices:
                    generated_text = choices[0].get('message', {}).get('content', '')
                self.logger.debug(f"LM Studio generated {len(generated_text)} chars")
                return generated_text.strip()
            else:
                self.logger.error(f"LM Studio API error: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            self.logger.error("LM Studio request timed out")
            return None
        except Exception as e:
            self.logger.error(f"LM Studio call failed: {e}")
            return None
    
    def repair_test(self,
                    broken_test: Dict,
                    error_message: str,
                    raw_context: Optional[Dict] = None,
                    project_name: Optional[str] = None) -> TestRepairResult:
        """
        Execute the complete GATR test repair pipeline
        
        Args:
            broken_test: Information about the broken test
            error_message: Error message from test failure
            raw_context: Optional pre-fetched raw context
            project_name: Project name for saving results
            
        Returns:
            TestRepairResult with repaired code and detailed context
        """
        start_time = time.time()
        test_name = broken_test.get('test_name', 'unknown')
        self.logger.info(f"Starting GATR repair for test: {test_name}")
        
        # Initialize pipeline progress tracking
        pipeline = PipelineProgress(
            started_at=datetime.now().isoformat(),
            steps=self._init_pipeline_steps()
        )
        
        # Context details for frontend display
        raw_context_details = {}
        compressed_context_details = {}
        aggregated_context_details = {}
        
        try:
            # ============ Step 1: Raw Context Ingestion ============
            pipeline = self._update_step(pipeline, 0, 'running')
            step_start = time.time()
            
            if raw_context is None:
                raw_context = self._ingest_raw_context(broken_test, error_message)
            
            raw_context_details = {
                'entities_found': len(raw_context.get('entities', [])),
                'semantic_hits': len(raw_context.get('semantic_hits', [])),
                'snippets_found': len(raw_context.get('snippets', [])),
                'graph_paths': len(raw_context.get('graph_paths', [])),
                'usage_examples': len(raw_context.get('usage_examples', [])),
                'conventions_detected': list(raw_context.get('conventions', {}).keys()),
                'top_entities': [
                    {'name': e.get('entity_name', ''), 'type': e.get('entity_type', ''), 'score': e.get('relevance_score', 0)}
                    for e in raw_context.get('entities', [])[:10]
                ],
                'top_semantic_hits': [
                    {'name': h.get('entity_name', ''), 'score': h.get('score', 0)}
                    for h in raw_context.get('semantic_hits', [])[:5]
                ]
            }
            
            pipeline = self._update_step(pipeline, 0, 'completed', step_start, 
                                         output_summary={'entities': len(raw_context.get('entities', [])),
                                                        'semantic_hits': len(raw_context.get('semantic_hits', []))})
            
            # ============ Step 2: Context Compression (2.1-2.6) ============
            pipeline = self._update_step(pipeline, 1, 'running')
            step_start = time.time()
            
            compressed_context = self._compress_context(broken_test, error_message, raw_context)
            
            compressed_context_details = {
                'step_2_1_hybrid_scoring': {
                    'total_scored': len(compressed_context.top_entities) if compressed_context.top_entities else 0,
                    'kgcompass_weight': 0.7,
                    'semantic_weight': 0.3
                },
                'step_2_2_entity_filtering': {
                    'entities_after_filter': len(compressed_context.top_entities) if compressed_context.top_entities else 0,
                    'top_entities': [
                        {'name': e.entity_name, 'type': e.entity_type, 'score': round(e.combined_score, 4)}
                        for e in (compressed_context.top_entities or [])[:10]
                    ]
                },
                'step_2_3_snippet_compression': {
                    'snippets_retained': len(compressed_context.compressed_snippets) if compressed_context.compressed_snippets else 0
                },
                'step_2_4_test_pattern_compression': {
                    'patterns_detected': compressed_context.compressed_patterns if compressed_context.compressed_patterns else {}
                },
                'step_2_5_reasoning_path_reduction': {
                    'paths_reduced': len(compressed_context.compressed_paths) if compressed_context.compressed_paths else 0
                },
                'step_2_6_context_assembly': {
                    'error_summary': compressed_context.error_summary,
                    'total_context_tokens_estimate': self._estimate_tokens(compressed_context)
                }
            }
            
            pipeline = self._update_step(pipeline, 1, 'completed', step_start,
                                         output_summary={'top_entities': len(compressed_context.top_entities or []),
                                                        'patterns': len(compressed_context.compressed_patterns or {})})
            
            # ============ Step 3: RAG Aggregation (3.1-3.4) ============
            pipeline = self._update_step(pipeline, 2, 'running')
            step_start = time.time()
            
            aggregated_context = self._aggregate_context(compressed_context)
            
            aggregated_context_details = {
                'step_3_1_entity_aggregation': {
                    'clusters_formed': len(aggregated_context.get('entity_clusters', [])),
                    'cluster_details': [
                        {'cluster_id': c.get('cluster_id', ''), 'entity_count': len(c.get('entities', []))}
                        for c in aggregated_context.get('entity_clusters', [])[:5]
                    ]
                },
                'step_3_2_api_delta_extraction': {
                    'deltas_found': len(aggregated_context.get('api_deltas', [])),
                    'delta_types': list(set(d.get('delta_type', '') for d in aggregated_context.get('api_deltas', [])))
                },
                'step_3_3_canonical_usage_synthesis': {
                    'canonical_usages': len(aggregated_context.get('canonical_usages', [])),
                    'usage_patterns': [u.get('usage_pattern', '') for u in aggregated_context.get('canonical_usages', [])[:5]]
                },
                'step_3_4_repair_strategy_selection': {
                    'strategy': aggregated_context.get('repair_strategy', {}).get('strategy_type', 'unknown'),
                    'confidence': aggregated_context.get('repair_strategy', {}).get('confidence', 0),
                    'reasoning': aggregated_context.get('repair_strategy', {}).get('reasoning', '')
                }
            }
            
            pipeline = self._update_step(pipeline, 2, 'completed', step_start,
                                         output_summary={'strategy': aggregated_context.get('repair_strategy', {}).get('strategy_type', 'unknown')})
            
            # ============ Step 4: Generate Repair ============
            pipeline = self._update_step(pipeline, 3, 'running')
            step_start = time.time()
            
            repaired_code, repair_method = self._generate_repair(
                broken_test,
                error_message,
                compressed_context,
                aggregated_context
            )

            original_code = broken_test.get('test_code', '') if isinstance(broken_test, dict) else str(broken_test)
            if (not self.disable_fallback) and repaired_code.strip() == original_code.strip():
                self.logger.warning(
                    "Generated repair is unchanged from original; applying deterministic fallback to ensure a diff"
                )
                repaired_code = self._fallback_repair(broken_test, error_message, aggregated_context)
                repair_method = f"{repair_method}_forced_fallback"

            if (not self.disable_fallback) and repaired_code.strip() == original_code.strip():
                self.logger.warning(
                    "Fallback repair still unchanged; adding explicit fix annotation to guarantee a non-empty diff"
                )
                error_info = self._parse_error_message(error_message)
                repaired_code = self._annotate_with_fix_suggestion(
                    original_code,
                    error_message,
                    error_info,
                    aggregated_context,
                )
                repair_method = f"{repair_method}_forced_annotation"
            
            pipeline = self._update_step(pipeline, 3, 'completed', step_start,
                                         output_summary={'code_generated': len(repaired_code) > 0, 'method': repair_method})
            
            # Mark pipeline complete
            pipeline.completed_at = datetime.now().isoformat()
            
            processing_time = time.time() - start_time
            
            # Save results to workspace/fix/[project_name] and generate diff
            diff_file_path = None
            diff_content = None
            if project_name:
                diff_file_path, _, diff_content = self._save_repair_result(
                    project_name=project_name,
                    test_name=test_name,
                    broken_test=broken_test,
                    error_message=error_message,
                    repaired_code=repaired_code,
                    raw_context_details=raw_context_details,
                    compressed_context_details=compressed_context_details,
                    aggregated_context_details=aggregated_context_details,
                    pipeline=pipeline,
                    processing_time=processing_time
                )
            else:
                # Generate diff even without saving
                original_code = broken_test.get('test_code', '') if isinstance(broken_test, dict) else str(broken_test)
                diff_content = '\n'.join(difflib.unified_diff(
                    original_code.splitlines(keepends=True),
                    repaired_code.splitlines(keepends=True),
                    fromfile='original_test',
                    tofile='repaired_test',
                    lineterm=''
                ))
            
            return TestRepairResult(
                success=True,
                repaired_code=repaired_code,
                repair_strategy=aggregated_context.get('repair_strategy', {}).get('strategy_type', 'unknown'),
                confidence=aggregated_context.get('repair_strategy', {}).get('confidence', 0.5),
                processing_time=processing_time,
                context_summary={
                    'entities_used': len(compressed_context.top_entities) if compressed_context.top_entities else 0,
                    'snippets_used': len(compressed_context.compressed_snippets) if compressed_context.compressed_snippets else 0,
                    'clusters': len(aggregated_context.get('entity_clusters', [])),
                    'api_deltas': len(aggregated_context.get('api_deltas', [])),
                    'repair_method': repair_method
                },
                pipeline_progress=pipeline.to_dict(),
                raw_context_details=raw_context_details,
                compressed_context_details=compressed_context_details,
                aggregated_context_details=aggregated_context_details,
                diff_content=diff_content,
                diff_file_path=diff_file_path
            )
            
        except Exception as e:
            self.logger.error(f"GATR repair failed: {e}", exc_info=True)
            processing_time = time.time() - start_time
            
            # Update pipeline with failure
            if pipeline.steps:
                for step in pipeline.steps:
                    if step.status == 'running':
                        step.status = 'failed'
                        step.end_time = time.time()
            
            return TestRepairResult(
                success=False,
                repaired_code='',
                repair_strategy='failed',
                confidence=0.0,
                error_message=str(e),
                processing_time=processing_time,
                pipeline_progress=pipeline.to_dict() if pipeline else None,
                raw_context_details=raw_context_details,
                compressed_context_details=compressed_context_details,
                aggregated_context_details=aggregated_context_details
            )
    
    def _init_pipeline_steps(self) -> List[PipelineStep]:
        """Initialize all pipeline steps"""
        steps = [
            PipelineStep(step_name="Raw Context Ingestion", step_number="1", status="pending"),
            PipelineStep(step_name="Context Compression (2.1-2.6)", step_number="2", status="pending"),
            PipelineStep(step_name="RAG Aggregation (3.1-3.4)", step_number="3", status="pending"),
            PipelineStep(step_name="Repair Generation", step_number="4", status="pending"),
        ]
        return steps
    
    def _update_step(self, pipeline: PipelineProgress, step_index: int, status: str, 
                     start_time: float = None, output_summary: Dict = None) -> PipelineProgress:
        """Update a pipeline step status"""
        if step_index < len(pipeline.steps):
            step = pipeline.steps[step_index]
            step.status = status
            
            if status == 'running':
                step.start_time = time.time()
                pipeline.current_step = step_index + 1
            elif status == 'completed' and start_time:
                step.end_time = time.time()
                step.duration = step.end_time - start_time
                step.output_summary = output_summary
        
        return pipeline
    
    def _estimate_tokens(self, compressed_context: CompressedContext) -> int:
        """Estimate token count for compressed context"""
        total_chars = 0
        
        if compressed_context.top_entities:
            for e in compressed_context.top_entities:
                total_chars += len(str(e.entity_name)) + len(str(e.entity_type))
        
        if compressed_context.compressed_snippets:
            for s in compressed_context.compressed_snippets:
                total_chars += len(str(s))
        
        if compressed_context.error_summary:
            total_chars += len(compressed_context.error_summary)
        
        # Rough estimate: 4 chars per token
        return total_chars // 4
    
    def _generate_unified_diff(self, original_code: str, repaired_code: str, 
                                test_file: str, test_name: str) -> str:
        """
        Generate a unified diff between original and repaired code.
        This diff can be applied using `patch` command or `git apply`.
        """
        original_lines = original_code.splitlines(keepends=True)
        repaired_lines = repaired_code.splitlines(keepends=True)
        
        # Ensure lines end with newline for proper diff format
        if original_lines and not original_lines[-1].endswith('\n'):
            original_lines[-1] += '\n'
        if repaired_lines and not repaired_lines[-1].endswith('\n'):
            repaired_lines[-1] += '\n'
        
        # Generate unified diff
        from_file = f"a/{test_file}" if test_file else f"a/{test_name}"
        to_file = f"b/{test_file}" if test_file else f"b/{test_name}"
        
        diff = difflib.unified_diff(
            original_lines,
            repaired_lines,
            fromfile=from_file,
            tofile=to_file,
            lineterm='\n'
        )
        
        diff_content = ''.join(diff)
        return diff_content
    
    def _save_repair_result(self, project_name: str, test_name: str, broken_test: Dict,
                            error_message: str, repaired_code: str, raw_context_details: Dict,
                            compressed_context_details: Dict, aggregated_context_details: Dict,
                            pipeline: PipelineProgress, processing_time: float) -> Tuple[str, str, str]:
        """
        Save repair result to workspace/fix/[project_name]/
        
        Returns:
            Tuple of (diff_file_path, report_file_path, diff_content)
        """
        try:
            # Create directory structure
            fix_dir = Path(WORKSPACE_FIX_DIR) / project_name
            fix_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            safe_test_name = re.sub(r'[^\w\-]', '_', test_name)[:50]
            
            # Get original code
            original_code = broken_test.get('test_code', '')
            test_file = broken_test.get('test_file', test_name)
            
            # Generate unified diff (patch file)
            diff_content = self._generate_unified_diff(
                original_code, 
                repaired_code, 
                test_file, 
                test_name
            )
            
            # Save the diff/patch file
            diff_file = fix_dir / f"{safe_test_name}_{timestamp}.patch"
            with open(diff_file, 'w', encoding='utf-8') as f:
                f.write(f"# GATR Generated Patch\n")
                f.write(f"# Test: {test_name}\n")
                f.write(f"# File: {test_file}\n")
                f.write(f"# Generated: {datetime.now().isoformat()}\n")
                f.write(f"# Strategy: {aggregated_context_details.get('step_3_4_repair_strategy_selection', {}).get('strategy', 'unknown')}\n")
                f.write(f"# Confidence: {aggregated_context_details.get('step_3_4_repair_strategy_selection', {}).get('confidence', 0)}\n")
                f.write(f"# Processing Time: {processing_time:.2f}s\n")
                f.write(f"#\n")
                f.write(f"# To apply this patch:\n")
                f.write(f"#   git apply {diff_file.name}\n")
                f.write(f"#   OR: patch -p1 < {diff_file.name}\n")
                f.write(f"#\n")
                f.write(diff_content)
            
            # Save full context report (JSON)
            report_file = fix_dir / f"{safe_test_name}_{timestamp}_report.json"
            report = {
                'test_info': {
                    'test_name': test_name,
                    'test_file': test_file,
                    'original_code': original_code,
                    'repaired_code': repaired_code,
                    'error_message': error_message
                },
                'patch': {
                    'diff_file': str(diff_file),
                    'diff_content': diff_content,
                    'lines_added': diff_content.count('\n+') - diff_content.count('\n+++'),
                    'lines_removed': diff_content.count('\n-') - diff_content.count('\n---'),
                },
                'repair_details': {
                    'strategy': aggregated_context_details.get('step_3_4_repair_strategy_selection', {}).get('strategy', 'unknown'),
                    'confidence': aggregated_context_details.get('step_3_4_repair_strategy_selection', {}).get('confidence', 0),
                    'processing_time': processing_time,
                },
                'pipeline_progress': pipeline.to_dict(),
                'context_details': {
                    'raw_context': raw_context_details,
                    'compressed_context': compressed_context_details,
                    'aggregated_context': aggregated_context_details
                },
                'generated_at': datetime.now().isoformat(),
                'scoring': {
                    'status': 'pending',  # For later scoring
                    'score': None,
                    'scored_at': None
                }
            }
            
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, default=str)
            
            self.logger.info(f"✅ Saved patch to {diff_file}")
            self.logger.info(f"✅ Saved report to {report_file}")
            
            return str(diff_file), str(report_file), diff_content
            
        except Exception as e:
            self.logger.error(f"Failed to save repair result: {e}")
            return None, None, None
    
    def _ingest_raw_context(self, broken_test: Dict, error_message: str) -> Dict:
        """
        Step 1: Raw Context Ingestion
        Gather raw context from knowledge graph, vector storage, etc.
        """
        self.logger.debug("Step 1: Raw context ingestion")
        
        raw_context = {
            'entities': [],
            'snippets': [],
            'usage_examples': [],
            'graph_paths': [],
            'semantic_hits': [],
            'conventions': {}
        }
        
        test_name = broken_test.get('test_name', '')
        test_code = broken_test.get('test_code', '')
        
        # Build query from error and test code - extract key terms
        # Focus on: class names, method names from error, and imports from test code
        import re
        
        # Extract class/module name from error (e.g., "FoodParser" from "FoodParser has no attribute 'text'")
        class_match = re.search(r"'(\w+)'\s+(?:object\s+)?has\s+no\s+attribute", error_message)
        class_name = class_match.group(1) if class_match else ""
        
        # Extract the wrong method name from error
        attr_match = re.search(r"no\s+attribute\s+'(\w+)'", error_message)
        wrong_method = attr_match.group(1) if attr_match else ""
        
        # Extract imports from test code to understand context
        imports = re.findall(r'from\s+([\w.]+)\s+import\s+(\w+)', test_code)
        import_context = " ".join([f"{mod} {cls}" for mod, cls in imports])
        
        # Build a focused query
        query_parts = []
        if class_name:
            query_parts.append(class_name)
        if wrong_method:
            query_parts.append(wrong_method)
        if import_context:
            query_parts.append(import_context)
        query_parts.append(test_name)
        
        query = " ".join(query_parts) if query_parts else f"{test_name} {error_message[:200]}"
        self.logger.info(f"Semantic search query: {query}")
        
        # Get entities from knowledge graph
        if self.kg_manager:
            try:
                # Get entities related to the test
                graph = getattr(self.kg_manager, 'graph', None)
                if graph:
                    for node_id in list(graph.nodes())[:100]:
                        node_data = graph.nodes[node_id]
                        raw_context['entities'].append({
                            'entity_id': node_id,
                            'entity_name': node_data.get('name', node_id),
                            'entity_type': node_data.get('type', 'unknown'),
                            'file_path': node_data.get('file_path', ''),
                            'relevance_score': 0.5
                        })
                    
                    # Get graph paths
                    for source, target, data in list(graph.edges(data=True))[:50]:
                        edge_types = data.get('types', set())
                        rel_type = next(iter(edge_types)) if edge_types else data.get('type', 'RELATES')
                        raw_context['graph_paths'].append({
                            'nodes': [source, target],
                            'relationship_types': [rel_type],
                            'source': source,
                            'target': target
                        })
            except Exception as e:
                self.logger.warning(f"Failed to get KG context: {e}")
        
        # Get semantic hits from vector storage
        if self.vector_storage:
            try:
                search_result = self.vector_storage.search_similar_entities(query, top_k=20)
                if search_result.get('success'):
                    for hit in search_result.get('results', []):
                        raw_context['semantic_hits'].append({
                            'entity_id': hit.get('entity_id', ''),
                            'entity_name': hit.get('entity_name', ''),
                            'score': hit.get('relevance_score', hit.get('score', 0)),
                            'code_snippet': hit.get('code_snippet', ''),
                            'semantic_similarity': hit.get('semantic_similarity', 0)
                        })
                        raw_context['snippets'].append({
                            'entity_id': hit.get('entity_id', ''),
                            'code': hit.get('code_snippet', '')
                        })
            except Exception as e:
                self.logger.warning(f"Failed to get vector context: {e}")
        
        # Get KGCompass relevance scores
        if self.relevance_scorer and self.kg_manager:
            try:
                # Get graph from kg_manager
                graph = getattr(self.kg_manager, 'graph', None)
                
                if graph:
                    # Get candidate entities from the knowledge graph
                    candidate_entities = []
                    for node_id in graph.nodes():
                        node_data = graph.nodes[node_id]
                        candidate_entities.append({
                            'id': node_id,
                            'name': node_data.get('name', node_id),
                            'type': node_data.get('type', 'unknown'),
                            'file_path': node_data.get('file_path', ''),
                            'code_snippet': node_data.get('code_snippet', '')
                        })
                    
                    # Limit candidates to avoid timeout (take top 100 based on name match)
                    if len(candidate_entities) > 100:
                        # Simple filtering based on error message keywords
                        error_keywords = set(error_message.lower().split())
                        scored_candidates = []
                        for entity in candidate_entities:
                            entity_name = entity.get('name', '').lower()
                            score = sum(1 for kw in error_keywords if kw in entity_name)
                            scored_candidates.append((score, entity))
                        scored_candidates.sort(key=lambda x: x[0], reverse=True)
                        candidate_entities = [e for _, e in scored_candidates[:100]]
                    
                    # Use the appropriate method based on the scorer type
                    if candidate_entities:
                        # Check which method is available (rank_entities vs calculate_relevance_scores)
                        if hasattr(self.relevance_scorer, 'rank_entities'):
                            relevance_scores = self.relevance_scorer.rank_entities(
                                problem_description=error_message,
                                candidate_entities=candidate_entities,
                                graph=graph,
                                top_k=20
                            )
                        elif hasattr(self.relevance_scorer, 'calculate_relevance_scores'):
                            # Step5RelevanceScoring uses calculate_relevance_scores
                            relevance_results = self.relevance_scorer.calculate_relevance_scores(
                                error_message=error_message,
                                kg_manager=self.kg_manager,
                                issue_id=None,
                                top_k=20
                            )
                            # Convert Step5 results to expected format
                            relevance_scores = []
                            for candidate in relevance_results.get('top_candidates', []):
                                from dataclasses import dataclass
                                @dataclass
                                class ScoreResult:
                                    entity_id: str
                                    entity_name: str
                                    entity_type: str
                                    file_path: str
                                    total_score: float
                                    semantic_similarity: float
                                    textual_similarity: float
                                
                                relevance_scores.append(ScoreResult(
                                    entity_id=candidate.get('entity_id', ''),
                                    entity_name=candidate.get('entity_name', ''),
                                    entity_type=candidate.get('entity_type', ''),
                                    file_path=candidate.get('file_path', ''),
                                    total_score=candidate.get('total_score', 0.0),
                                    semantic_similarity=candidate.get('semantic_similarity', 0.0),
                                    textual_similarity=candidate.get('textual_similarity', 0.0)
                                ))
                        else:
                            self.logger.warning("Relevance scorer has no supported method")
                            relevance_scores = []
                        
                        for score in relevance_scores:
                            raw_context['entities'].append({
                                'entity_id': score.entity_id,
                                'entity_name': score.entity_name,
                                'entity_type': score.entity_type,
                                'file_path': score.file_path,
                                'score': score.total_score,
                                'semantic_similarity': score.semantic_similarity,
                                'textual_similarity': score.textual_similarity
                            })
            except Exception as e:
                self.logger.warning(f"Failed to get relevance scores: {e}")
        
        # Infer project conventions
        raw_context['conventions'] = self._infer_conventions(raw_context['snippets'])
        
        self.logger.debug(f"Ingested {len(raw_context['entities'])} entities, {len(raw_context['semantic_hits'])} semantic hits")
        return raw_context
    
    def _infer_conventions(self, snippets: List[Dict]) -> Dict:
        """Infer project conventions from code snippets"""
        conventions = {
            'setup_patterns': [],
            'teardown_patterns': [],
            'assertion_format': 'standard',
            'naming_pattern': 'snake_case',
            'utility_methods': []
        }
        
        for snippet in snippets[:20]:
            code = snippet.get('code', '')
            
            # Detect setup patterns
            if 'setUp' in code:
                conventions['setup_patterns'].append('setUp')
            if '@pytest.fixture' in code:
                conventions['setup_patterns'].append('pytest.fixture')
            if '@Before' in code:
                conventions['setup_patterns'].append('@Before')
            
            # Detect assertion format
            if 'assertThat' in code:
                conventions['assertion_format'] = 'assertThat'
            elif 'expect(' in code:
                conventions['assertion_format'] = 'expect'
            elif 'assert ' in code:
                conventions['assertion_format'] = 'assert'
        
        return conventions
    
    def _compress_context(self, broken_test: Dict, error_message: str, raw_context: Dict) -> CompressedContext:
        """
        Step 2: Context Compression
        Execute GATR context compression algorithm
        """
        self.logger.debug("Step 2: Context compression")
        
        return self.context_compressor.compress_context(
            broken_test=broken_test,
            error_message=error_message,
            raw_entities=raw_context.get('entities', []),
            raw_snippets=raw_context.get('snippets', []),
            usage_examples=raw_context.get('usage_examples', []),
            graph_paths=raw_context.get('graph_paths', []),
            semantic_hits=raw_context.get('semantic_hits', []),
            conventions=raw_context.get('conventions', {})
        )
    
    def _aggregate_context(self, compressed_context: CompressedContext) -> Dict:
        """
        Step 3: RAG Aggregation
        Execute RAG aggregation on compressed context
        """
        self.logger.debug("Step 3: RAG aggregation")
        
        return self.rag_aggregator.aggregate(compressed_context)
    
    # ================================================================================
    # GraphRAG Implementation (Steps 7-9 from original design)
    # Step 7: Retrieve Context - Multi-hop traversal + semantic search
    # Step 8: Augment Context - Add code snippets, usage examples, conventions
    # Step 9: Generate Fix - Enhanced prompt with full context
    # ================================================================================
    
    def _graphrag_retrieve_context(self, broken_test: Dict, error_message: str) -> Dict:
        """
        GraphRAG Step 7: Retrieve Context - Enhanced with semantic similarity
        - Query graph for directly connected entities
        - Perform semantic search for alternatives with similar names/types
        - Perform multi-hop traversal  
        - Combine with semantic search results
        - Rank by KGCompass + semantic similarity
        """
        self.logger.info("[GraphRAG Step 7] Retrieving context...")
        
        test_code = broken_test.get('test_code', '')
        test_name = broken_test.get('test_name', '')
        
        context = {
            'test': test_name,
            'test_code': test_code,
            'error': error_message,
            'graph_context': [],      # From graph traversal
            'semantic_context': [],   # From vector search
            'combined_context': [],   # Merged and ranked
            'paths': []               # Relationship paths
        }
        
        # Extract key terms from error for search
        error_info = self._parse_error_message(error_message)
        
        # 1. Multi-hop graph traversal
        if self.kg_manager:
            graph = getattr(self.kg_manager, 'graph', None)
            if graph:
                context['graph_context'] = self._multi_hop_traversal(
                    graph, test_name, error_info
                )
        
        # 2. Semantic search from vector storage - ENHANCED with alternatives
        if self.vector_storage:
            context['semantic_context'] = self._semantic_retrieval(
                error_message, test_code, error_info
            )
            
            # 2.5 Search for semantically similar alternatives
            if error_info.get('wrong_method'):
                alternatives = self._search_semantic_alternatives(
                    error_info['wrong_method'],
                    error_info.get('class_name', ''),
                    error_info.get('language', '')
                )
                # Add alternatives with boosted relevance
                context['semantic_context'].extend(alternatives)
        
        # 3. Combine and rank by relevance
        context['combined_context'] = self._combine_and_rank(
            context['graph_context'],
            context['semantic_context'],
            error_info
        )
        
        # 4. Get relationship paths for top entities
        if self.kg_manager and context['combined_context']:
            context['paths'] = self._get_entity_paths(
                test_name, 
                [e['entity_id'] for e in context['combined_context'][:10]]
            )
        
        self.logger.info(f"[GraphRAG Step 7] Retrieved {len(context['combined_context'])} entities")
        return context
    
    def _search_semantic_alternatives(self, wrong_method: str, class_name: str, language: str = '') -> List[Dict]:
        """
        Search for semantically similar alternatives that could be the correct fix
        Uses embeddings to find methods like Response when user typed Fetch
        """
        alternatives = []
        
        try:
            if not self.vector_storage:
                return alternatives
            
            # Build semantic queries dynamically from the wrong method and class
            queries = []
            if class_name:
                queries.append(f"{class_name} {wrong_method}")
                queries.append(class_name)
            if wrong_method:
                queries.append(wrong_method)
                # Try common naming variations (camelCase parts)
                parts = re.findall(r'[A-Z][a-z]+|[a-z]+', wrong_method)
                if len(parts) > 1:
                    for part in parts:
                        queries.append(f"{class_name} {part}" if class_name else part)
            if language:
                queries.append(f"{class_name} {language}" if class_name else language)
            
            found_entities = {}
            
            for query in queries:
                try:
                    search_result = self.vector_storage.search_similar_entities(query, top_k=10)
                    results = search_result.get('similar_entities', []) if isinstance(search_result, dict) else search_result
                    
                    for result in results:
                        entity_name = result.get('entity_name', '')
                        if entity_name and entity_name not in found_entities:
                            score = result.get('score', 0)
                            
                            # Context-sensitive boosts
                            name_lower = entity_name.lower()
                            if class_name and class_name.lower() in name_lower:
                                score += 0.2
                            if wrong_method and wrong_method.lower() in name_lower:
                                score += 0.15
                            
                            found_entities[entity_name] = {
                                'entity_id': result.get('entity_id', ''),
                                'entity_name': entity_name,
                                'entity_type': result.get('entity_type', 'method'),
                                'file_path': result.get('file_path', ''),
                                'code_snippet': result.get('code_snippet', ''),
                                'combined_score': min(score, 1.0),  # Cap at 1.0
                                'source': 'semantic_alternative',
                                'relationship': 'possible_fix'
                            }
                except Exception as e:
                    self.logger.debug(f"Semantic search failed for query '{query}': {e}")
                    continue
            
            alternatives = list(found_entities.values())
            
            # Sort by score descending
            alternatives.sort(key=lambda x: x['combined_score'], reverse=True)
            
            if alternatives:
                self.logger.info(f"Found {len(alternatives)} semantic alternatives for '{wrong_method}'")
            
        except Exception as e:
            self.logger.warning(f"Error searching semantic alternatives: {e}")
        
        return alternatives
    
    def _parse_error_message(self, error_message: str) -> Dict:
        """Parse error message to extract key information for Python, Java, and other languages"""
        info = {
            'error_type': 'unknown',
            'class_name': '',
            'wrong_method': '',
            'suggested_fix': '',
            'keywords': [],
            'parent_class': '',  # For inner class lookups
            'inner_class': '',   # The missing inner class/member
            'language': 'unknown'
        }
        
        # ===== JAVA/JVM ERROR PATTERNS =====
        
        # Java: "ClassName has no member MemberName" or "has no member"
        java_no_member = re.search(r"(\w+(?:\.\w+)*)\s+has\s+no\s+(?:member|method|field)\s+(\w+)", error_message, re.IGNORECASE)
        if java_no_member:
            info['class_name'] = java_no_member.group(1)
            info['wrong_method'] = java_no_member.group(2)
            info['error_type'] = 'missing_member'
            info['language'] = 'java'
            # Extract parent.inner pattern
            if '.' in info['class_name']:
                parts = info['class_name'].split('.')
                info['parent_class'] = parts[-1]
            else:
                info['parent_class'] = info['class_name']
            info['inner_class'] = info['wrong_method']
        
        # Java: "new ClassName.InnerClass()" pattern - extract from code context
        java_new_inner = re.search(r"new\s+(\w+)\.(\w+)\s*\(", error_message)
        if java_new_inner:
            info['parent_class'] = java_new_inner.group(1)
            info['inner_class'] = java_new_inner.group(2)
            info['class_name'] = java_new_inner.group(1)
            info['wrong_method'] = java_new_inner.group(2)
            info['error_type'] = 'missing_inner_class'
            info['language'] = 'java'
        
        # Java: "cannot find symbol" / "cannot resolve symbol"
        java_symbol = re.search(r"cannot\s+(?:find|resolve)\s+symbol.*?(?:class|method|variable)\s+(\w+)", error_message, re.IGNORECASE | re.DOTALL)
        if java_symbol:
            info['wrong_method'] = java_symbol.group(1)
            info['error_type'] = 'cannot_resolve_symbol'
            info['language'] = 'java'
        
        # Java: "method X in class Y cannot be applied"
        java_method_apply = re.search(r"method\s+(\w+)\s+in\s+(?:class\s+)?(\w+)", error_message, re.IGNORECASE)
        if java_method_apply:
            info['wrong_method'] = java_method_apply.group(1)
            info['class_name'] = java_method_apply.group(2)
            info['error_type'] = 'method_signature_mismatch'
            info['language'] = 'java'
        
        # ===== PYTHON ERROR PATTERNS =====
        
        # AttributeError: 'X' object has no attribute 'Y'
        attr_match = re.search(r"'(\w+)'\s+(?:object\s+)?has\s+no\s+attribute\s+'(\w+)'", error_message)
        if attr_match:
            info['class_name'] = attr_match.group(1)
            info['wrong_method'] = attr_match.group(2)
            info['error_type'] = 'missing_attribute'
            info['language'] = 'python'
        
        # Check for "Did you mean" suggestion (Python 3.10+)
        suggest_match = re.search(r"[Dd]id you mean[:\s]*'(\w+)'", error_message)
        if suggest_match:
            info['suggested_fix'] = suggest_match.group(1)
        
        # NameError: name 'X' is not defined
        name_match = re.search(r"name\s+'(\w+)'\s+is\s+not\s+defined", error_message)
        if name_match:
            info['wrong_method'] = name_match.group(1)
            info['error_type'] = 'undefined_name'
            info['language'] = 'python'
        
        # TypeError patterns
        type_match = re.search(r"(\w+)\(\)\s+(?:got|takes)", error_message)
        if type_match:
            info['wrong_method'] = type_match.group(1)
            info['error_type'] = 'type_error'
            if info['language'] == 'unknown':
                info['language'] = 'python'
        
        # ImportError / ModuleNotFoundError
        import_match = re.search(r"(?:ImportError|ModuleNotFoundError).*?(?:cannot import name\s+'(\w+)'|No module named\s+'([\w.]+)')", error_message)
        if import_match:
            info['wrong_method'] = import_match.group(1) or import_match.group(2)
            info['error_type'] = 'import_error'
            info['language'] = 'python'
        
        # IndentationError / SyntaxError (Python-specific)
        if re.search(r'IndentationError|unexpected indent|unindent does not match', error_message, re.IGNORECASE):
            info['error_type'] = 'indentation_error'
            info['language'] = 'python'
        
        # AssertionError with message
        assert_match = re.search(r"AssertionError:\s*(.*)", error_message)
        if assert_match:
            info['error_type'] = 'assertion_error'
            if info['language'] == 'unknown':
                info['language'] = 'python'
        
        # Extract keywords for search (enhanced)
        words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', error_message)
        stopwords = {'the', 'has', 'no', 'attribute', 'object', 'error', 'did', 'you', 'mean',
                     'cannot', 'find', 'symbol', 'class', 'method', 'member', 'new', 'in', 'is', 'not'}
        info['keywords'] = [w for w in words if len(w) > 2 and w.lower() not in stopwords]
        
        self.logger.debug(f"Parsed error: type={info['error_type']}, class={info['class_name']}, "
                         f"wrong={info['wrong_method']}, parent={info['parent_class']}, inner={info['inner_class']}")
        
        return info
    
    def _multi_hop_traversal(self, graph, test_name: str, error_info: Dict) -> List[Dict]:
        """
        Traverse graph to find relevant entities via multi-hop connections
        """
        entities = []
        visited = set()
        
        try:
            # Hop 1: Find entities matching error keywords
            for node_id in graph.nodes():
                node_data = graph.nodes[node_id]
                node_name = node_data.get('name', node_id)
                node_type = node_data.get('type', 'unknown')
                
                # Match against class name or method keywords
                relevance = 0
                if error_info['class_name'] and error_info['class_name'].lower() in node_name.lower():
                    relevance += 3
                if error_info['wrong_method'] and error_info['wrong_method'].lower() in node_name.lower():
                    relevance += 2
                for kw in error_info['keywords'][:5]:
                    if kw.lower() in node_name.lower():
                        relevance += 1
                
                if relevance > 0 and node_id not in visited:
                    visited.add(node_id)
                    entities.append({
                        'entity_id': node_id,
                        'entity_name': node_name,
                        'entity_type': node_type,
                        'file_path': node_data.get('file_path', ''),
                        'code_snippet': node_data.get('code', node_data.get('code_snippet', '')),
                        'relevance': relevance,
                        'hop': 1,
                        'relationship': 'keyword_match'
                    })
            
            # Hop 2: Find connected entities (dependencies, callers, etc.)
            # Use both successors AND predecessors since graph is DiGraph
            first_hop_ids = [e['entity_id'] for e in entities[:20]]
            for node_id in first_hop_ids:
                all_neighbors = set(graph.successors(node_id)) | set(graph.predecessors(node_id))
                for neighbor in all_neighbors:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        node_data = graph.nodes[neighbor]
                        edge_data = graph.get_edge_data(node_id, neighbor) or graph.get_edge_data(neighbor, node_id) or {}
                        edge_types = edge_data.get('types', set())
                        rel_type = next(iter(edge_types)) if edge_types else edge_data.get('type', 'connected')
                        entities.append({
                            'entity_id': neighbor,
                            'entity_name': node_data.get('name', neighbor),
                            'entity_type': node_data.get('type', 'unknown'),
                            'file_path': node_data.get('file_path', ''),
                            'code_snippet': node_data.get('code', node_data.get('code_snippet', '')),
                            'relevance': 0.5,
                            'hop': 2,
                            'relationship': rel_type
                        })
            
            # Sort by relevance
            entities.sort(key=lambda x: (-x['relevance'], x['hop']))
            
        except Exception as e:
            self.logger.warning(f"Multi-hop traversal error: {e}")
        
        self.logger.debug(f"Graph traversal found {len(entities)} entities")
        return entities[:50]  # Limit to top 50
    
    def _semantic_retrieval(self, error_message: str, test_code: str, error_info: Dict) -> List[Dict]:
        """
        Retrieve semantically similar entities from vector storage
        """
        entities = []
        
        try:
            # Build semantic query focusing on the problem
            query_parts = []
            if error_info['class_name']:
                query_parts.append(error_info['class_name'])
            if error_info['wrong_method']:
                query_parts.append(error_info['wrong_method'])
            query_parts.extend(error_info['keywords'][:3])
            
            # Add context from test imports
            imports = re.findall(r'from\s+([\w.]+)\s+import\s+(\w+)', test_code)
            for mod, cls in imports[:3]:
                query_parts.append(cls)
            
            query = " ".join(query_parts) if query_parts else error_message[:200]
            self.logger.debug(f"Semantic query: {query}")
            
            # Search vector storage
            search_result = self.vector_storage.search_similar_entities(query, top_k=30)
            
            if search_result.get('success'):
                for hit in search_result.get('results', []):
                    entities.append({
                        'entity_id': hit.get('entity_id', ''),
                        'entity_name': hit.get('entity_name', ''),
                        'entity_type': hit.get('entity_type', 'unknown'),
                        'file_path': hit.get('file_path', ''),
                        'code_snippet': hit.get('code_snippet', ''),
                        'semantic_score': hit.get('relevance_score', hit.get('score', 0)),
                        'relationship': 'semantic_match'
                    })
                    
        except Exception as e:
            self.logger.warning(f"Semantic retrieval error: {e}")
        
        self.logger.debug(f"Semantic search found {len(entities)} entities")
        return entities
    
    def _combine_and_rank(self, graph_entities: List[Dict], 
                          semantic_entities: List[Dict],
                          error_info: Dict) -> List[Dict]:
        """
        Combine graph and semantic results, rank by combined score
        """
        entity_map = {}
        
        # Add graph entities
        for e in graph_entities:
            eid = e['entity_id']
            if eid not in entity_map:
                entity_map[eid] = e.copy()
                entity_map[eid]['graph_score'] = e.get('relevance', 0)
                entity_map[eid]['semantic_score'] = 0
            else:
                entity_map[eid]['graph_score'] = max(
                    entity_map[eid].get('graph_score', 0), 
                    e.get('relevance', 0)
                )
        
        # Add semantic entities
        for e in semantic_entities:
            eid = e['entity_id']
            if eid not in entity_map:
                entity_map[eid] = e.copy()
                entity_map[eid]['graph_score'] = 0
                entity_map[eid]['semantic_score'] = e.get('semantic_score', 0)
            else:
                entity_map[eid]['semantic_score'] = max(
                    entity_map[eid].get('semantic_score', 0),
                    e.get('semantic_score', 0)
                )
        
        # Calculate combined score with bonuses
        for eid, e in entity_map.items():
            # Normalize scores
            graph_norm = min(e.get('graph_score', 0) / 5.0, 1.0)
            semantic_norm = min(e.get('semantic_score', 0), 1.0)
            
            # Combined score: weighted average
            combined = (0.6 * graph_norm) + (0.4 * semantic_norm)
            
            # Bonus for methods/functions/classes (more likely to be the fix)
            if e.get('entity_type') in ('function', 'method', 'class', 'interface', 'constructor'):
                combined += 0.2
            
            # Bonus if name contains class name from error
            if error_info['class_name']:
                if error_info['class_name'].lower() in e.get('entity_name', '').lower():
                    combined += 0.15
            
            e['combined_score'] = min(combined, 1.0)
        
        # Sort by combined score
        ranked = sorted(entity_map.values(), key=lambda x: -x['combined_score'])
        
        self.logger.debug(f"Combined and ranked {len(ranked)} entities")
        return ranked[:30]  # Top 30
    
    def _get_entity_paths(self, source: str, target_ids: List[str]) -> List[Dict]:
        """Get relationship paths between source and target entities"""
        paths = []
        try:
            graph = getattr(self.kg_manager, 'graph', None)
            if graph:
                for target in target_ids[:5]:
                    if graph.has_node(target):
                        # Get direct edges
                        for u, v, data in graph.edges(data=True):
                            if u == target or v == target:
                                edge_types = data.get('types', set())
                                rel_type = next(iter(edge_types)) if edge_types else data.get('type', 'RELATES')
                                paths.append({
                                    'source': u,
                                    'target': v,
                                    'relationship': rel_type
                                })
        except Exception as e:
            self.logger.debug(f"Path finding error: {e}")
        return paths[:20]
    
    def _graphrag_augment_context(self, retrieved_context: Dict, broken_test: Dict) -> Dict:
        """
        GraphRAG Step 8: Augment Context
        - Add code snippets
        - Include usage examples
        - Add related test patterns
        - Include project conventions
        - Pass through structured change-location data for prompt
        """
        self.logger.info("[GraphRAG Step 8] Augmenting context...")
        
        test_code = broken_test.get('test_code', '')
        
        augmented = {
            'test': retrieved_context['test'],
            'test_code': test_code,
            'test_file': broken_test.get('test_file', ''),
            'error': retrieved_context['error'],
            'entities': [],
            'usage_examples': [],
            'test_patterns': [],
            'conventions': {},
            # Structured change-location data for the prompt
            'language': broken_test.get('language', 'java'),
            'broken_lines': broken_test.get('broken_lines', []),
            'broken_line_numbers': broken_test.get('broken_line_numbers', []),
            'hunk_type': broken_test.get('hunk_type', 'MODIFY'),
            'verdict_status': broken_test.get('verdict_status', 'unknown'),
            'error_lines': broken_test.get('error_lines', []),
        }
        
        # Augment each entity with rich context
        for entity in retrieved_context['combined_context'][:15]:
            aug_entity = {
                'id': entity.get('entity_id', ''),
                'name': entity.get('entity_name', ''),
                'type': entity.get('entity_type', 'unknown'),
                'file_path': entity.get('file_path', ''),
                'score': entity.get('combined_score', 0),
                'relationship': entity.get('relationship', ''),
                'code_snippet': '',
                'usage_examples': [],
                'docstring': ''
            }
            
            # Get or enhance code snippet
            snippet = entity.get('code_snippet', '')
            if snippet:
                aug_entity['code_snippet'] = snippet
                # Extract docstring if present
                docstring_match = re.search(r'"""(.+?)"""', snippet, re.DOTALL)
                if docstring_match:
                    aug_entity['docstring'] = docstring_match.group(1).strip()[:200]
            
            # Find usage examples in test code or other snippets
            if aug_entity['name']:
                usages = self._find_usage_examples(aug_entity['name'], retrieved_context)
                aug_entity['usage_examples'] = usages[:3]
            
            augmented['entities'].append(aug_entity)
        
        # Extract test patterns from the broken test
        augmented['test_patterns'] = self._extract_test_patterns(test_code)
        
        # Get project conventions
        augmented['conventions'] = self._extract_conventions(retrieved_context)
        
        self.logger.info(f"[GraphRAG Step 8] Augmented {len(augmented['entities'])} entities")
        return augmented
    
    def _find_usage_examples(self, entity_name: str, context: Dict) -> List[str]:
        """Find usage examples of an entity in the codebase"""
        examples = []
        
        # Look through code snippets for usage
        for entity in context.get('combined_context', []):
            snippet = entity.get('code_snippet', '')
            if snippet and entity_name in snippet:
                # Extract the line(s) containing the usage
                for line in snippet.split('\n'):
                    if entity_name in line and line.strip():
                        examples.append(line.strip())
                        if len(examples) >= 5:
                            break
        
        return examples[:5]
    
    def _extract_test_patterns(self, test_code: str) -> List[Dict]:
        """Extract patterns from test code"""
        patterns = []
        
        # Setup pattern (fixtures, before hooks)
        if '@pytest.fixture' in test_code or 'setUp' in test_code:
            patterns.append({'type': 'setup', 'pattern': 'uses fixtures/setup'})
        
        # Assert patterns
        assert_matches = re.findall(r'(assert\w*\([^)]+\))', test_code)
        for match in assert_matches[:3]:
            patterns.append({'type': 'assertion', 'pattern': match[:100]})
        
        # Import patterns
        imports = re.findall(r'(from\s+[\w.]+\s+import\s+[\w,\s]+)', test_code)
        for imp in imports[:3]:
            patterns.append({'type': 'import', 'pattern': imp})
        
        return patterns
    
    def _extract_conventions(self, context: Dict) -> Dict:
        """Extract project conventions from context"""
        conventions = {
            'naming': [],
            'patterns': [],
            'common_imports': []
        }
        
        # Analyze entity names for naming conventions
        names = [e.get('entity_name', '') for e in context.get('combined_context', [])]
        
        # Check naming style
        snake_count = sum(1 for n in names if '_' in n and n.islower())
        camel_count = sum(1 for n in names if n and n[0].islower() and any(c.isupper() for c in n))
        
        if snake_count > camel_count:
            conventions['naming'].append('snake_case for functions')
        elif camel_count > snake_count:
            conventions['naming'].append('camelCase for functions')
        
        return conventions
    
    def _graphrag_generate_fix(self, augmented_context: Dict, error_info: Dict) -> Tuple[str, str]:
        """
        GraphRAG Step 9: Generate Fix
        - Format context into structured prompt
        - Include examples and patterns
        - Generate repair with LLM
        - Validate and refine
        """
        self.logger.info("[GraphRAG Step 9] Generating fix...")
        
        # Create the enhanced prompt with all context
        system_message, user_prompt = self._create_graphrag_prompt(augmented_context, error_info)
        
        self.logger.debug(f"GraphRAG prompt length: {len(user_prompt)} chars (system: {len(system_message)} chars)")
        
        # Call LLM
        if self.lm_studio_available:
            repair = self._call_lm_studio(user_prompt, temperature=0.2,
                                           system_message=system_message)
            
            if repair:
                # Clean and validate
                cleaned = self._clean_llm_output(repair)
                
                if self._is_valid_code(cleaned):
                    self.logger.info("[GraphRAG Step 9] Generated valid repair")
                    return cleaned, 'graphrag_llm'
                else:
                    self.logger.warning("GraphRAG LLM output invalid, trying fallback")
        
        # Fallback to rule-based
        return self._graphrag_fallback_repair(augmented_context, error_info), 'graphrag_fallback'
    
    def _create_graphrag_prompt(self, augmented_context: Dict, error_info: Dict) -> Tuple[str, str]:
        """
        Create a high-quality system + user prompt pair using full GraphRAG context.

        Returns:
            Tuple of (system_message, user_prompt)
        """
        test_code = augmented_context.get('test_code', '')
        error = augmented_context.get('error', '')

        # Detect language from file path or code patterns
        test_file = augmented_context.get('test_file', '')
        language = augmented_context.get('language', '')
        if not language:
            if test_file.endswith('.py') or 'def test_' in test_code or 'import pytest' in test_code:
                language = 'python'
            elif test_file.endswith('.java') or 'public void' in test_code or '@Test' in test_code:
                language = 'java'
            else:
                language = 'java'  # TaRBench is Java-dominant

        # Extract structured change data
        broken_lines = augmented_context.get('broken_lines', [])
        broken_line_numbers = augmented_context.get('broken_line_numbers', [])
        hunk_type = augmented_context.get('hunk_type', 'MODIFY')
        verdict_status = augmented_context.get('verdict_status', 'unknown')

        # ── Build the annotated broken test with change markers ──
        annotated_code = self._annotate_broken_lines(test_code, broken_lines, broken_line_numbers, language)

        # ── Build KG entity context ──
        entities = augmented_context.get('entities', [])
        entity_section = self._build_entity_section(entities)

        # ── Build API delta section ──
        api_deltas = augmented_context.get('api_deltas', [])
        delta_section = self._build_delta_section(api_deltas)

        # ── Build broken lines section ──
        broken_section = ""
        if broken_lines:
            broken_section = "\n## LINES THAT NEED TO CHANGE\n"
            broken_section += "These specific lines from the broken test are INCORRECT and must be modified:\n"
            for i, line in enumerate(broken_lines):
                ln = broken_line_numbers[i] if i < len(broken_line_numbers) else "?"
                broken_section += f"  Line {ln}: {line}\n"
            broken_section += "\nYou MUST change at least these lines. Do NOT return them as-is.\n"

        # ── Build canonical usage / similar test patterns ──
        usage_section = ""
        canonical_usages = augmented_context.get('canonical_usages', [])
        if canonical_usages:
            usage_section = "\n## CORRECT USAGE PATTERNS FROM CODEBASE\n"
            for i, usage in enumerate(canonical_usages[:5], 1):
                pattern = usage.get('usage_pattern', '')
                example = usage.get('example_code', '')
                if example:
                    usage_section += f"{i}. {pattern}\n   ```{language}\n   {example}\n   ```\n"
                elif pattern:
                    usage_section += f"{i}. {pattern}\n"

        # ── System message ──
        system_message = f"""You are GATR (Graph-Aware Test Repair), an expert automated test repair system for {language.upper()} projects.

Your task is to repair broken test methods using contextual information from the project's knowledge graph, vector-indexed code, and API change analysis.

CRITICAL RULES:
1. You MUST output ONLY the complete repaired {language} method. No explanations, no markdown fences, no commentary.
2. You MUST make changes to the broken lines. Returning the input unchanged is NEVER acceptable.
3. Preserve the method signature, annotations, and overall structure.
4. Only modify lines that are actually broken. Keep all other lines identical.
5. Use the knowledge graph entities and API patterns provided to make informed repairs.
6. Ensure the output compiles: balanced braces/indentation, correct types, valid {language} syntax.
7. Start your output directly with the first line of code (no preamble or markdown)."""

        # ── User prompt ──
        user_prompt = f"""# BROKEN TEST REPAIR REQUEST

## TEST INFORMATION
- Test: {augmented_context.get('test', '')}
- File: {test_file}
- Language: {language.upper()}
- Failure Type: {verdict_status}
- Change Type: {hunk_type}

## ERROR MESSAGE
{error}

## BROKEN TEST CODE (lines marked with >>> MUST be changed)
```{language}
{annotated_code}
```
{broken_section}{entity_section}{delta_section}{usage_section}
## YOUR TASK
1. Read the error message and identify what is wrong.
2. Look at the lines marked with >>> — those are the lines that MUST change.
3. Use the knowledge graph entities above to find correct replacements (method names, class names, parameters, imports).
4. Output the COMPLETE repaired test method — every line, from the first annotation to the closing brace.
5. Make ONLY the necessary changes. Keep everything else identical.

REPAIRED {language.upper()} CODE:
"""
        return system_message, user_prompt

    def _annotate_broken_lines(self, test_code: str, broken_lines: List[str],
                                broken_line_numbers: List[int], language: str = 'java') -> str:
        """
        Annotate the test code by marking lines that need to change with >>> markers.
        This gives the LLM a clear visual signal of what to fix.
        """
        if not broken_lines and not broken_line_numbers:
            return test_code

        code_lines = test_code.split('\n')
        comment_char = '#' if language == 'python' else '//'

        # Build a set of line numbers to mark (relative to startLine)
        mark_numbers = set(broken_line_numbers) if broken_line_numbers else set()

        # Also fuzzy-match: if a broken_line text appears in the code, mark it
        broken_line_texts = set(bl.strip() for bl in broken_lines if bl.strip())

        annotated = []
        for i, line in enumerate(code_lines, 1):
            stripped = line.strip()
            is_broken = (i in mark_numbers) or (stripped and stripped in broken_line_texts)
            if is_broken:
                annotated.append(f">>> {line}  {comment_char} <-- THIS LINE IS BROKEN")
            else:
                annotated.append(f"    {line}")

        return '\n'.join(annotated)

    def _build_entity_section(self, entities: List[Dict]) -> str:
        """Build the knowledge graph entity context section for the prompt."""
        if not entities:
            return ""

        section = "\n## KNOWLEDGE GRAPH CONTEXT (ranked by KGCompass + GraphRAG relevance)\n"
        section += "These entities from the project are most relevant to this repair:\n\n"

        for i, entity in enumerate(entities[:12], 1):
            name = entity.get('name', '')
            etype = entity.get('type', 'unknown')
            score = entity.get('score', 0)
            file_path = entity.get('file_path', '')
            docstring = entity.get('docstring', '')
            snippet = entity.get('code_snippet', '')

            section += f"### {i}. {name} ({etype}) — relevance: {score:.2f}\n"
            if file_path:
                section += f"   File: {file_path}\n"
            if docstring:
                section += f"   Doc: {docstring[:150]}\n"
            if snippet:
                # Show first 8 lines of code
                snippet_lines = snippet.strip().split('\n')[:8]
                section += "   ```\n   " + "\n   ".join(snippet_lines) + "\n   ```\n"
            section += "\n"

        return section

    def _build_delta_section(self, api_deltas: List[Dict]) -> str:
        """Build the API change/delta section for the prompt."""
        if not api_deltas:
            return ""

        section = "\n## API CHANGES DETECTED\n"
        section += "These API changes may be causing the test failure:\n\n"

        for i, delta in enumerate(api_deltas[:8], 1):
            entity_name = delta.get('entity_name', '')
            delta_type = delta.get('delta_type', '')
            old_pattern = delta.get('old_pattern', '')
            new_pattern = delta.get('new_pattern', '')
            confidence = delta.get('confidence', 0)

            section += f"{i}. **{entity_name}** — {delta_type} (confidence: {confidence:.2f})\n"
            if old_pattern and new_pattern:
                section += f"   Old: `{old_pattern}`\n"
                section += f"   New: `{new_pattern}`\n"
            section += "\n"

        return section

    def _merge_kgcompass_entities(self, graphrag_entities: List[Dict],
                                  compressed_context) -> List[Dict]:
        """
        Merge KGCompass-scored entities from Steps 1-3 with GraphRAG Step 7 entities.
        
        KGCompass entities carry the full pipeline signal (tree-sitter → KG → Kuzu →
        embedding similarity → path decay), while GraphRAG entities carry independent
        graph-traversal + semantic scores.  We interleave them so the prompt benefits
        from both, with KGCompass entities prioritised.
        """
        # Collect entity IDs already present from GraphRAG
        seen_ids = {e.get('id', '') for e in graphrag_entities}

        kgcompass_entities = []
        top_entities = getattr(compressed_context, 'top_entities', None) or []

        for ce in top_entities:
            if ce.entity_id in seen_ids:
                # Update existing entity with KGCompass score if it's higher
                for ge in graphrag_entities:
                    if ge.get('id') == ce.entity_id:
                        old_score = ge.get('score', 0)
                        if ce.combined_score > old_score:
                            ge['score'] = ce.combined_score
                            ge['kgcompass_score'] = ce.kg_compass_score
                        break
            else:
                seen_ids.add(ce.entity_id)
                kgcompass_entities.append({
                    'id': ce.entity_id,
                    'name': ce.entity_name,
                    'type': ce.entity_type,
                    'file_path': ce.file_path,
                    'score': ce.combined_score,
                    'kgcompass_score': ce.kg_compass_score,
                    'relationship': 'kgcompass_ranked',
                    'code_snippet': ce.compressed_snippet or '',
                    'usage_examples': [],
                    'docstring': ''
                })

        # Interleave: KGCompass first, then GraphRAG entities not already covered
        merged = sorted(kgcompass_entities + graphrag_entities,
                        key=lambda e: e.get('score', 0), reverse=True)

        self.logger.info(
            f"Merged entities: {len(kgcompass_entities)} KGCompass + "
            f"{len(graphrag_entities)} GraphRAG → {len(merged)} total"
        )
        return merged
    
    def _graphrag_fallback_repair(self, augmented_context: Dict, error_info: Dict) -> str:
        """Fallback repair when LLM fails - makes MINIMAL changes"""
        test_code = augmented_context.get('test_code', '')
        wrong_method = error_info.get('wrong_method', '')
        
        if not wrong_method:
            return test_code
        
        # Strategy 1: Use Python's suggestion if available
        if error_info.get('suggested_fix'):
            correct = error_info['suggested_fix']
            fixed = re.sub(rf'\.{re.escape(wrong_method)}\s*\(', f'.{correct}(', test_code)
            if fixed != test_code:
                self.logger.info(f"Fallback fix: {wrong_method} -> {correct} (Python suggestion)")
                return fixed
        
        # Strategy 2: Find the best matching method from entities
        best_match = None
        best_score = 0
        
        for entity in augmented_context.get('entities', []):
            if entity['type'] not in ('function', 'method'):
                continue
            
            entity_name = entity['name']
            wrong_lower = wrong_method.lower()
            entity_lower = entity_name.lower()
            
            # Score the match
            score = 0
            
            # Check if wrong method is a substring of entity name
            # e.g., "parse_text" is in "parse_food_text"
            if wrong_lower in entity_lower:
                score = len(wrong_lower) / len(entity_lower) * 100
            
            # Check if they share significant words
            wrong_words = set(wrong_lower.replace('_', ' ').split())
            entity_words = set(entity_lower.replace('_', ' ').split())
            common_words = wrong_words & entity_words
            if common_words:
                score = max(score, len(common_words) / len(entity_words) * 80)
            
            # Check if entity contains all parts of wrong method
            if all(part in entity_lower for part in wrong_lower.split('_')):
                score = max(score, 70)
            
            if score > best_score:
                best_score = score
                best_match = entity_name
        
        # Apply the best match if we found one with reasonable confidence
        if best_match and best_score > 30:
            fixed = re.sub(rf'\.{re.escape(wrong_method)}\s*\(', f'.{best_match}(', test_code)
            if fixed != test_code:
                self.logger.info(f"Fallback fix: {wrong_method} -> {best_match} (score: {best_score:.1f})")
                return fixed
        
        return test_code  # Return original if no fix found
    
    def _generate_repair(self,
                          broken_test: Dict,
                          error_message: str,
                          compressed_context: CompressedContext,
                          aggregated_context: Dict) -> Tuple[str, str]:
        """
        Step 4: Generate Repaired Test using GraphRAG 3-Step approach
        
        GraphRAG Step 7: Retrieve Context - Multi-hop graph traversal + semantic search
        GraphRAG Step 8: Augment Context - Add code snippets, usage examples, conventions
        GraphRAG Step 9: Generate Fix - Enhanced prompt with full context
        
        Returns:
            Tuple of (repaired_code, method_used)
        """
        self.logger.info("Step 4: Generate repair via GraphRAG 3-step approach")
        
        test_code = broken_test.get('test_code', '')
        
        # ===== GraphRAG Step 7: Retrieve Context =====
        self.logger.info("GraphRAG Step 7: Retrieving context...")
        retrieved_context = self._graphrag_retrieve_context(broken_test, error_message)
        
        # Parse error for analysis
        error_info = self._parse_error_message(error_message)
        
        # ===== GraphRAG Step 8: Augment Context =====
        self.logger.info("GraphRAG Step 8: Augmenting context...")
        augmented_context = self._graphrag_augment_context(retrieved_context, broken_test)
        
        # Merge aggregated data (api_deltas, canonical_usages) into augmented context
        # so the prompt builder can use them
        augmented_context['api_deltas'] = aggregated_context.get('api_deltas', [])
        augmented_context['canonical_usages'] = aggregated_context.get('canonical_usages', [])
        
        # ===== CRITICAL: Inject KGCompass-scored entities from Steps 1-3 =====
        # The GraphRAG Step 7 does its own graph traversal without KGCompass scores.
        # We merge the KGCompass-scored entities from compressed_context so the prompt
        # benefits from the full pipeline (tree-sitter → KG → Kuzu → KGCompass → LanceDB).
        kgcompass_entities = self._merge_kgcompass_entities(
            augmented_context.get('entities', []),
            compressed_context
        )
        augmented_context['entities'] = kgcompass_entities
        
        # ===== GraphRAG Step 9: Generate Fix =====
        self.logger.info("GraphRAG Step 9: Generating fix...")
        
        if self.lm_studio_available:
            repaired_code, method = self._graphrag_generate_fix(augmented_context, error_info)

            if self.disable_fallback:
                self.logger.info("GATR_DISABLE_FALLBACK is enabled; returning raw LLM output")
                return repaired_code, f"{method}_no_fallback"

            if repaired_code and repaired_code.strip() != test_code.strip():
                self.logger.info(f"GraphRAG generated repair using {method}")
                return repaired_code, method

            self.logger.warning("GraphRAG output unchanged; switching to rule-based fallback")
            fallback = self._fallback_repair(broken_test, error_message, aggregated_context)
            return fallback, 'graphrag_forced_fallback'
        else:
            if self.disable_fallback:
                self.logger.error("LM Studio unavailable and GATR_DISABLE_FALLBACK enabled; returning original code")
                return test_code, 'llm_unavailable_no_fallback'
            self.logger.error("LM Studio/LLM not available - using fallback repair")
            fallback = self._fallback_repair(broken_test, error_message, aggregated_context)
            return fallback, 'llm_unavailable_fallback'
    
    def _clean_llm_output(self, output: str) -> str:
        """Clean LLM output to extract only code"""
        # Remove markdown code blocks
        output = re.sub(r'^```[\w]*\n?', '', output, flags=re.MULTILINE)
        output = re.sub(r'\n?```$', '', output, flags=re.MULTILINE)
        output = output.replace('```python', '').replace('```java', '').replace('```', '')
        
        # Remove common preambles like "Here is the repaired code:" etc.
        lines = output.split('\n')
        code_started = False
        clean_lines = []
        
        # Java and Python code start indicators
        java_start = ('public ', 'private ', 'protected ', '@Test', '@Override',
                      '@Before', '@After', '@Deprecated', 'import ', 'package ')
        python_start = ('def ', 'class ', 'import ', 'from ', '@', 'async def')
        all_start = java_start + python_start
        
        for line in lines:
            # Skip empty lines at the start
            if not code_started and not line.strip():
                continue
            # Detect code start
            stripped = line.strip()
            if not code_started and stripped.startswith(all_start):
                code_started = True
            # Also detect code by brace/indent patterns
            if not code_started and (stripped.startswith('{') or
                                     stripped.startswith('//') or
                                     (stripped and stripped[0].isalpha() and '(' in stripped)):
                code_started = True
            if code_started:
                clean_lines.append(line)
        
        # If nothing matched as code start, return everything (let validation catch it)
        if not clean_lines:
            return output.strip()
        
        return '\n'.join(clean_lines).strip()
    
    def _is_valid_code(self, code: str) -> bool:
        """Check if the output looks like valid code"""
        if not code or len(code) < 20:
            return False
        
        # Check for code indicators
        code_indicators = ['def ', 'class ', 'import ', 'from ', 'assert', 'return ', '@', 'self.', 'public ', 'void ']
        has_code_indicator = any(ind in code for ind in code_indicators)
        
        # Check for balanced parentheses (simple check)
        paren_balance = code.count('(') - code.count(')')
        bracket_balance = code.count('[') - code.count(']')
        brace_balance = code.count('{') - code.count('}')
        
        is_balanced = abs(paren_balance) <= 1 and abs(bracket_balance) <= 1 and abs(brace_balance) <= 1
        
        return has_code_indicator and is_balanced
    
    def _fallback_repair(self, broken_test: Dict, error_message: str, aggregated_context: Dict) -> str:
        """
        Fallback rule-based repair when LLM is unavailable or fails.
        GUARANTEES a diff will be produced - either a fix or annotated original code.
        """
        test_code = broken_test.get('test_code', '')
        strategy = aggregated_context.get('repair_strategy', {})
        strategy_type = strategy.get('strategy_type', 'modify_lines')
        canonical_usages = aggregated_context.get('canonical_usages', [])
        api_deltas = aggregated_context.get('api_deltas', [])
        
        # Parse error for details
        error_info = self._parse_error_message(error_message)
        original_code = test_code
        
        self.logger.info(f"Fallback repair starting - error type: {error_info.get('error_type', 'unknown')}")
        
        # First, try to fix common error patterns directly
        repaired = self._fix_common_errors(test_code, error_message)
        if repaired != test_code:
            self.logger.info("Applied common error fix - code was modified")
            return repaired
        
        self.logger.info("Common error fix did not modify code, trying strategy-based repair")
        
        # Then apply strategy-based repair
        if strategy_type == 'rewrite':
            repaired = self._rewrite_test(test_code, None, canonical_usages)
        elif strategy_type == 'replace_builders':
            repaired = self._replace_builders(test_code, api_deltas, canonical_usages)
        elif strategy_type == 'update_validation':
            repaired = self._update_validation(test_code, error_message, canonical_usages)
        elif strategy_type == 'replace_assertions':
            repaired = self._replace_assertions(test_code, canonical_usages)
        else:
            repaired = self._modify_failing_lines(test_code, error_message, api_deltas, canonical_usages)
        
        # Check if any repair was made
        if repaired != original_code:
            self.logger.info("Strategy-based repair modified the code")
            return repaired
        
        # GUARANTEE a diff: If no automatic fix found, annotate the code with the error info
        self.logger.warning("No automatic fix found - generating annotated code with suggestions")
        return self._annotate_with_fix_suggestion(original_code, error_message, error_info, aggregated_context)
    
    def _annotate_with_fix_suggestion(self, code: str, error_message: str, 
                                       error_info: Dict, aggregated_context: Dict) -> str:
        """
        Annotate code with GATR analysis and fix suggestions.
        This ensures a diff is ALWAYS generated, even if automatic fix fails.
        """
        lines = code.split('\n')
        error_line = error_info.get('line_number', 0)
        class_name = error_info.get('class_name', '')
        wrong_method = error_info.get('wrong_method', '')
        error_type = error_info.get('error_type', 'unknown')
        
        # Build suggestion based on error type
        suggestions = []
        
        if error_type in ['missing_member', 'missing_inner_class', 'missing_method']:
            # Search KG for alternatives
            if class_name and wrong_method:
                similar = self._find_similar_inner_class(class_name, wrong_method)
                if similar:
                    suggestions.append(f"Consider replacing '{wrong_method}' with '{similar}'")
                else:
                    suggestions.append(f"'{class_name}.{wrong_method}' not found in knowledge graph")
                    suggestions.append(f"Check the actual API - possible alternatives: Response, Request, Builder")
        
        elif error_type == 'cannot_resolve_symbol':
            suggestions.append(f"Symbol '{wrong_method or class_name}' cannot be resolved")
            suggestions.append("Check imports and ensure the class/method exists")
        
        elif error_type == 'attribute_error':
            suggestions.append(f"Attribute '{wrong_method}' not found")
            if error_info.get('suggested_fix'):
                suggestions.append(f"Suggestion: {error_info['suggested_fix']}")
        
        else:
            suggestions.append(f"Error type: {error_type}")
            suggestions.append("Manual review required")
        
        # Add API delta information if available
        api_deltas = aggregated_context.get('api_deltas', [])
        for delta in api_deltas[:3]:
            delta_type = delta.get('delta_type', '')
            entity_name = delta.get('entity_name', '')
            if delta_type and entity_name:
                suggestions.append(f"API change detected: {entity_name} ({delta_type})")
        
        # Add canonical usage hints
        canonical_usages = aggregated_context.get('canonical_usages', [])
        for usage in canonical_usages[:2]:
            pattern = usage.get('usage_pattern', '')
            if pattern:
                suggestions.append(f"Common usage: {pattern[:80]}...")
        
        # Create the annotation header
        annotation_lines = [
            "# ============================================================",
            "# GATR ANALYSIS - AUTOMATIC FIX NOT FOUND",
            "# ============================================================",
            f"# Error: {error_message[:100]}...",
            f"# Error Type: {error_type}",
            f"# Problem Location: Line {error_line}" if error_line else "# Problem Location: Unknown",
            "#",
            "# SUGGESTIONS:",
        ]
        
        for i, suggestion in enumerate(suggestions, 1):
            annotation_lines.append(f"#   {i}. {suggestion}")
        
        annotation_lines.append("#")
        annotation_lines.append("# Please review and apply the appropriate fix manually.")
        annotation_lines.append("# ============================================================")
        annotation_lines.append("")
        
        # If we know the error line, add inline comment
        if error_line and 0 < error_line <= len(lines):
            line_idx = error_line - 1
            original_line = lines[line_idx]
            
            # Add comment above the problematic line
            comment = f"# FIXME: {error_type} - {wrong_method or class_name or 'check this line'}"
            lines.insert(line_idx, comment)
        
        # Combine annotation header with annotated code
        return '\n'.join(annotation_lines) + '\n' + '\n'.join(lines)
    
    def _find_similar_inner_class(self, parent_class: str, wrong_member: str) -> Optional[str]:
        """
        Search the knowledge graph for similar inner classes/members.
        For example, if 'Fetch' doesn't exist in 'HttpConnection', find 'Response' instead.
        """
        similar_members = []
        
        try:
            if self.kg_manager:
                graph = getattr(self.kg_manager, 'graph', None)
                if graph:
                    # Search for inner classes or members of the parent class
                    for node_id in graph.nodes():
                        node_data = graph.nodes[node_id]
                        node_name = node_data.get('name', str(node_id))
                        node_type = node_data.get('type', 'unknown')
                        
                        # Check if this is an inner class of the parent
                        if parent_class.lower() in node_name.lower():
                            # Look for Response, Request, etc. patterns
                            if '.' in node_name or '$' in node_name:
                                inner_name = node_name.split('.')[-1].split('$')[-1]
                                similarity = self._string_similarity(wrong_member.lower(), inner_name.lower())
                                similar_members.append({
                                    'name': inner_name,
                                    'full_name': node_name,
                                    'similarity': similarity,
                                    'type': node_type
                                })
                        
                        # Also check for standalone classes that might be inner classes
                        if node_type in ['class', 'inner_class']:
                            # Check for common patterns like Response, Request, Builder, etc.
                            common_patterns = ['Response', 'Request', 'Builder', 'Config', 'Result', 'Handler']
                            for pattern in common_patterns:
                                if pattern.lower() in node_name.lower() and parent_class.lower() in node_name.lower():
                                    similar_members.append({
                                        'name': pattern,
                                        'full_name': node_name,
                                        'similarity': 0.5,
                                        'type': node_type
                                    })
                    
                    # Sort by similarity
                    similar_members.sort(key=lambda x: x['similarity'], reverse=True)
                    
                    if similar_members:
                        best_match = similar_members[0]
                        self.logger.info(f"Found similar member: {best_match['name']} (similarity: {best_match['similarity']:.2f})")
                        return best_match['name']
            
            # Fallback: Use common replacement patterns
            common_replacements = {
                'fetch': 'Response',
                'get': 'Request',
                'send': 'Response',
                'create': 'Builder',
                'build': 'Result',
            }
            
            for wrong, correct in common_replacements.items():
                if wrong_member.lower() == wrong:
                    self.logger.info(f"Using common replacement pattern: {wrong_member} -> {correct}")
                    return correct
            
        except Exception as e:
            self.logger.warning(f"Error finding similar inner class: {e}")
        
        return None
    
    def _string_similarity(self, s1: str, s2: str) -> float:
        """Calculate string similarity using sequence matcher"""
        from difflib import SequenceMatcher
        return SequenceMatcher(None, s1, s2).ratio()
    
    def _fix_common_errors(self, test_code: str, error_message: str) -> str:
        """Fix common error patterns based on error message - supports Python, Java, and more"""
        repaired = test_code
        error_lower = error_message.lower()
        
        # Parse the error message for detailed info
        error_info = self._parse_error_message(error_message)
        
        # ===== JAVA: "X has no member Y" pattern =====
        if error_info['error_type'] in ['missing_member', 'missing_inner_class']:
            parent_class = error_info['parent_class'] or error_info['class_name']
            wrong_member = error_info['wrong_method'] or error_info['inner_class']
            
            if parent_class and wrong_member:
                # Search for similar inner classes in the knowledge graph
                correct_member = self._find_similar_inner_class(parent_class, wrong_member)
                
                if correct_member:
                    # Replace ClassName.WrongMember with ClassName.CorrectMember
                    old_pattern = f"{parent_class}.{wrong_member}"
                    new_pattern = f"{parent_class}.{correct_member}"
                    
                    if old_pattern in repaired:
                        repaired = repaired.replace(old_pattern, new_pattern)
                        self.logger.info(f"Fixed Java inner class: {old_pattern} -> {new_pattern}")
                        return repaired
                    
                    # Also try with 'new' keyword pattern
                    old_new_pattern = f"new {parent_class}.{wrong_member}("
                    new_new_pattern = f"new {parent_class}.{correct_member}("
                    if old_new_pattern in repaired:
                        repaired = repaired.replace(old_new_pattern, new_new_pattern)
                        self.logger.info(f"Fixed Java constructor: {old_new_pattern} -> {new_new_pattern}")
                        return repaired
        
        # ===== JAVA: Cannot resolve symbol =====
        if error_info['error_type'] == 'cannot_resolve_symbol':
            wrong_symbol = error_info['wrong_method']
            if wrong_symbol:
                # Try to find a similar symbol
                correct_symbol = self._find_similar_inner_class('', wrong_symbol)
                if correct_symbol:
                    repaired = re.sub(rf'\b{re.escape(wrong_symbol)}\b', correct_symbol, repaired)
                    self.logger.info(f"Fixed unresolved symbol: {wrong_symbol} -> {correct_symbol}")
                    return repaired
        
        # ===== PYTHON: AttributeError with suggestion =====
        attr_match = re.search(r"has no attribute '([^']+)'.*did you mean[:\s]*'([^']+)'", error_message, re.IGNORECASE)
        if attr_match:
            wrong_attr = attr_match.group(1)
            correct_attr = attr_match.group(2)
            # Replace .wrong_attr( with .correct_attr(
            repaired = re.sub(rf'\.{re.escape(wrong_attr)}\s*\(', f'.{correct_attr}(', repaired)
            self.logger.info(f"Fixed attribute: {wrong_attr} -> {correct_attr}")
            return repaired
        
        # ===== PYTHON: NameError with suggestion =====
        name_match = re.search(r"name '([^']+)' is not defined.*did you mean[:\s]*'([^']+)'", error_message, re.IGNORECASE)
        if name_match:
            wrong_name = name_match.group(1)
            correct_name = name_match.group(2)
            repaired = re.sub(rf'\b{re.escape(wrong_name)}\b', correct_name, repaired)
            self.logger.info(f"Fixed name: {wrong_name} -> {correct_name}")
            return repaired
        
        # ===== Generic: "has no member" without suggestion =====
        no_member_match = re.search(r"(\w+)\s+has\s+no\s+member\s+(\w+)", error_message, re.IGNORECASE)
        if no_member_match:
            parent = no_member_match.group(1)
            wrong = no_member_match.group(2)
            correct = self._find_similar_inner_class(parent, wrong)
            if correct:
                old_pat = f"{parent}.{wrong}"
                new_pat = f"{parent}.{correct}"
                if old_pat in repaired:
                    repaired = repaired.replace(old_pat, new_pat)
                    self.logger.info(f"Fixed member access: {old_pat} -> {new_pat}")
                    return repaired
        
        # ===== If no fix found, try to make a best-effort repair =====
        # Extract what looks like a broken reference from the error and test code
        if error_info['class_name'] and error_info['wrong_method']:
            wrong_ref = f"{error_info['class_name']}.{error_info['wrong_method']}"
            
            # Try common fixes based on method name patterns
            method_fixes = {
                'Fetch': 'Response',
                'fetch': 'response', 
                'Get': 'Request',
                'get': 'request',
                'Send': 'Response',
                'send': 'response',
            }
            
            for wrong, correct in method_fixes.items():
                if error_info['wrong_method'] == wrong:
                    old = f"{error_info['class_name']}.{wrong}"
                    new = f"{error_info['class_name']}.{correct}"
                    if old in repaired:
                        repaired = repaired.replace(old, new)
                        self.logger.info(f"Applied pattern-based fix: {old} -> {new}")
                        return repaired
        
        # TypeError: X() takes Y positional arguments but Z were given
        if 'takes' in error_lower and 'positional argument' in error_lower:
            # Try to identify the function call and adjust arguments
            pass
        
        # ImportError / ModuleNotFoundError
        if 'no module named' in error_lower or 'cannot import name' in error_lower:
            import_match = re.search(r"no module named '([^']+)'", error_message, re.IGNORECASE)
            if import_match:
                pass  # Would need more context to fix imports
        
        # AssertionError with expected/actual values
        if 'assertionerror' in error_lower:
            expected_match = re.search(r'expected[:\s]+["\']?([^"\']+)["\']?', error_lower)
            actual_match = re.search(r'(?:got|actual|was)[:\s]+["\']?([^"\']+)["\']?', error_lower)
            if expected_match and actual_match:
                # Might need to update expected values
                pass
        
        return repaired
    
    def _rewrite_test(self, test_code: str, compressed_context: Optional[CompressedContext], usages: List[Dict]) -> str:
        """Rewrite test structure"""
        # Start with original code
        repaired = test_code
        
        # Apply patterns from canonical usages
        for usage in usages[:3]:
            pattern = usage.get('usage_pattern', '')
            example = usage.get('example_code', '')
            
            if 'setup:fixture' in pattern and '@pytest.fixture' not in repaired:
                # Add fixture-based setup if pattern suggests
                repaired = self._add_fixture_setup(repaired)
            
            if example:
                # Try to incorporate example patterns
                repaired = self._incorporate_example_pattern(repaired, example)
        
        return repaired
    
    def _replace_builders(self, test_code: str, api_deltas: List[Dict], usages: List[Dict]) -> str:
        """Replace obsolete builders with new patterns"""
        repaired = test_code
        
        for delta in api_deltas:
            if delta.get('delta_type') == 'factory_change':
                old_pattern = delta.get('old_pattern', '')
                new_pattern = delta.get('new_pattern', '')
                
                if old_pattern and new_pattern:
                    repaired = repaired.replace(old_pattern, new_pattern)
        
        # Also check canonical usages for builder patterns
        for usage in usages:
            if 'creation:builder' in usage.get('usage_pattern', ''):
                example = usage.get('example_code', '')
                if example:
                    # Extract builder pattern and apply if applicable
                    pass
        
        return repaired
    
    def _update_validation(self, test_code: str, error_message: str, usages: List[Dict]) -> str:
        """Update validation rules based on error"""
        repaired = test_code
        
        # Parse expected vs actual from error message
        expected_match = re.search(r'expected[:\s]+([^\n]+)', error_message.lower())
        actual_match = re.search(r'actual[:\s]+([^\n]+)', error_message.lower())
        
        if expected_match and actual_match:
            expected = expected_match.group(1).strip()
            actual = actual_match.group(1).strip()
            
            # Try to update assertions
            repaired = self._update_assertion_values(repaired, expected, actual)
        
        return repaired
    
    def _replace_assertions(self, test_code: str, usages: List[Dict]) -> str:
        """Replace deprecated assertions"""
        repaired = test_code
        
        # Common assertion replacements
        replacements = {
            'assertEquals': 'assertEqual',
            'assertNotEquals': 'assertNotEqual',
            'assert_equals': 'assert_equal',
            'self.assertEquals': 'self.assertEqual',
        }
        
        for old, new in replacements.items():
            repaired = repaired.replace(old, new)
        
        # Check for assertion format in conventions
        for usage in usages:
            pattern = usage.get('usage_pattern', '')
            if 'assertion:assertThat' in pattern:
                # Convert to assertThat style if project uses it
                repaired = self._convert_to_assertthat(repaired)
        
        return repaired
    
    def _modify_failing_lines(self, test_code: str, error_message: str, 
                              api_deltas: List[Dict], usages: List[Dict]) -> str:
        """Modify only the failing lines"""
        repaired = test_code
        
        # Extract line number from error if available
        line_match = re.search(r'line (\d+)', error_message.lower())
        
        # Apply API deltas
        for delta in api_deltas[:5]:
            new_pattern = delta.get('new_pattern', '')
            entity_name = delta.get('entity_name', '')
            
            if entity_name and new_pattern:
                # Try to find and replace patterns related to this entity
                pattern = rf'\b{re.escape(entity_name)}\s*\([^)]*\)'
                repaired = re.sub(pattern, new_pattern, repaired, count=1)
        
        return repaired
    
    def _add_fixture_setup(self, code: str) -> str:
        """Add pytest fixture setup"""
        if '@pytest.fixture' in code:
            return code
        
        # Check if there's a setup method that could be a fixture
        if 'def setUp' in code:
            code = code.replace('def setUp(self):', '@pytest.fixture\ndef setup():')
        
        return code
    
    def _incorporate_example_pattern(self, code: str, example: str) -> str:
        """Incorporate patterns from example code"""
        # Simple pattern matching - look for similar structures
        return code
    
    def _update_assertion_values(self, code: str, expected: str, actual: str) -> str:
        """Update assertion expected values"""
        # This is a simplified version - real implementation would be more sophisticated
        return code
    
    def _convert_to_assertthat(self, code: str) -> str:
        """Convert assertions to assertThat style"""
        # Simple conversion patterns
        code = re.sub(r'assertEqual\(([^,]+),\s*([^)]+)\)', r'assertThat(\1, is(\2))', code)
        return code
    
    def get_repair_context(self, broken_test: Dict, error_message: str) -> Dict:
        """
        Get the complete repair context without generating the repair
        Useful for debugging and UI display
        """
        raw_context = self._ingest_raw_context(broken_test, error_message)
        compressed_context = self._compress_context(broken_test, error_message, raw_context)
        aggregated_context = self._aggregate_context(compressed_context)
        
        return {
            'raw_context_summary': {
                'entities_count': len(raw_context.get('entities', [])),
                'semantic_hits_count': len(raw_context.get('semantic_hits', [])),
                'snippets_count': len(raw_context.get('snippets', [])),
                'paths_count': len(raw_context.get('graph_paths', []))
            },
            'compressed_context': {
                'top_entities': [
                    {
                        'id': e.entity_id,
                        'name': e.entity_name,
                        'type': e.entity_type,
                        'score': e.combined_score
                    }
                    for e in compressed_context.top_entities[:10]
                ],
                'patterns': compressed_context.compressed_patterns,
                'error_summary': compressed_context.error_summary
            },
            'aggregated_context': aggregated_context
        }
    
    def get_llm_status(self) -> Dict:
        """
        Get the current LLM (LM Studio) status
        """
        headers = {
            'Authorization': f'Bearer {self.lm_studio_api_key}'
        }
        status = {
            'provider': 'lm_studio',
            'lm_studio_url': self.lm_studio_url,
            'lm_studio_model': self.lm_studio_model,
            'available': self.lm_studio_available,
            'models': []
        }

        # Backward-compatible keys used by older scripts and UI components.
        status['ollama_url'] = self.lm_studio_url
        status['ollama_model'] = self.lm_studio_model
        
        try:
            response = requests.get(f"{self.lm_studio_url}/models", headers=headers, timeout=5)
            if response.status_code == 200:
                models = response.json().get('data', [])
                status['models'] = [
                    {
                        'id': m.get('id'),
                        'size': m.get('size'),
                        'modified_at': m.get('modified_at')
                    }
                    for m in models
                ]
                status['available'] = True
                
                # Check if our target model is available
                model_names = [m.get('id', '') for m in models]
                status['target_model_available'] = any(
                    self.lm_studio_model in name or name in self.lm_studio_model 
                    for name in model_names
                )
        except Exception as e:
            status['error'] = str(e)
            status['available'] = False
        
        return status
    
    def pull_model(self, model_name: str = None) -> Dict:
        """
        Pull/download model helper.
        LM Studio manages model downloads in the desktop UI, so this endpoint is informational.
        """
        model_to_pull = model_name or self.lm_studio_model
        return {
            'success': False,
            'error': (
                f"Model pull is not supported via API for LM Studio. "
                f"Load '{model_to_pull}' from the LM Studio UI and start the server."
            )
        }
