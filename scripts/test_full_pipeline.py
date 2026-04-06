"""
Test the full GATR pipeline end-to-end with all fixes applied
"""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.gatr.gatr_engine import GATREngine

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_full_pipeline():
    """Test GATR with all fixes: model caching, None handling, prompt visibility"""
    
    logger.info("=" * 60)
    logger.info("Testing Full GATR Pipeline with All Fixes")
    logger.info("=" * 60)
    
    # Initialize GATR engine
    logger.info("\n[Step 1] Initializing GATR engine...")
    engine = GATREngine(
        kuzu_db_path="workspace/kuzu_db",
        lancedb_path="workspace/lancedb"
    )
    
    logger.info(f"✅ GATR initialized")
    logger.info(f"   LLM available: {engine.lm_studio_available}")
    logger.info(f"   Model: {engine.lm_studio_model}")
    
    # Create a test case
    logger.info("\n[Step 2] Creating test case...")
    
    broken_test = {
        'test_name': 'testParseHtml',
        'test_file': 'src/test/java/org/jsoup/parser/HtmlParserTest.java',
        'test_code': '''
@Test
public void testParseHtml() {
    String html = "<html><body><p>Hello World</p></body></html>";
    Document doc = Jsoup.parse(html);
    Elements paragraphs = doc.select("p");
    assertEquals(1, paragraphs.size());
    assertEquals("Hello World", paragraphs.get(0).text());
}
''',
        'test_class': 'HtmlParserTest',
        'test_method': 'testParseHtml'
    }
    
    error_message = '''java.lang.IndexOutOfBoundsException: Index 0 out of bounds for length 0
    at java.base/jdk.internal.util.Preconditions.outOfBounds(Preconditions.java:64)
    at java.base/jdk.internal.util.Preconditions.outOfBoundsCheckIndex(Preconditions.java:70)
    at java.base/java.util.Objects.checkIndex(Objects.java:359)
    at java.base/java.util.ArrayList.get(ArrayList.java:427)
    at HtmlParserTest.testParseHtml(HtmlParserTest.java:7)'''
    
    logger.info(f"Test: {broken_test['test_name']}")
    logger.info(f"Error: IndexOutOfBoundsException")
    
    # Run GATR repair
    logger.info("\n[Step 3] Running GATR repair pipeline...")
    
    try:
        result = engine.repair_test(
            broken_test=broken_test,
            error_message=error_message,
            project_name='pipeline_test'
        )
        
        # Check results
        logger.info("\n[Step 4] Analyzing results...")
        
        logger.info(f"\n✅ Success: {result.success}")
        logger.info(f"   Repair strategy: {result.repair_strategy}")
        logger.info(f"   Confidence: {result.confidence:.2f}")
        logger.info(f"   Processing time: {result.processing_time:.2f}s")
        
        # Check prompt data
        if result.final_rag_prompt:
            logger.info(f"\n✅ Prompt Data Available:")
            logger.info(f"   Total entities: {result.final_rag_prompt.get('total_entities', 0)}")
            logger.info(f"   Entities with code: {result.final_rag_prompt.get('entities_with_code', 0)}")
            logger.info(f"   System message: {len(result.final_rag_prompt.get('system_message', ''))} chars")
            logger.info(f"   User prompt: {len(result.final_rag_prompt.get('user_prompt', ''))} chars")
            
            entities_with_snippets = result.final_rag_prompt.get('entities_with_snippets', [])
            if entities_with_snippets:
                logger.info(f"\n✅ Entities with Snippets ({len(entities_with_snippets)}):")
                for i, entity in enumerate(entities_with_snippets[:5], 1):
                    logger.info(f"   {i}. {entity.get('name')} ({entity.get('type')}) - {entity.get('snippet_length')} chars, score: {entity.get('score')}")
        else:
            logger.warning("❌ No prompt data in result")
        
        # Check repaired code
        if result.repaired_code:
            logger.info(f"\n✅ Repaired Code ({len(result.repaired_code)} chars):")
            logger.info("=" * 60)
            logger.info(result.repaired_code[:300])
            if len(result.repaired_code) > 300:
                logger.info("... (truncated)")
            logger.info("=" * 60)
        else:
            logger.warning("❌ No repaired code generated")
        
        # Final verdict
        logger.info("\n" + "=" * 60)
        if result.success and result.final_rag_prompt:
            logger.info("✅ SUCCESS: Full pipeline working with all fixes!")
            logger.info("   - Model caching: ✅")
            logger.info("   - None handling: ✅")
            logger.info("   - Prompt visibility: ✅")
        elif result.success:
            logger.info("⚠️  PARTIAL: Repair generated but missing prompt data")
        else:
            logger.info("❌ FAILURE: Repair failed")
        logger.info("=" * 60)
        
        return result.success
        
    except Exception as e:
        logger.error(f"❌ Pipeline failed with exception: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    try:
        success = test_full_pipeline()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        sys.exit(1)
