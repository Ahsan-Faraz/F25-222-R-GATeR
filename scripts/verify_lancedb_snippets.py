"""
Verify LanceDB has code snippets after running the pipeline

This script checks if LanceDB entities have populated code_snippet fields.
Run this AFTER running the jsoup pipeline.
"""

import sys
import logging
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.vector_storage.step6_vector_storage import Step6VectorStorage

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def verify_lancedb_snippets():
    """Verify LanceDB has code snippets"""
    
    logger.info("=" * 60)
    logger.info("Verifying LanceDB Code Snippet Storage")
    logger.info("=" * 60)
    
    # Check if LanceDB exists
    lancedb_path = Path("workspace/lancedb")
    if not lancedb_path.exists():
        logger.error("❌ LanceDB not found at workspace/lancedb")
        logger.error("   Run the pipeline first: python scripts/run_jsoup_pipeline.py")
        return False
    
    # Connect to LanceDB
    logger.info("\n[Step 1] Connecting to LanceDB...")
    vector_storage = Step6VectorStorage(db_path="workspace/lancedb")
    
    if not vector_storage.is_available():
        logger.error("❌ LanceDB not available")
        return False
    
    logger.info("✅ Connected to LanceDB")
    
    # Get database stats
    logger.info("\n[Step 2] Getting database stats...")
    stats = vector_storage.get_database_stats()
    
    total_vectors = stats.get('total_vectors', 0)
    logger.info(f"Total vectors in LanceDB: {total_vectors}")
    
    if total_vectors == 0:
        logger.warning("⚠️  No vectors found in LanceDB")
        logger.warning("   Run the pipeline first: python scripts/run_jsoup_pipeline.py")
        return False
    
    # Search for entities
    logger.info("\n[Step 3] Searching for entities...")
    search_result = vector_storage.search_similar_entities(
        query="parse HTML document",
        top_k=20
    )
    
    if not search_result.get('success'):
        logger.error(f"❌ Search failed: {search_result.get('error')}")
        return False
    
    results = search_result.get('results', [])
    logger.info(f"Found {len(results)} results")
    
    # Check snippet coverage
    logger.info("\n[Step 4] Checking code snippet coverage...")
    
    with_snippets = 0
    without_snippets = 0
    snippet_lengths = []
    
    for i, hit in enumerate(results, 1):
        entity_name = hit.get('entity_name', 'unknown')
        entity_type = hit.get('entity_type', 'unknown')
        code_snippet = hit.get('code_snippet', '')
        
        if code_snippet and len(code_snippet) > 20:
            with_snippets += 1
            snippet_lengths.append(len(code_snippet))
            logger.info(f"✅ [{i}] {entity_name} ({entity_type}): {len(code_snippet)} chars")
            # Show first 80 chars
            preview = code_snippet[:80].replace('\n', ' ')
            logger.info(f"      {preview}...")
        else:
            without_snippets += 1
            logger.warning(f"❌ [{i}] {entity_name} ({entity_type}): NO snippet")
    
    # Calculate statistics
    total = with_snippets + without_snippets
    coverage = (with_snippets / total * 100) if total > 0 else 0
    avg_length = sum(snippet_lengths) / len(snippet_lengths) if snippet_lengths else 0
    
    logger.info("\n" + "=" * 60)
    logger.info("RESULTS:")
    logger.info(f"  Total entities: {total}")
    logger.info(f"  With snippets: {with_snippets}")
    logger.info(f"  Without snippets: {without_snippets}")
    logger.info(f"  Coverage: {coverage:.1f}%")
    if snippet_lengths:
        logger.info(f"  Avg snippet length: {avg_length:.0f} chars")
        logger.info(f"  Min snippet length: {min(snippet_lengths)} chars")
        logger.info(f"  Max snippet length: {max(snippet_lengths)} chars")
    logger.info("=" * 60)
    
    if coverage >= 80:
        logger.info("✅ SUCCESS: Bug 0 is FIXED - LanceDB has code snippets!")
        return True
    elif coverage >= 50:
        logger.warning(f"⚠️  PARTIAL: {coverage:.1f}% coverage (expected ≥80%)")
        logger.warning("   Some entities have snippets, but coverage is low")
        return False
    else:
        logger.error(f"❌ FAILURE: Only {coverage:.1f}% coverage (expected ≥80%)")
        logger.error("   Bug 0 fix may not be working correctly")
        return False

if __name__ == "__main__":
    try:
        success = verify_lancedb_snippets()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Verification failed with exception: {e}", exc_info=True)
        sys.exit(1)
