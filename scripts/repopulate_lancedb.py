"""
Re-populate LanceDB with code snippets from existing Kuzu database

This script:
1. Reads entities from Kuzu
2. Runs relevance scoring (which now has Bug 0 fix)
3. Stores in LanceDB with actual code snippets
"""

import sys
import logging
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.knowledge_graph.kg_manager import KnowledgeGraphManager
from src.relevance.step5_relevance_scoring import Step5RelevanceScoring
from src.vector_storage.step6_vector_storage import Step6VectorStorage

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def repopulate_lancedb():
    """Re-populate LanceDB with code snippets"""
    
    logger.info("=" * 60)
    logger.info("Re-populating LanceDB with Code Snippets")
    logger.info("=" * 60)
    
    # Check if Kuzu exists
    kuzu_path = Path("workspace/kuzu_db")
    if not kuzu_path.exists():
        logger.error("❌ Kuzu database not found at workspace/kuzu_db")
        return False
    
    # Connect to Kuzu
    logger.info("\n[Step 1] Connecting to Kuzu...")
    kg_manager = KnowledgeGraphManager(kuzu_db_path="workspace/kuzu_db")
    
    graph = getattr(kg_manager, 'graph', None)
    if not graph:
        logger.error("❌ Could not access Kuzu graph")
        return False
    
    logger.info(f"✅ Connected to Kuzu: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
    
    # Clear existing LanceDB
    logger.info("\n[Step 2] Clearing existing LanceDB...")
    vector_storage = Step6VectorStorage(db_path="workspace/lancedb")
    
    clear_result = vector_storage.clear_database()
    if clear_result.get('success'):
        logger.info("✅ Cleared LanceDB")
    else:
        logger.warning(f"⚠️  Could not clear LanceDB: {clear_result.get('message')}")
    
    # Run relevance scoring with auto-store
    logger.info("\n[Step 3] Running relevance scoring with Bug 0 fix...")
    scorer = Step5RelevanceScoring(
        workspace_dir="workspace",
        auto_store_vectors=True  # Enable automatic storage with code snippets
    )
    
    # Use a generic problem description to score all entities
    problem_description = "Parse and analyze HTML documents, extract elements and text content"
    
    result = scorer.calculate_relevance_scores(
        problem_description=problem_description,
        knowledge_graph=kg_manager
    )
    
    if not result.get('success'):
        logger.error(f"❌ Relevance scoring failed: {result.get('error')}")
        return False
    
    top_candidates = result.get('top_candidates', [])
    logger.info(f"✅ Scored and stored {len(top_candidates)} entities")
    
    # Verify LanceDB has snippets
    logger.info("\n[Step 4] Verifying LanceDB code snippets...")
    
    # Re-connect to vector storage to get fresh data
    vector_storage = Step6VectorStorage(db_path="workspace/lancedb")
    
    search_result = vector_storage.search_similar_entities(
        query=problem_description,
        top_k=20
    )
    
    if not search_result.get('success'):
        logger.error("❌ LanceDB search failed")
        return False
    
    results = search_result.get('results', [])
    logger.info(f"Found {len(results)} results in LanceDB")
    
    # Check snippet coverage
    with_snippets = 0
    without_snippets = 0
    
    for hit in results:
        entity_name = hit.get('entity_name', 'unknown')
        code_snippet = hit.get('code_snippet', '')
        
        if code_snippet and len(code_snippet) > 20:
            with_snippets += 1
            logger.info(f"✅ {entity_name}: {len(code_snippet)} chars")
        else:
            without_snippets += 1
            logger.warning(f"❌ {entity_name}: NO snippet")
    
    # Calculate coverage
    total = with_snippets + without_snippets
    coverage = (with_snippets / total * 100) if total > 0 else 0
    
    logger.info("\n" + "=" * 60)
    logger.info(f"RESULTS: {with_snippets}/{total} entities have code snippets ({coverage:.1f}%)")
    logger.info("=" * 60)
    
    if coverage >= 80:
        logger.info("✅ SUCCESS: LanceDB re-populated with code snippets!")
        return True
    else:
        logger.error(f"❌ FAILURE: Only {coverage:.1f}% coverage (expected ≥80%)")
        logger.error("   Path resolution may still be failing")
        return False

if __name__ == "__main__":
    try:
        success = repopulate_lancedb()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Re-population failed with exception: {e}", exc_info=True)
        sys.exit(1)
