"""
Step 5: Calculate Relevance Scores - KGCompass Implementation for GATeR
Main interface for relevance scoring functionality
"""

import logging
import json
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import time

from .relevance_scorer import RelevanceScorer, RelevanceScore
from .embedding_generator import EmbeddingGenerator
from .path_calculator import PathCalculator

# Import vector storage for Step 6 integration
try:
    from ..vector_storage.step6_vector_storage import Step6VectorStorage
    VECTOR_STORAGE_AVAILABLE = True
except ImportError:
    VECTOR_STORAGE_AVAILABLE = False


class Step5RelevanceScoring:
    """
    Step 5 implementation: Calculate Relevance Scores using KGCompass methodology
    
    This class provides the main interface for GATeR's Step 5, implementing
    the KGCompass relevance scoring formula to prioritize entities for test repair.
    """
    
    def __init__(self, 
                 workspace_dir: str = "workspace",
                 alpha: float = 0.3,
                 beta: float = 0.6,
                 top_k: int = 20,
                 auto_store_vectors: bool = True):
        """
        Initialize Step 5 relevance scoring
        
        Args:
            workspace_dir: Workspace directory for caching
            alpha: KGCompass alpha parameter (embedding vs textual similarity balance)
            beta: KGCompass beta parameter (path decay factor)
            top_k: Number of top candidates to return
            auto_store_vectors: Automatically store results in LanceDB (Step 6)
        """
        self.workspace_dir = Path(workspace_dir)
        self.workspace_dir.mkdir(exist_ok=True)
        
        self.alpha = alpha
        self.beta = beta
        self.top_k = top_k
        self.auto_store_vectors = auto_store_vectors
        
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.embedding_generator = EmbeddingGenerator(
            cache_dir=str(self.workspace_dir / "embeddings_cache")
        )
        self.path_calculator = PathCalculator()
        self.relevance_scorer = RelevanceScorer(
            embedding_generator=self.embedding_generator,
            path_calculator=self.path_calculator,
            alpha=alpha,
            beta=beta
        )
        
        # Initialize vector storage for automatic persistence
        self.vector_storage = None
        if auto_store_vectors and VECTOR_STORAGE_AVAILABLE:
            try:
                self.vector_storage = Step6VectorStorage(
                    workspace_dir=workspace_dir,
                    db_path=str(self.workspace_dir / "lancedb")
                )
                self.logger.info("Vector storage (Step 6) initialized for automatic persistence")
            except Exception as e:
                self.logger.warning(f"Could not initialize vector storage: {e}")
        
        self.logger.info(f"Initialized Step 5 with alpha={alpha}, beta={beta}, top_k={top_k}")
    
    def calculate_relevance_scores(self, 
                                 problem_description: str,
                                 knowledge_graph,  # NetworkX graph or KG manager
                                 issue_context: Dict = None) -> Dict:
        """
        Main method to calculate relevance scores for all candidate entities
        
        Args:
            problem_description: Natural language description of the problem/issue
            knowledge_graph: Knowledge graph (NetworkX graph or KG manager)
            issue_context: Additional context about the issue
            
        Returns:
            Dictionary with relevance scoring results
        """
        start_time = time.time()
        self.logger.info("Starting Step 5: Calculate Relevance Scores")
        
        try:
            # Extract graph from KG manager if needed
            if hasattr(knowledge_graph, 'graph'):
                graph = knowledge_graph.graph
            else:
                graph = knowledge_graph
            
            # Step 1: Get issue node (optional - RelevanceScorer handles this automatically)
            issue_node_id = self._get_issue_node(graph, problem_description, issue_context)
            # Note: issue_node_id can be None - the RelevanceScorer will handle starting node detection
            
            # Step 2: Get candidate entities (functions, methods, classes)
            self.logger.debug(f"Graph has {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges")
            
            # Debug: Log all node types in the graph
            node_types = {}
            for node_id, node_data in graph.nodes(data=True):
                node_type = node_data.get('type', 'unknown')
                node_types[node_type] = node_types.get(node_type, 0) + 1
                self.logger.debug(f"Node {node_id}: type={node_type}, data={node_data}")
            
            self.logger.info(f"Graph node types: {node_types}")
            
            candidates = self.relevance_scorer.get_candidate_functions(graph)
            self.logger.info(f"Found {len(candidates)} candidate entities")
            
            if not candidates:
                self.logger.warning("No candidate entities found")
                self.logger.warning(f"Available node types in graph: {list(node_types.keys())}")
                self.logger.warning("Expected types: ['function', 'method', 'class', 'test', 'test_method']")
                return self._create_empty_result()
            
            self.logger.info(f"Found {len(candidates)} candidate entities")
            
            # Step 3: Calculate relevance scores using KGCompass formula
            self.logger.info(f"Starting relevance scoring for {len(candidates)} candidates")
            self.logger.debug(f"Using issue_node_id: {issue_node_id}")
            
            relevance_scores = self.relevance_scorer.rank_entities(
                problem_description=problem_description,
                candidate_entities=candidates,
                graph=graph,
                issue_node_id=issue_node_id,
                top_k=self.top_k
            )
            
            self.logger.info(f"Completed scoring. Got {len(relevance_scores)} scored results")
            
            # Step 4: Analyze ranking quality
            ranking_analysis = self.relevance_scorer.analyze_ranking_quality(relevance_scores)
            
            # Step 5: Prepare results
            processing_time = time.time() - start_time
            
            results = {
                'success': True,
                'step': 5,
                'step_name': 'Calculate Relevance Scores',
                'methodology': 'KGCompass',
                'processing_time': processing_time,
                'hyperparameters': {
                    'alpha': self.alpha,
                    'beta': self.beta,
                    'top_k': self.top_k
                },
                'issue_node_id': issue_node_id,
                'total_candidates': len(candidates),
                'top_candidates': self._serialize_scores(relevance_scores),
                'ranking_analysis': ranking_analysis,
                'timestamp': time.time()
            }
            
            # Save results
            self._save_results(results)
            
            # Step 6: Automatically store in vector database
            if self.auto_store_vectors and self.vector_storage:
                self._store_results_in_vector_db(relevance_scores, problem_description)
            
            self.logger.info(f"Step 5 completed in {processing_time:.2f}s. "
                           f"Top score: {relevance_scores[0].total_score:.4f}")
            
            return results
            
        except Exception as e:
            self.logger.error(f"Error in Step 5: {e}")
            return self._create_error_result(str(e))
    
    def get_top_relevant_functions(self, 
                                 problem_description: str,
                                 knowledge_graph,
                                 top_k: int = None) -> List[Dict]:
        """
        Get top-k most relevant functions for a problem description
        
        Args:
            problem_description: Problem description
            knowledge_graph: Knowledge graph
            top_k: Number of top functions to return (default: self.top_k)
            
        Returns:
            List of relevant function dictionaries with scores
        """
        if top_k is None:
            top_k = self.top_k
        
        results = self.calculate_relevance_scores(problem_description, knowledge_graph)
        
        if not results.get('success', False):
            return []
        
        top_candidates = results.get('top_candidates', [])[:top_k]
        
        # Convert to function format expected by downstream steps
        relevant_functions = []
        for candidate in top_candidates:
            function_info = {
                'entity_id': candidate['entity_id'],
                'name': candidate['entity_name'],
                'type': candidate['entity_type'],
                'relevance_score': candidate['total_score'],
                'semantic_similarity': candidate['semantic_similarity'],
                'textual_similarity': candidate['textual_similarity'],
                'path_length': candidate['path_length'],
                'path_info': candidate['path_info']
            }
            relevant_functions.append(function_info)
        
        return relevant_functions
    
    def _get_issue_node(self, graph, problem_description: str, issue_context: Dict = None) -> Optional[str]:
        """Get or create issue node in the graph - now handled by RelevanceScorer"""
        
        # The new RelevanceScorer handles starting node detection automatically
        # Return None to let the scorer use its flexible approach
        return None
    
    def _serialize_scores(self, scores: List[RelevanceScore]) -> List[Dict]:
        """Convert RelevanceScore objects to serializable dictionaries"""
        serialized = []
        
        for score in scores:
            serialized.append({
                'entity_id': score.entity_id,
                'entity_name': score.entity_name,
                'entity_type': score.entity_type,
                'total_score': score.total_score,
                'semantic_similarity': score.semantic_similarity,
                'textual_similarity': score.textual_similarity,
                'path_length': score.path_length,
                'path_decay_factor': score.path_decay_factor,
                'path_info': score.path_info,
                'file_path': score.file_path
            })
        
        return serialized
    
    def _save_results(self, results: Dict):
        """Save results to workspace"""
        try:
            output_file = self.workspace_dir / "data" / "step5_relevance_scores.json"
            output_file.parent.mkdir(exist_ok=True)
            
            with open(output_file, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            self.logger.info(f"Saved Step 5 results to {output_file}")
            
        except Exception as e:
            self.logger.warning(f"Failed to save results: {e}")
    
    def _store_results_in_vector_db(self, relevance_scores: List[RelevanceScore], problem_description: str):
        """
        Store KGCompass results in LanceDB for retrieval
        
        Args:
            relevance_scores: List of scored entities
            problem_description: Original problem description
        """
        try:
            self.logger.info(f"Storing {len(relevance_scores)} scored entities in LanceDB...")
            
            # Prepare embeddings dictionary for storage
            embeddings_to_store = {}
            
            for score in relevance_scores:
                # Get the entity's embedding from cache/generator
                entity_text = self.embedding_generator.prepare_code_entity_text({
                    'name': score.entity_name,
                    'type': score.entity_type,
                    'file_path': score.file_path
                })
                
                # Get embedding (will use cache if available)
                embedding = self.embedding_generator.generate_embedding(entity_text)
                
                # CRITICAL FIX: Extract actual code snippet from file
                code_snippet = self._extract_code_snippet(
                    score.file_path,
                    getattr(score, 'line_start', 0),
                    getattr(score, 'line_end', 0)
                )
                
                # Prepare storage record
                embeddings_to_store[score.entity_id] = {
                    'embedding': embedding.tolist() if hasattr(embedding, 'tolist') else embedding,
                    'metadata': {
                        'entity_name': score.entity_name,
                        'entity_type': score.entity_type,
                        'file_path': score.file_path,
                        'line_start': getattr(score, 'line_start', 0),
                        'line_end': getattr(score, 'line_end', 0),
                        'relevance_score': float(score.total_score),
                        'semantic_similarity': float(score.semantic_similarity),
                        'textual_similarity': float(score.textual_similarity),
                        'path_length': float(score.path_length),
                        'path_decay_factor': float(score.path_decay_factor),
                        'code_snippet': code_snippet,  # Actual code from file
                        'created_at': time.time(),
                        'problem_description': problem_description[:200],  # Store query context
                        'kgcompass_scored': True
                    }
                }
            
            # Store in LanceDB
            result = self.vector_storage.store_embeddings(embeddings_to_store)
            
            if result.get('success'):
                stored_count = result.get('vectors_stored', 0)
                self.logger.info(f"✅ Successfully stored {stored_count} KGCompass results in LanceDB")
            else:
                self.logger.warning(f"Vector storage returned: {result}")
                
        except Exception as e:
            self.logger.error(f"Failed to store results in vector DB: {e}", exc_info=True)
    
    def _extract_code_snippet(self, file_path: str, line_start: int = 0, line_end: int = 0, max_lines: int = 15) -> str:
        """
        Extract code snippet from file during ingestion.
        
        Args:
            file_path: Path to source file
            line_start: Starting line number (1-indexed)
            line_end: Ending line number (1-indexed)
            max_lines: Maximum lines to extract (default: 15)
        
        Returns:
            Extracted code snippet or empty string if failed
        """
        if not file_path:
            return ''
        
        try:
            from pathlib import Path
            path = Path(file_path)
            
            # Try multiple path resolution strategies
            if not path.exists():
                # Strategy 1: Relative to current working directory
                path = (Path.cwd() / file_path).resolve()
            
            if not path.exists():
                # Strategy 2: Relative to workspace/repos (common for parsed repos)
                path = (Path.cwd() / 'workspace' / 'repos' / file_path).resolve()
            
            if not path.exists():
                # Strategy 3: Search in workspace/repos subdirectories
                repos_path = Path.cwd() / 'workspace' / 'repos'
                if repos_path.exists():
                    # Try to find the file in any subdirectory
                    for repo_dir in repos_path.iterdir():
                        if repo_dir.is_dir():
                            candidate = (repo_dir / file_path).resolve()
                            if candidate.exists():
                                path = candidate
                                break
            
            if not path.exists():
                return ''
            
            lines = path.read_text(encoding='utf-8', errors='ignore').splitlines()
            if not lines:
                return ''
            
            if line_start and line_end and line_start > 0 and line_end >= line_start:
                # Extract specified range
                start = max(0, line_start - 1)
                end = min(len(lines), line_end)
                snippet = lines[start:end]
                return '\n'.join(snippet[:max_lines]).strip()
            
            # Fallback: return first max_lines from file
            return '\n'.join(lines[:max_lines]).strip()
            
        except Exception as e:
            self.logger.debug(f"Failed to extract snippet from {file_path}: {e}")
            return ''
    
    def _create_error_result(self, error_message: str) -> Dict:
        """Create error result dictionary"""
        return {
            'success': False,
            'step': 5,
            'step_name': 'Calculate Relevance Scores',
            'error': error_message,
            'timestamp': time.time()
        }
    
    def _create_empty_result(self) -> Dict:
        """Create empty result dictionary"""
        return {
            'success': True,
            'step': 5,
            'step_name': 'Calculate Relevance Scores',
            'total_candidates': 0,
            'top_candidates': [],
            'ranking_analysis': {},
            'timestamp': time.time()
        }
    
    def update_hyperparameters(self, alpha: float = None, beta: float = None, top_k: int = None):
        """Update hyperparameters"""
        if alpha is not None:
            self.alpha = alpha
            self.relevance_scorer.update_hyperparameters(alpha=alpha)
        
        if beta is not None:
            self.beta = beta
            self.relevance_scorer.update_hyperparameters(beta=beta)
        
        if top_k is not None:
            self.top_k = top_k
        
        self.logger.info(f"Updated hyperparameters: alpha={self.alpha}, beta={self.beta}, top_k={self.top_k}")
    
    def get_embedding_stats(self) -> Dict:
        """Get embedding cache statistics"""
        return self.embedding_generator.get_cache_stats()
    
    def clear_cache(self):
        """Clear embedding cache"""
        self.embedding_generator.clear_cache()
        self.logger.info("Cleared embedding cache")


def main():
    """Example usage of Step 5"""
    import sys
    sys.path.append('.')
    
    # Example problem description
    problem_description = """
    There is an error when printing matrix expressions with special characters.
    The print function fails when processing expressions with 'y*' characters,
    causing a ProgrammingError. The issue seems to be in the matrix printing logic
    where it tries to access attributes that might not exist.
    """
    
    # Initialize Step 5
    step5 = Step5RelevanceScoring()
    
    # For demonstration, create a simple mock graph
    import networkx as nx
    
    graph = nx.Graph()
    
    # Add issue node
    graph.add_node("issue_1", type="issue", title="Matrix printing error", 
                   body=problem_description)
    
    # Add some function nodes
    graph.add_node("func_1", type="function", name="print_MatAdd", 
                   file_path="sympy/printing/latex.py")
    graph.add_node("func_2", type="function", name="_print_MatAdd", 
                   file_path="sympy/printing/latex.py")
    graph.add_node("func_3", type="function", name="print_Add", 
                   file_path="sympy/printing/latex.py")
    
    # Add relationships
    graph.add_edge("issue_1", "func_2", type="MENTIONS")
    graph.add_edge("func_2", "func_3", type="CALLS")
    
    # Calculate relevance scores
    results = step5.calculate_relevance_scores(problem_description, graph)
    
    print(f"Step 5 Results:")
    print(f"Success: {results['success']}")
    print(f"Total candidates: {results['total_candidates']}")
    print(f"Top candidates: {len(results['top_candidates'])}")
    
    for i, candidate in enumerate(results['top_candidates'][:5]):
        print(f"{i+1}. {candidate['entity_name']} (score: {candidate['total_score']:.4f})")


if __name__ == "__main__":
    main()
