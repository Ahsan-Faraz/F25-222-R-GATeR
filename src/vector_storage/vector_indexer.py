"""
VectorIndexer - Advanced indexing and search optimization
Handles index creation, optimization, and hybrid search
"""

import logging
import numpy as np
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class VectorIndexer:
    """
    Advanced indexing and search optimization for LanceDB
    """
    
    def __init__(self, lance_manager):
        """
        Initialize VectorIndexer
        
        Args:
            lance_manager: LanceManager instance
        """
        self.lance_manager = lance_manager
        logger.info("Initialized VectorIndexer")
    
    def create_index(self, table_name: str, metric: str = "cosine") -> bool:
        """
        Create ANN index on table for faster search
        
        Args:
            table_name: Name of the table
            metric: Distance metric (cosine, l2, ip)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.lance_manager.is_available():
            logger.warning("LanceDB not available, skipping index creation")
            return False
        
        try:
            if table_name not in self.lance_manager.tables:
                if table_name not in self.lance_manager.db.table_names():
                    logger.warning(f"Table '{table_name}' does not exist")
                    return False
                self.lance_manager.tables[table_name] = self.lance_manager.db.open_table(table_name)
            
            table = self.lance_manager.tables[table_name]
            
            # Get table size to determine index type
            count = table.count_rows()
            
            if count < 10000:
                logger.info(f"Table has {count} rows, no index needed (using flat search)")
                return True
            
            # Create IVF index for tables with 10K+ vectors
            logger.info(f"Creating IVF index on table '{table_name}' with {count} vectors")
            table.create_index(metric=metric)
            
            logger.info(f"Successfully created index on '{table_name}'")
            return True
            
        except Exception as e:
            logger.error(f"Error creating index: {e}")
            return False
    
    def search_with_filters(self, table_name: str, query_vector: np.ndarray,
                          filters: Dict[str, Any], top_k: int = 20) -> Dict[str, Any]:
        """
        Search with metadata filters
        
        Args:
            table_name: Name of the table
            query_vector: Query embedding
            filters: Dictionary of filters (entity_type, file_path, min_relevance)
            top_k: Number of results
            
        Returns:
            Dict with success status and results list
        """
        # Build filter expression
        filter_expressions = []
        
        if 'entity_type' in filters:
            entity_type = filters['entity_type']
            if isinstance(entity_type, list):
                types_str = "', '".join(entity_type)
                filter_expressions.append(f"entity_type IN ('{types_str}')")
            else:
                filter_expressions.append(f"entity_type = '{entity_type}'")
        
        if 'file_path_pattern' in filters:
            pattern = filters['file_path_pattern']
            filter_expressions.append(f"file_path LIKE '%{pattern}%'")
        
        if 'min_relevance' in filters:
            min_rel = filters['min_relevance']
            filter_expressions.append(f"relevance_score >= {min_rel}")
        
        # Combine filters
        filter_expr = " AND ".join(filter_expressions) if filter_expressions else None
        
        # Search with filters
        return self.lance_manager.search_vectors(
            table_name=table_name,
            query_vector=query_vector,
            top_k=top_k,
            filters=filter_expr
        )
    
    def hybrid_search(self, table_name: str, query_vector: np.ndarray,
                     top_k: int = 20, boost_relevance: float = 0.3) -> List[Dict]:
        """
        Hybrid search combining vector similarity with relevance scores
        
        Args:
            table_name: Name of the table
            query_vector: Query embedding
            top_k: Number of results
            boost_relevance: Weight for relevance score (0-1)
            
        Returns:
            List of re-ranked results
        """
        # Get more results than needed for reranking
        response = self.lance_manager.search_vectors(
            table_name=table_name,
            query_vector=query_vector,
            top_k=top_k * 2
        )
        
        # Extract results list from response dict
        if isinstance(response, dict):
            results = response.get('results', [])
        else:
            results = response if isinstance(response, list) else []
        
        # Re-rank using hybrid score
        for result in results:
            # Use _distance from LanceDB (lower is better)
            distance = result.get('_distance', 0.0)
            vector_sim = 1.0 - min(distance, 1.0)  # Convert distance to similarity (capped at 1.0)
            relevance = result.get('relevance_score', 0.0)
            
            # Hybrid score: weighted combination
            hybrid_score = (1 - boost_relevance) * vector_sim + boost_relevance * relevance
            result['hybrid_score'] = hybrid_score
        
        # Sort by hybrid score
        results.sort(key=lambda x: x.get('hybrid_score', 0.0), reverse=True)
        
        return results[:top_k]
    
    def multi_modal_search(self, table_name: str, 
                          query_vectors: List[np.ndarray],
                          weights: List[float],
                          top_k: int = 20) -> List[Dict]:
        """
        Search using multiple query vectors with weighted aggregation
        
        Args:
            table_name: Name of the table
            query_vectors: List of query embeddings
            weights: Weight for each query vector
            top_k: Number of results
            
        Returns:
            List of aggregated results
        """
        if len(query_vectors) != len(weights):
            logger.error("Number of vectors and weights must match")
            return []
        
        # Normalize weights
        total_weight = sum(weights)
        weights = [w / total_weight for w in weights]
        
        # Collect results from each query
        all_results = {}
        
        for query_vec, weight in zip(query_vectors, weights):
            response = self.lance_manager.search_vectors(
                table_name=table_name,
                query_vector=query_vec,
                top_k=top_k * 2
            )
            
            # Extract results list from response dict
            if isinstance(response, dict):
                results = response.get('results', [])
            else:
                results = response if isinstance(response, list) else []
            
            for result in results:
                entity_id = result.get('entity_id', '')
                # Use _distance from LanceDB
                distance = result.get('_distance', 0.0)
                score = (1.0 - min(distance, 1.0)) * weight
                
                if entity_id in all_results:
                    all_results[entity_id]['aggregated_score'] += score
                else:
                    result['aggregated_score'] = score
                    all_results[entity_id] = result
        
        # Sort by aggregated score
        final_results = list(all_results.values())
        final_results.sort(key=lambda x: x.get('aggregated_score', 0.0), reverse=True)
        
        return final_results[:top_k]
    
    def optimize_table(self, table_name: str) -> bool:
        """
        Optimize table for better performance
        
        Args:
            table_name: Name of the table
            
        Returns:
            True if successful
        """
        if not self.lance_manager.is_available():
            return False
        
        try:
            if table_name not in self.lance_manager.tables:
                if table_name not in self.lance_manager.db.table_names():
                    logger.warning(f"Table '{table_name}' does not exist")
                    return False
                self.lance_manager.tables[table_name] = self.lance_manager.db.open_table(table_name)
            
            table = self.lance_manager.tables[table_name]
            
            # Compact/optimize table
            logger.info(f"Optimizing table '{table_name}'")
            table.optimize()
            
            logger.info(f"Successfully optimized '{table_name}'")
            return True
            
        except Exception as e:
            logger.error(f"Error optimizing table: {e}")
            return False
