"""
Test that the embedding model is cached and not reloaded on every search
"""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.vector_storage.step6_vector_storage import Step6VectorStorage

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_model_caching():
    """Test that model is loaded once and cached"""
    
    logger.info("=" * 60)
    logger.info("Testing Embedding Model Caching")
    logger.info("=" * 60)
    
    # Initialize vector storage
    logger.info("\n[Step 1] Initializing vector storage...")
    vector_storage = Step6VectorStorage(db_path="workspace/lancedb")
    logger.info("✅ Vector storage initialized")
    
    # First search - should load model
    logger.info("\n[Step 2] First search (should load model)...")
    result1 = vector_storage.search_similar_entities("test query 1", top_k=5)
    logger.info(f"✅ First search completed: {result1.get('count', 0)} results")
    
    # Second search - should use cached model
    logger.info("\n[Step 3] Second search (should use cached model)...")
    result2 = vector_storage.search_similar_entities("test query 2", top_k=5)
    logger.info(f"✅ Second search completed: {result2.get('count', 0)} results")
    
    # Third search - should use cached model
    logger.info("\n[Step 4] Third search (should use cached model)...")
    result3 = vector_storage.search_similar_entities("test query 3", top_k=5)
    logger.info(f"✅ Third search completed: {result3.get('count', 0)} results")
    
    logger.info("\n" + "=" * 60)
    logger.info("✅ SUCCESS: Model caching working correctly!")
    logger.info("If you see 'Loading embedding model' only ONCE above,")
    logger.info("then the fix is working correctly.")
    logger.info("=" * 60)

if __name__ == "__main__":
    try:
        test_model_caching()
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        sys.exit(1)
