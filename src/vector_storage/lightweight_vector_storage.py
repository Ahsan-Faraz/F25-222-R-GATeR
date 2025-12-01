"""
Lightweight Vector Storage - Loads embedding model on-demand with timeout
Alternative to Step6VectorStorage for faster startup
"""

import os
import logging
import time
import signal
from typing import Dict, List, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class TimeoutError(Exception):
    """Custom timeout error"""
    pass


def timeout_handler(signum, frame):
    raise TimeoutError("Model loading timed out")


class LightweightVectorStorage:
    """
    Lightweight vector storage with on-demand model loading
    """
    
    def __init__(self, workspace_dir: str = "workspace", db_path: Optional[str] = None, timeout: int = 30):
        """
        Initialize lightweight vector storage
        
        Args:
            workspace_dir: Workspace directory for caching and data
            db_path: Path to LanceDB database (optional)
            timeout: Timeout in seconds for model loading
        """
        self.workspace_dir = Path(workspace_dir)
        self.db_path = db_path or str(self.workspace_dir / "lancedb")
        self.timeout = timeout
        
        # Lazy loading
        self._model = None
        self._lance_manager = None
        self._vector_indexer = None
        self._embedding_sync = None
        
        # Create workspace directory
        self.workspace_dir.mkdir(exist_ok=True)
        
        logger.info(f"Initialized LightweightVectorStorage with workspace: {workspace_dir}")

    def _load_model_with_timeout(self):
        """Load sentence transformer model with timeout"""
        if self._model is not None:
            return self._model
            
        try:
            # Set up timeout signal (Unix/Linux only)
            if hasattr(signal, 'SIGALRM'):
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(self.timeout)
            
            logger.info(f"Loading sentence transformer model (timeout: {self.timeout}s)...")
            
            from sentence_transformers import SentenceTransformer
            
            # Try to load a lightweight model first
            model_name = "all-MiniLM-L6-v2"
            self._model = SentenceTransformer(model_name)
            
            if hasattr(signal, 'SIGALRM'):
                signal.alarm(0)  # Cancel timeout
                
            logger.info("✅ Successfully loaded sentence transformer model")
            return self._model
            
        except TimeoutError:
            logger.error(f"❌ Model loading timed out after {self.timeout} seconds")
            raise Exception(f"Model loading timed out after {self.timeout} seconds")
        except Exception as e:
            if hasattr(signal, 'SIGALRM'):
                signal.alarm(0)  # Cancel timeout
            logger.error(f"❌ Failed to load model: {e}")
            raise Exception(f"Failed to load model: {e}")

    def _init_lance_manager(self):
        """Initialize LanceDB manager on-demand"""
        if self._lance_manager is None:
            from .lance_manager import LanceManager
            self._lance_manager = LanceManager(
                db_path=self.db_path,
                workspace_dir=str(self.workspace_dir)
            )
        return self._lance_manager

    def _init_vector_indexer(self):
        """Initialize vector indexer on-demand"""
        if self._vector_indexer is None:
            self._load_model_with_timeout()  # Ensure model is loaded
            from .vector_indexer import VectorIndexer
            self._vector_indexer = VectorIndexer(
                model=self._model,
                workspace_dir=str(self.workspace_dir)
            )
        return self._vector_indexer

    def _init_embedding_sync(self):
        """Initialize embedding sync on-demand"""
        if self._embedding_sync is None:
            lance_manager = self._init_lance_manager()
            vector_indexer = self._init_vector_indexer()
            from .embedding_sync import EmbeddingSync
            self._embedding_sync = EmbeddingSync(
                lance_manager=lance_manager,
                vector_indexer=vector_indexer,
                workspace_dir=str(self.workspace_dir)
            )
        return self._embedding_sync

    def store_kg_entities(self, kg_results: Dict) -> int:
        """
        Store knowledge graph entities in vector database
        
        Args:
            kg_results: Results from KGCompass scoring with entities
            
        Returns:
            Number of entities stored
        """
        try:
            logger.info("🔄 Storing KG entities in vector database...")
            
            # Initialize components on-demand
            embedding_sync = self._init_embedding_sync()
            
            # Extract entities from KG results
            entities = kg_results.get('scored_entities', [])
            
            if not entities:
                logger.warning("No entities found in KG results")
                return 0
            
            # Store entities with embeddings
            stored_count = 0
            for entity in entities:
                try:
                    # Convert entity to vector format
                    entity_text = f"{entity.get('name', '')} {entity.get('content', '')} {entity.get('file_path', '')}"
                    
                    # Store in vector database
                    entity_data = {
                        'id': entity.get('id', f"entity_{stored_count}"),
                        'name': entity.get('name', ''),
                        'type': entity.get('type', 'unknown'),
                        'content': entity.get('content', ''),
                        'file_path': entity.get('file_path', ''),
                        'relevance_score': entity.get('relevance_score', 0.0),
                        'text': entity_text
                    }
                    
                    embedding_sync.add_entity_embedding(entity_data)
                    stored_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to store entity {entity.get('name', 'unknown')}: {e}")
                    continue
            
            logger.info(f"✅ Successfully stored {stored_count} entities in vector database")
            return stored_count
            
        except Exception as e:
            logger.error(f"❌ Failed to store KG entities: {e}")
            raise e

    def search_similar_entities(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Search for similar entities using semantic similarity
        
        Args:
            query: Search query text
            top_k: Number of top results to return
            
        Returns:
            List of similar entities with similarity scores
        """
        try:
            logger.info(f"🔍 Searching for entities similar to: '{query}'")
            
            # Initialize components on-demand
            lance_manager = self._init_lance_manager()
            
            # Generate query embedding
            model = self._load_model_with_timeout()
            query_embedding = model.encode([query])
            
            # Search in vector database
            results = lance_manager.search_similar_vectors(
                query_vector=query_embedding[0],
                top_k=top_k
            )
            
            # Format results
            formatted_results = []
            for result in results:
                similarity = float(result.get('similarity', 0.0))
                
                formatted_result = {
                    'id': result.get('id', ''),
                    'name': result.get('name', ''),
                    'type': result.get('type', 'unknown'),
                    'content': result.get('content', ''),
                    'file_path': result.get('file_path', ''),
                    'relevance_score': result.get('relevance_score', 0.0),
                    'similarity_score': similarity,
                    'similarity_percentage': round(similarity * 100, 1)
                }
                formatted_results.append(formatted_result)
            
            logger.info(f"✅ Found {len(formatted_results)} similar entities")
            return formatted_results
            
        except Exception as e:
            logger.error(f"❌ Failed to search for similar entities: {e}")
            raise e

    def get_stats(self) -> Dict:
        """Get vector database statistics"""
        try:
            lance_manager = self._init_lance_manager()
            stats = lance_manager.get_database_stats()
            
            return {
                'total_vectors': stats.get('total_vectors', 0),
                'database_size': stats.get('database_size', '0 MB'),
                'last_updated': stats.get('last_updated', 'Never'),
                'model_loaded': self._model is not None
            }
            
        except Exception as e:
            logger.error(f"Failed to get vector database stats: {e}")
            return {
                'total_vectors': 0,
                'database_size': '0 MB',
                'last_updated': 'Error',
                'model_loaded': False
            }

    def health_check(self) -> Dict:
        """Check health of vector storage components"""
        health = {
            'status': 'healthy',
            'components': {
                'model': 'not_loaded',
                'lance_manager': 'not_initialized',
                'vector_indexer': 'not_initialized',
                'embedding_sync': 'not_initialized'
            }
        }
        
        try:
            # Check model
            if self._model is not None:
                health['components']['model'] = 'loaded'
            
            # Check LanceManager
            if self._lance_manager is not None:
                health['components']['lance_manager'] = 'initialized'
            
            # Check VectorIndexer
            if self._vector_indexer is not None:
                health['components']['vector_indexer'] = 'initialized'
                
            # Check EmbeddingSync
            if self._embedding_sync is not None:
                health['components']['embedding_sync'] = 'initialized'
                
        except Exception as e:
            health['status'] = 'unhealthy'
            health['error'] = str(e)
            
        return health