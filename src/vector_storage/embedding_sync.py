"""
EmbeddingSync - Synchronization between Step 5 and LanceDB
Handles syncing embeddings from relevance scoring to vector storage
"""

import logging
import os
import numpy as np
from typing import Dict, List, Optional, Any, Set
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
    
    def sync_from_knowledge_graph(self, kg_manager, relevance_scorer) -> Dict[str, Any]:
        """
        Full sync: Extract all embeddings from Step 5 and store in LanceDB
        
        Args:
            kg_manager: KnowledgeGraphManager instance
            relevance_scorer: Step5RelevanceScoring instance
            
        Returns:
            Dictionary with sync results
        """
        logger.info("Starting full sync from knowledge graph")
        
        if not self.lance_manager.is_available():
            return {
                'success': False,
                'error': 'LanceDB not available',
                'fallback': 'Using in-memory storage only'
            }
        
        try:
            # Get all candidate entities from knowledge graph
            graph = kg_manager.graph
            
            # Get function and method entities
            candidate_types = ['function', 'method', 'class', 'test', 'test_method']
            candidates = []
            
            for node_id, node_data in graph.nodes(data=True):
                entity_type = node_data.get('type', '')
                if entity_type in candidate_types:
                    candidates.append({
                        'entity_id': node_id,
                        'entity_name': node_data.get('name', node_id),
                        'entity_type': entity_type,
                        'file_path': node_data.get('file_path', ''),
                        'line_start': node_data.get('line_start', 0),
                        'line_end': node_data.get('line_end', 0),
                        'code_snippet': node_data.get('code', ''),
                    })
            
            logger.info(f"Found {len(candidates)} candidate entities for embedding")
            
            if not candidates:
                return {
                    'success': True,
                    'vectors_synced': 0,
                    'message': 'No candidates found in knowledge graph'
                }
            
            # Generate embeddings using Step 5's embedding generator
            vectors_to_store = []
            
            for candidate in candidates:
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
                    
                except Exception as e:
                    logger.warning(f"Failed to generate embedding for {candidate['entity_id']}: {e}")
                    continue
            
            logger.info(f"Generated {len(vectors_to_store)} embeddings")
            
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
            
            return {
                'success': True,
                'vectors_synced': total_inserted,
                'total_candidates': len(candidates),
                'table_name': self.table_name
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
        Incremental sync for changed entities only
        
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
            
            for entity_id in changed_entities:
                # Get entity data from graph
                if not graph.has_node(entity_id):
                    logger.warning(f"Entity {entity_id} not found in graph")
                    continue
                
                node_data = graph.nodes[entity_id]
                entity_type = node_data.get('type', '')
                
                # Only process code entities
                if entity_type not in ['function', 'method', 'class', 'test', 'test_method']:
                    continue
                
                # Prepare entity data
                candidate = {
                    'entity_id': entity_id,
                    'entity_name': node_data.get('name', entity_id),
                    'entity_type': entity_type,
                    'file_path': node_data.get('file_path', ''),
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
            # Get entity counts
            graph = kg_manager.graph
            candidate_types = ['function', 'method', 'class', 'test', 'test_method']
            
            graph_entities = set()
            for node_id, node_data in graph.nodes(data=True):
                if node_data.get('type', '') in candidate_types:
                    graph_entities.add(node_id)
            
            # Get LanceDB stats
            stats = self.lance_manager.get_table_stats(self.table_name)
            lance_count = stats.get('total_vectors', 0)
            
            # Check consistency
            graph_count = len(graph_entities)
            diff = abs(graph_count - lance_count)
            consistent = diff < 10  # Allow small discrepancy
            
            return {
                'consistent': consistent,
                'graph_entities': graph_count,
                'lance_entities': lance_count,
                'difference': diff,
                'discrepancy_threshold': 10
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
