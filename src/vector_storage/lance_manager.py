"""
LanceManager - Low-level LanceDB operations wrapper
Handles database connection, table management, and CRUD operations
"""

import os
import logging
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

logger = logging.getLogger(__name__)

try:
    import lancedb
    import pyarrow as pa
    LANCEDB_AVAILABLE = True
except ImportError:
    logger.warning("LanceDB not available. Install with: pip install lancedb pyarrow")
    LANCEDB_AVAILABLE = False


class LanceManager:
    """
    Low-level LanceDB operations manager
    Provides database connection and table management
    """
    
    def __init__(self, db_path: str = "workspace/lancedb"):
        """
        Initialize LanceDB connection
        
        Args:
            db_path: Path to LanceDB database directory
        """
        self.db_path = db_path
        self.db = None
        self.tables = {}
        
        if not LANCEDB_AVAILABLE:
            logger.error("LanceDB is not available. Vector storage will not work.")
            return
        
        try:
            # Create directory if needed
            os.makedirs(db_path, exist_ok=True)
            
            # Connect to LanceDB
            self.db = lancedb.connect(db_path)
            logger.info(f"Connected to LanceDB at {db_path}")
            
        except Exception as e:
            logger.error(f"Failed to initialize LanceDB: {e}")
            self.db = None
    
    def is_available(self) -> bool:
        """Check if LanceDB is available and connected"""
        return LANCEDB_AVAILABLE and self.db is not None
    
    def create_table(self, table_name: str = "code_entity_embeddings") -> Dict[str, Any]:
        """
        Create table with proper schema (alias for create_code_entity_table)
        
        Args:
            table_name: Name of the table to create
            
        Returns:
            Dict with success status and details
        """
        success = self.create_code_entity_table(table_name)
        return {
            'success': success,
            'table_name': table_name,
            'message': f"Table {table_name} {'created' if success else 'failed'}"
        }
    
    def create_code_entity_table(self, table_name: str = "code_entity_embeddings") -> bool:
        """
        Create table for code entity embeddings with schema
        
        Args:
            table_name: Name of the table to create
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available():
            logger.error("LanceDB not available")
            return False
        
        try:
            # Check if table already exists
            if table_name in self.db.table_names():
                logger.info(f"Table '{table_name}' already exists")
                self.tables[table_name] = self.db.open_table(table_name)
                return True
            
            # Create empty table with schema
            # We'll add data later
            logger.info(f"Table '{table_name}' will be created on first insert")
            return True
            
        except Exception as e:
            logger.error(f"Error creating table: {e}")
            return False
    
    def add_vectors(self, table_name: str, vectors: List[Dict]) -> Dict[str, Any]:
        """
        Add vectors to LanceDB table
        
        Args:
            table_name: Name of the table
            vectors: List of vector dictionaries with embeddings and metadata
            
        Returns:
            Dictionary with operation results
        """
        if not self.is_available():
            return {'success': False, 'error': 'LanceDB not available'}
        
        if not vectors:
            return {'success': True, 'inserted': 0}
        
        try:
            # Prepare data for insertion
            data = []
            for v in vectors:
                # Convert numpy array to list if needed
                embedding = v.get('embedding', [])
                if isinstance(embedding, np.ndarray):
                    embedding = embedding.tolist()
                
                record = {
                    'entity_id': v.get('entity_id', ''),
                    'entity_name': v.get('entity_name', ''),
                    'entity_type': v.get('entity_type', ''),
                    'file_path': v.get('file_path', ''),
                    'embedding': embedding,
                    'relevance_score': float(v.get('relevance_score', 0.0)),
                    'semantic_similarity': float(v.get('semantic_similarity', 0.0)),
                    'textual_similarity': float(v.get('textual_similarity', 0.0)),
                    'code_snippet': v.get('code_snippet', '')[:1000],  # Limit length
                    'line_start': int(v.get('line_start', 0)),
                    'line_end': int(v.get('line_end', 0)),
                    'created_at': datetime.now().isoformat(),
                }
                data.append(record)
            
            # Create or open table
            if table_name in self.db.table_names():
                table = self.db.open_table(table_name)
                table.add(data)
                logger.info(f"Added {len(data)} vectors to existing table '{table_name}'")
            else:
                table = self.db.create_table(table_name, data)
                logger.info(f"Created table '{table_name}' and added {len(data)} vectors")
            
            self.tables[table_name] = table
            
            return {
                'success': True,
                'inserted': len(data),
                'table': table_name
            }
            
        except Exception as e:
            logger.error(f"Error adding vectors: {e}")
            return {'success': False, 'error': str(e)}
    
    def search_vectors(self, table_name: str, query_vector: np.ndarray, 
                      top_k: int = 20, filters: Optional[str] = None) -> Dict[str, Any]:
        """
        Search for similar vectors using ANN
        
        Args:
            table_name: Name of the table to search
            query_vector: Query embedding vector
            top_k: Number of results to return
            filters: Optional SQL-like filter expression
            
        Returns:
            Dict with success status and results list
        """
        if not self.is_available():
            logger.error("LanceDB not available")
            return {'success': False, 'error': 'LanceDB not available', 'results': []}
        
        try:
            # Open table
            if table_name not in self.tables:
                if table_name not in self.db.table_names():
                    logger.warning(f"Table '{table_name}' does not exist")
                    return {'success': True, 'results': [], 'message': f"Table '{table_name}' does not exist"}
                self.tables[table_name] = self.db.open_table(table_name)
            
            table = self.tables[table_name]
            
            # Convert query vector to list if needed
            if isinstance(query_vector, np.ndarray):
                query_vector = query_vector.tolist()
            
            # Perform search
            query = table.search(query_vector).limit(top_k)
            
            if filters:
                query = query.where(filters)
            
            results = query.to_list()
            
            # Format results
            formatted_results = []
            for result in results:
                formatted_results.append({
                    'entity_id': result.get('entity_id', ''),
                    'entity_name': result.get('entity_name', ''),
                    'entity_type': result.get('entity_type', ''),
                    'file_path': result.get('file_path', ''),
                    '_distance': float(result.get('_distance', 0.0)),
                    'relevance_score': float(result.get('relevance_score', 0.0)),
                    'semantic_similarity': float(result.get('semantic_similarity', 0.0)),
                    'textual_similarity': float(result.get('textual_similarity', 0.0)),
                    'code_snippet': result.get('code_snippet', ''),
                    'line_start': result.get('line_start', 0),
                    'line_end': result.get('line_end', 0),
                })
            
            logger.info(f"Found {len(formatted_results)} similar entities")
            return {
                'success': True,
                'results': formatted_results,
                'count': len(formatted_results)
            }
            
        except Exception as e:
            logger.error(f"Error searching vectors: {e}")
            return {'success': False, 'error': str(e), 'results': []}
    
    def get_table_stats(self, table_name: str) -> Dict[str, Any]:
        """
        Get statistics about a table
        
        Args:
            table_name: Name of the table
            
        Returns:
            Dictionary with table statistics
        """
        if not self.is_available():
            return {'error': 'LanceDB not available'}
        
        try:
            if table_name not in self.db.table_names():
                return {'error': f"Table '{table_name}' does not exist"}
            
            table = self.db.open_table(table_name)
            
            # Get basic stats
            count = table.count_rows()
            
            return {
                'table_name': table_name,
                'total_vectors': count,
                'schema': str(table.schema),
            }
            
        except Exception as e:
            logger.error(f"Error getting table stats: {e}")
            return {'error': str(e)}
    
    def delete_table(self, table_name: str) -> bool:
        """
        Delete a table
        
        Args:
            table_name: Name of the table to delete
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available():
            return False
        
        try:
            if table_name in self.db.table_names():
                self.db.drop_table(table_name)
                if table_name in self.tables:
                    del self.tables[table_name]
                logger.info(f"Deleted table '{table_name}'")
                return True
            else:
                logger.warning(f"Table '{table_name}' does not exist")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting table: {e}")
            return False
    
    def get_table(self, table_name: str):
        """
        Get table handle for operations
        
        Args:
            table_name: Name of the table
            
        Returns:
            LanceDB table handle or None
        """
        if not self.is_available():
            return None
        
        try:
            if table_name in self.db.table_names():
                return self.db.open_table(table_name)
            return None
        except Exception as e:
            logger.error(f"Error getting table {table_name}: {e}")
            return None
    
    def list_tables(self) -> List[str]:
        """Get list of all tables in the database"""
        if not self.is_available():
            return []
        
        try:
            return self.db.table_names()
        except Exception as e:
            logger.error(f"Error listing tables: {e}")
            return []
    
    def update_vectors(self, table_name: str, entity_ids: List[str], 
                      vectors: List[Dict]) -> Dict[str, Any]:
        """
        Update existing vectors (delete old, insert new)
        
        Args:
            table_name: Name of the table
            entity_ids: List of entity IDs to update
            vectors: New vector data
            
        Returns:
            Dictionary with operation results
        """
        if not self.is_available():
            return {'success': False, 'error': 'LanceDB not available'}
        
        try:
            if table_name not in self.db.table_names():
                return {'success': False, 'error': f"Table '{table_name}' does not exist"}
            
            table = self.db.open_table(table_name)
            
            # Delete old vectors
            for entity_id in entity_ids:
                table.delete(f"entity_id = '{entity_id}'")
            
            # Add new vectors
            result = self.add_vectors(table_name, vectors)
            
            logger.info(f"Updated {len(entity_ids)} vectors in '{table_name}'")
            return result
            
        except Exception as e:
            logger.error(f"Error updating vectors: {e}")
            return {'success': False, 'error': str(e)}
    
    def close(self):
        """Close database connection"""
        if self.db:
            self.tables.clear()
            self.db = None
            logger.info("Closed LanceDB connection")
