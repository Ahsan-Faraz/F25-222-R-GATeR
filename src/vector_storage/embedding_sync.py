"""
EmbeddingSync - Synchronization between Step 5 and LanceDB
Handles syncing embeddings from relevance scoring to vector storage
"""

import logging
import os
import numpy as np
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class EmbeddingSync:
    """
    Manages synchronization between Step 5 embeddings and LanceDB storage
    """
    
    def __init__(self, lance_manager, vector_indexer):
        """
        Initialize EmbeddingSync
        
        Args:
            lance_manager: LanceManager instance
            vector_indexer: VectorIndexer instance
        """
        self.lance_manager = lance_manager
        self.vector_indexer = vector_indexer
        self.table_name = "code_entity_embeddings"
        logger.info("Initialized EmbeddingSync")
    
    def sync_from_knowledge_graph(self, kg_manager, relevance_scorer, clear_existing: bool = True) -> Dict[str, Any]:
        """
        Full sync: Extract ALL entities from KG and store in LanceDB with deduplication
        
        Args:
            kg_manager: KnowledgeGraphManager instance
            relevance_scorer: Step5RelevanceScoring instance
            clear_existing: Whether to clear existing embeddings first (default: True)
            
        Returns:
            Dictionary with sync results
        """
        logger.info("Starting full sync from knowledge graph (all entity types)")
        
        if not self.lance_manager.is_available():
            return {
                'success': False,
                'error': 'LanceDB not available',
                'fallback': 'Using in-memory storage only'
            }
        
        try:
            # Clear existing embeddings if requested
            if clear_existing:
                try:
                    self.lance_manager.delete_table(self.table_name)
                    logger.info(f"Cleared existing table: {self.table_name}")
                except Exception as e:
                    logger.debug(f"Table doesn't exist or couldn't be deleted: {e}")
            
            # Get all entities from knowledge graph (not just specific types)
            graph = kg_manager.graph
            
            # Collect ALL entities with deduplication by (name, file_path)
            seen_keys: Set[Tuple[str, str]] = set()
            candidates = []
            
            for node_id, node_data in graph.nodes(data=True):
                entity_name = node_data.get('name', node_id)
                entity_type = node_data.get('type', 'unknown')
                file_path = node_data.get('file_path', '')
                
                # Skip if already seen (deduplication by name + file)
                dedup_key = (entity_name, file_path)
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)
                
                # Skip empty or invalid names
                if not entity_name or entity_name == 'None':
                    continue
                
                # Skip entities without valid file paths (these are typically function calls, not definitions)
                # This filters out noisy entities like "parser.parse_food_text" without file context
                if not file_path or file_path.strip() == '':
                    # Allow certain types even without file path (e.g., Repository, Commit)
                    if entity_type not in ['Repository', 'Commit', 'resource']:
                        continue
                
                candidates.append({
                    'entity_id': node_id,
                    'entity_name': entity_name,
                    'entity_type': entity_type,
                    'file_path': file_path,
                    'line_start': node_data.get('line_start', 0),
                    'line_end': node_data.get('line_end', 0),
                })
            
            logger.info(f"Found {len(candidates)} unique entities for embedding (from {graph.number_of_nodes()} total nodes, {len(seen_keys)} unique name+file combos)")
            
            if not candidates:
                return {
                    'success': True,
                    'vectors_synced': 0,
                    'message': 'No candidates found in knowledge graph'
                }
            
            # Auto-detect repository path for code extraction
            repo_path = self._find_repository_path()
            if repo_path:
                logger.info(f"Extracting code snippets from repository: {repo_path}")
                snippets_extracted = 0
                
                for candidate in candidates:
                    code_snippet = self._extract_code_snippet(
                        file_path=candidate['file_path'],
                        line_start=candidate['line_start'],
                        line_end=candidate['line_end'],
                        repo_path=repo_path
                    )
                    candidate['code_snippet'] = code_snippet
                    if code_snippet:
                        snippets_extracted += 1
                
                snippet_coverage = (snippets_extracted / len(candidates) * 100) if candidates else 0
                logger.info(f"Extracted {snippets_extracted}/{len(candidates)} code snippets ({snippet_coverage:.2f}%)")
            else:
                logger.warning("Could not find repository path, skipping code extraction")
                for candidate in candidates:
                    candidate['code_snippet'] = ''
            
            # Generate embeddings using Step 5's embedding generator
            vectors_to_store = []
            
            for i, candidate in enumerate(candidates):
                try:
                    # Prepare text for embedding
                    text = self._prepare_entity_text(candidate)
                    
                    # Generate embedding
                    embedding = relevance_scorer.embedding_generator.generate_embedding(text)
                    
                    # Add to storage list
                    vectors_to_store.append({
                        'entity_id': candidate['entity_id'],
                        'entity_name': candidate['entity_name'],
                        'entity_type': candidate['entity_type'],
                        'file_path': candidate['file_path'],
                        'line_start': candidate['line_start'],
                        'line_end': candidate['line_end'],
                        'embedding': embedding,
                        'code_snippet': candidate.get('code_snippet', ''),
                        'relevance_score': 0.0,  # Will be updated during relevance calculation
                        'semantic_similarity': 0.0,
                        'textual_similarity': 0.0,
                    })
                    
                    # Log progress every 100 entities
                    if (i + 1) % 100 == 0:
                        logger.info(f"Generated embeddings for {i + 1}/{len(candidates)} entities")
                    
                except Exception as e:
                    logger.warning(f"Failed to generate embedding for {candidate['entity_id']}: {e}")
                    continue
            
            logger.info(f"Generated {len(vectors_to_store)} embeddings total")
            
            # Store in LanceDB in batches
            batch_size = 1000
            total_inserted = 0
            
            for i in range(0, len(vectors_to_store), batch_size):
                batch = vectors_to_store[i:i+batch_size]
                result = self.lance_manager.add_vectors(self.table_name, batch)
                
                if result.get('success'):
                    total_inserted += result.get('inserted', 0)
                    logger.info(f"Inserted batch {i//batch_size + 1}: {result.get('inserted', 0)} vectors")
            
            # Create index for efficient search
            if total_inserted > 0:
                self.vector_indexer.create_index(self.table_name)
            
            # Log entity type breakdown
            type_counts = {}
            for v in vectors_to_store:
                t = v['entity_type']
                type_counts[t] = type_counts.get(t, 0) + 1
            logger.info(f"Entity type breakdown: {type_counts}")
            
            return {
                'success': True,
                'vectors_synced': total_inserted,
                'total_candidates': len(candidates),
                'unique_entities': len(seen_keys),
                'table_name': self.table_name,
                'entity_types': type_counts
            }
            
        except Exception as e:
            logger.error(f"Error in full sync: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def sync_relevance_results(self, relevance_results: Dict) -> Dict[str, Any]:
        """
        Sync relevance scoring results to update scores in LanceDB
        
        Args:
            relevance_results: Results from Step 5 relevance scoring
            
        Returns:
            Dictionary with sync results
        """
        if not self.lance_manager.is_available():
            return {'success': False, 'error': 'LanceDB not available'}
        
        try:
            top_candidates = relevance_results.get('top_candidates', [])
            
            if not top_candidates:
                return {'success': True, 'updated': 0}
            
            # Extract entity IDs and prepare update data
            vectors_to_update = []
            entity_ids = []
            
            for candidate in top_candidates:
                entity_id = candidate.get('entity_id', '')
                if not entity_id:
                    continue
                
                entity_ids.append(entity_id)
                
                # Get embedding if available
                embedding = candidate.get('embedding', None)
                if embedding is None:
                    # Try to get from cache
                    continue
                
                vectors_to_update.append({
                    'entity_id': entity_id,
                    'entity_name': candidate.get('entity_name', ''),
                    'entity_type': candidate.get('entity_type', ''),
                    'file_path': candidate.get('file_path', ''),
                    'embedding': embedding,
                    'relevance_score': candidate.get('total_score', 0.0),
                    'semantic_similarity': candidate.get('semantic_similarity', 0.0),
                    'textual_similarity': candidate.get('textual_similarity', 0.0),
                    'code_snippet': candidate.get('code_snippet', ''),
                    'line_start': candidate.get('line_start', 0),
                    'line_end': candidate.get('line_end', 0),
                })
            
            if not vectors_to_update:
                return {'success': True, 'updated': 0}
            
            # Update vectors in LanceDB
            result = self.lance_manager.update_vectors(
                self.table_name, 
                entity_ids, 
                vectors_to_update
            )
            
            return {
                'success': result.get('success', False),
                'updated': len(vectors_to_update)
            }
            
        except Exception as e:
            logger.error(f"Error syncing relevance results: {e}")
            return {'success': False, 'error': str(e)}
    
    def incremental_sync(self, changed_entities: List[str], kg_manager, 
                        relevance_scorer) -> Dict[str, Any]:
        """
        Incremental sync for changed entities only (all entity types)
        
        Args:
            changed_entities: List of entity IDs that changed
            kg_manager: KnowledgeGraphManager instance
            relevance_scorer: Step5RelevanceScoring instance
            
        Returns:
            Dictionary with sync results
        """
        if not self.lance_manager.is_available():
            return {'success': False, 'error': 'LanceDB not available'}
        
        logger.info(f"Incremental sync for {len(changed_entities)} changed entities")
        
        try:
            graph = kg_manager.graph
            vectors_to_update = []
            seen_keys: Set[Tuple[str, str]] = set()
            
            for entity_id in changed_entities:
                # Get entity data from graph
                if not graph.has_node(entity_id):
                    logger.warning(f"Entity {entity_id} not found in graph")
                    continue
                
                node_data = graph.nodes[entity_id]
                entity_name = node_data.get('name', entity_id)
                entity_type = node_data.get('type', 'unknown')
                file_path = node_data.get('file_path', '')
                
                # Skip duplicates by (name, file_path)
                dedup_key = (entity_name, file_path)
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)
                
                # Skip empty names
                if not entity_name or entity_name == 'None':
                    continue
                
                # Skip entities without valid file paths (these are typically function calls, not definitions)
                # This filters out noisy entities like "parser.parse_food_text" without file context
                if not file_path or file_path.strip() == '':
                    # Allow certain types even without file path (e.g., Repository, Commit)
                    if entity_type not in ['Repository', 'Commit', 'resource']:
                        logger.debug(f"Skipping entity without file path: {entity_name} ({entity_type})")
                        continue
                
                # Prepare entity data
                candidate = {
                    'entity_id': entity_id,
                    'entity_name': entity_name,
                    'entity_type': entity_type,
                    'file_path': file_path,
                    'line_start': node_data.get('line_start', 0),
                    'line_end': node_data.get('line_end', 0),
                    'code_snippet': node_data.get('code', ''),
                }
                
                # Generate embedding
                text = self._prepare_entity_text(candidate)
                embedding = relevance_scorer.embedding_generator.generate_embedding(text)
                
                vectors_to_update.append({
                    'entity_id': entity_id,
                    'entity_name': candidate['entity_name'],
                    'entity_type': entity_type,
                    'file_path': candidate['file_path'],
                    'line_start': candidate['line_start'],
                    'line_end': candidate['line_end'],
                    'embedding': embedding,
                    'code_snippet': candidate.get('code_snippet', ''),
                    'relevance_score': 0.0,
                    'semantic_similarity': 0.0,
                    'textual_similarity': 0.0,
                })
            
            if not vectors_to_update:
                return {'success': True, 'updated': 0}
            
            # Update in LanceDB
            result = self.lance_manager.update_vectors(
                self.table_name,
                changed_entities,
                vectors_to_update
            )
            
            return {
                'success': result.get('success', False),
                'updated': len(vectors_to_update)
            }
            
        except Exception as e:
            logger.error(f"Error in incremental sync: {e}")
            return {'success': False, 'error': str(e)}
    
    def verify_consistency(self, kg_manager) -> Dict[str, Any]:
        """
        Verify consistency between knowledge graph and vector storage
        
        Args:
            kg_manager: KnowledgeGraphManager instance
            
        Returns:
            Dictionary with consistency check results
        """
        if not self.lance_manager.is_available():
            return {'consistent': False, 'error': 'LanceDB not available'}
        
        try:
            # Get unique entity count from graph (with deduplication by name)
            # Only count entities that would actually be synced (have valid file paths)
            graph = kg_manager.graph
            seen_names: Set[str] = set()
            
            for node_id, node_data in graph.nodes(data=True):
                entity_name = node_data.get('name', node_id)
                entity_type = node_data.get('type', 'unknown')
                file_path = node_data.get('file_path', '')
                
                if not entity_name or entity_name == 'None':
                    continue
                    
                # Skip entities without valid file paths (matching sync logic)
                if not file_path or file_path.strip() == '':
                    if entity_type not in ['Repository', 'Commit', 'resource']:
                        continue
                
                seen_names.add(entity_name)
            
            # Get LanceDB stats
            stats = self.lance_manager.get_table_stats(self.table_name)
            lance_count = stats.get('total_vectors', 0)
            
            # Check consistency
            graph_count = len(seen_names)
            diff = abs(graph_count - lance_count)
            consistent = diff < 50  # Allow some discrepancy for edge cases
            
            return {
                'consistent': consistent,
                'graph_entities': graph_count,
                'lance_entities': lance_count,
                'difference': diff,
                'discrepancy_threshold': 50
            }
            
        except Exception as e:
            logger.error(f"Error verifying consistency: {e}")
            return {'consistent': False, 'error': str(e)}
    
    def _prepare_entity_text(self, entity: Dict) -> str:
        """
        Prepare text representation of entity for embedding
        
        Args:
            entity: Entity dictionary
            
        Returns:
            Text representation
        """
        # Combine entity information for better embeddings
        parts = []
        
        # Add entity name and type
        parts.append(f"{entity.get('entity_type', '')} {entity.get('entity_name', '')}")
        
        # Add file path context
        file_path = entity.get('file_path', '')
        if file_path:
            parts.append(f"in {file_path}")
        
        # Add code snippet if available
        code = entity.get('code_snippet', '')
        if code:
            # Limit code length
            if len(code) > 500:
                code = code[:500] + "..."
            parts.append(code)
        
        return " ".join(parts)
    
    def get_sync_stats(self) -> Dict[str, Any]:
        """
        Get synchronization statistics
        
        Returns:
            Dictionary with sync stats
        """
        if not self.lance_manager.is_available():
            return {'available': False}
        
        try:
            stats = self.lance_manager.get_table_stats(self.table_name)
            
            return {
                'available': True,
                'table_name': self.table_name,
                'total_vectors': stats.get('total_vectors', 0),
                'last_sync': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting sync stats: {e}")
            return {'available': False, 'error': str(e)}
    
    def _find_repository_path(self) -> Optional[str]:
        """
        Auto-detect repository path
        
        Returns:
            Path to repository or None
        """
        from pathlib import Path
        
        possible_paths = [
            Path("workspace/repos"),
            Path("repos"),
            Path("."),
        ]
        
        for base_path in possible_paths:
            if base_path.exists() and base_path.is_dir():
                # Find first subdirectory that looks like a repo
                for item in base_path.iterdir():
                    if item.is_dir() and not item.name.startswith('.'):
                        logger.debug(f"Found potential repository at: {item}")
                        return str(item)
        
        return None
    
    def _extract_code_snippet(self, file_path: str, line_start: int, line_end: int, repo_path: Optional[str], max_lines: int = 20) -> str:
        """
        Extract code snippet from file in the repository
        
        Args:
            file_path: Relative file path from entity metadata
            line_start: Starting line number (1-indexed)
            line_end: Ending line number (1-indexed)
            repo_path: Path to repository
            max_lines: Maximum lines to extract
        
        Returns:
            Extracted code snippet or empty string
        """
        if not file_path or not repo_path:
            return ''
        
        try:
            from pathlib import Path
            repo = Path(repo_path)
            
            # Try multiple path resolution strategies
            full_path = None
            
            # Strategy 1: Direct path relative to repo
            candidate = repo / file_path
            if candidate.exists():
                full_path = candidate
            
            # Strategy 2: Remove leading path components
            if not full_path:
                parts = Path(file_path).parts
                for i in range(len(parts)):
                    candidate = repo / Path(*parts[i:])
                    if candidate.exists():
                        full_path = candidate
                        break
            
            # Strategy 3: Search for filename in repo
            if not full_path:
                filename = Path(file_path).name
                for found_file in repo.rglob(filename):
                    if found_file.is_file():
                        full_path = found_file
                        break
            
            if not full_path or not full_path.exists():
                return ''
            
            # Read file and extract lines
            lines = full_path.read_text(encoding='utf-8', errors='ignore').splitlines()
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
            logger.debug(f"Failed to extract snippet from {file_path}: {e}")
            return ''
