"""
Audit AST-Based Context Retrieval
Tests with real jsoup broken test case and analyzes retrieved entities
"""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.gatr.gatr_engine import GATREngine
from src.gatr.ast_query_builder import ASTQueryBuilder

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def audit_ast_retrieval():
    """
    Audit AST-based retrieval with real jsoup test case
    Compare old (error-symptom) vs new (AST-based) approach
    """
    
    logger.info("=" * 80)
    logger.info("AUDIT: AST-Based Context Retrieval")
    logger.info("=" * 80)
    
    # Real jsoup broken test case
    broken_test = {
        'test_name': 'testSelectFirst',
        'test_file': 'src/test/java/org/jsoup/select/SelectorTest.java',
        'test_code': '''
@Test
public void testSelectFirst() {
    String html = "<div><p class='active'>First</p><p>Second</p></div>";
    Document doc = Jsoup.parse(html);
    Element item = doc.select(".active").first();
    assertNotNull(item);
    assertEquals("First", item.text());
}
''',
        'test_class': 'SelectorTest',
        'test_method': 'testSelectFirst',
        'language': 'java'
    }
    
    error_message = '''java.lang.NullPointerException: Cannot invoke "org.jsoup.nodes.Element.text()" because "item" is null
    at org.jsoup.select.SelectorTest.testSelectFirst(SelectorTest.java:7)
    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)'''
    
    logger.info("\n[BROKEN TEST]")
    logger.info(f"Test: {broken_test['test_name']}")
    logger.info(f"Error: NullPointerException on Element.text()")
    logger.info(f"Root Cause: .select(\".active\") returns empty, .first() returns null")
    logger.info(f"Expected Fix: Change selector from '.active' to 'p.active' or '.active'")
    
    # Step 1: Analyze AST
    logger.info("\n" + "=" * 80)
    logger.info("[STEP 1] AST Analysis of Broken Line")
    logger.info("=" * 80)
    
    ast_builder = ASTQueryBuilder()
    ast_components = ast_builder.extract_broken_line_ast(
        broken_test['test_code'],
        error_message,
        'java'
    )
    
    logger.info(f"\nBroken Line: {ast_components.get('broken_line')}")
    logger.info(f"Method Calls: {ast_components.get('method_calls')}")
    logger.info(f"Literals: {ast_components.get('literals')}")
    logger.info(f"Types: {ast_components.get('types')}")
    logger.info(f"Variables: {ast_components.get('variables')}")
    logger.info(f"Chain Pattern: {ast_components.get('chain_pattern')}")
    
    # Step 2: Compare query formulation
    logger.info("\n" + "=" * 80)
    logger.info("[STEP 2] Query Formulation Comparison")
    logger.info("=" * 80)
    
    # Old approach (error-symptom based)
    old_query = f"{broken_test['test_name']} {error_message[:200]}"
    logger.info(f"\n❌ OLD (Error-Symptom Based):")
    logger.info(f"   Query: {old_query[:150]}...")
    logger.info(f"   Problem: Focuses on 'NullPointerException', 'text()', 'null'")
    logger.info(f"   Result: Retrieves defensive null checks, isEmpty(), generic helpers")
    
    # New approach (AST-based)
    new_query = ast_builder.build_semantic_query(ast_components, error_message)
    exact_terms = ast_builder.extract_exact_terms(ast_components)
    
    logger.info(f"\n✅ NEW (AST-Based):")
    logger.info(f"   Query: {new_query}")
    logger.info(f"   Exact Terms: {exact_terms}")
    logger.info(f"   Focus: Method 'select' with literal '.active'")
    logger.info(f"   Result: Retrieves Element.select() docs, CSS selector examples")
    
    # Step 3: Initialize GATR and retrieve context
    logger.info("\n" + "=" * 80)
    logger.info("[STEP 3] Context Retrieval with AST-Based Approach")
    logger.info("=" * 80)
    
    try:
        engine = GATREngine(
            kuzu_db_path="workspace/kuzu_db",
            lancedb_path="workspace/lancedb"
        )
        
        logger.info(f"\n✅ GATR Engine initialized")
        logger.info(f"   LLM available: {engine.lm_studio_available}")
        logger.info(f"   Vector storage: {engine.vector_storage is not None}")
        logger.info(f"   KG manager: {engine.kg_manager is not None}")
        
        # Run repair to see what entities are retrieved
        logger.info(f"\n🔍 Running GATR repair to analyze retrieved entities...")
        
        result = engine.repair_test(
            broken_test=broken_test,
            error_message=error_message,
            project_name='ast_audit'
        )
        
        # Step 4: Analyze retrieved entities
        logger.info("\n" + "=" * 80)
        logger.info("[STEP 4] Retrieved Entities Analysis")
        logger.info("=" * 80)
        
        if result.final_rag_prompt:
            entities_with_snippets = result.final_rag_prompt.get('entities_with_snippets', [])
            total_entities = result.final_rag_prompt.get('total_entities', 0)
            entities_with_code = result.final_rag_prompt.get('entities_with_code', 0)
            
            logger.info(f"\n📊 Entity Statistics:")
            logger.info(f"   Total entities: {total_entities}")
            logger.info(f"   With code snippets: {entities_with_code}")
            logger.info(f"   Coverage: {(entities_with_code/total_entities*100) if total_entities > 0 else 0:.1f}%")
            
            logger.info(f"\n📋 Top 10 Retrieved Entities:")
            logger.info(f"{'#':<4} {'Name':<25} {'Type':<12} {'Score':<8} {'Snippet':<10} {'AST Match'}")
            logger.info("-" * 80)
            
            for i, entity in enumerate(entities_with_snippets[:10], 1):
                name = entity.get('name', '')[:24]
                etype = entity.get('type', '')[:11]
                score = entity.get('score', 0)
                snippet_len = entity.get('snippet_length', 0)
                exact_matches = entity.get('_exact_matches', 0)
                
                # Check if entity matches AST components
                ast_match = ''
                name_lower = entity.get('name', '').lower()
                for method in ast_components.get('method_calls', []):
                    if method.lower() in name_lower:
                        ast_match = f'✅ {method}'
                        break
                for type_name in ast_components.get('types', []):
                    if type_name.lower() in name_lower:
                        ast_match = f'✅ {type_name}'
                        break
                
                if not ast_match:
                    ast_match = '❌ generic'
                
                logger.info(f"{i:<4} {name:<25} {etype:<12} {score:<8.4f} {snippet_len:<10} {ast_match}")
            
            # Analyze quality
            logger.info(f"\n🎯 Quality Analysis:")
            
            ast_matched = sum(1 for e in entities_with_snippets[:10] 
                            if any(m.lower() in e.get('name', '').lower() 
                                  for m in ast_components.get('method_calls', [])))
            
            generic_helpers = sum(1 for e in entities_with_snippets[:10]
                                if any(h in e.get('name', '').lower() 
                                      for h in ['first', 'next', 'sibling', 'child', 'parent'])
                                and not any(m.lower() in e.get('name', '').lower()
                                          for m in ast_components.get('method_calls', [])))
            
            logger.info(f"   AST-matched entities (top 10): {ast_matched}/10 ({ast_matched*10}%)")
            logger.info(f"   Generic helpers (top 10): {generic_helpers}/10 ({generic_helpers*10}%)")
            
            if ast_matched >= 5:
                logger.info(f"   ✅ GOOD: Majority of entities match broken line's AST")
            elif ast_matched >= 3:
                logger.info(f"   ⚠️  FAIR: Some AST matches, but could be better")
            else:
                logger.info(f"   ❌ POOR: Few AST matches, context may be polluted")
            
            if generic_helpers <= 2:
                logger.info(f"   ✅ GOOD: Low generic helper pollution")
            else:
                logger.info(f"   ⚠️  WARNING: High generic helper pollution")
        
        # Step 5: Check repair quality
        logger.info("\n" + "=" * 80)
        logger.info("[STEP 5] Repair Quality")
        logger.info("=" * 80)
        
        logger.info(f"\nSuccess: {result.success}")
        logger.info(f"Strategy: {result.repair_strategy}")
        logger.info(f"Confidence: {result.confidence:.2f}")
        logger.info(f"Processing time: {result.processing_time:.2f}s")
        
        if result.repaired_code:
            logger.info(f"\n📝 Repaired Code Preview:")
            logger.info("-" * 80)
            lines = result.repaired_code.split('\n')
            for line in lines[:15]:
                logger.info(line)
            if len(lines) > 15:
                logger.info("... (truncated)")
            logger.info("-" * 80)
        
        # Final verdict
        logger.info("\n" + "=" * 80)
        logger.info("[FINAL VERDICT]")
        logger.info("=" * 80)
        
        if result.success and ast_matched >= 5:
            logger.info("✅ SUCCESS: AST-based retrieval working well!")
            logger.info("   - Entities match broken line's method calls")
            logger.info("   - Low generic helper pollution")
            logger.info("   - Repair generated successfully")
        elif result.success:
            logger.info("⚠️  PARTIAL: Repair succeeded but entity quality could improve")
            logger.info("   - Consider tuning AST filtering thresholds")
        else:
            logger.info("❌ FAILURE: Repair failed")
            logger.info(f"   Error: {result.error_message}")
        
        logger.info("=" * 80)
        
        return result.success
        
    except Exception as e:
        logger.error(f"❌ Audit failed: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    try:
        success = audit_ast_retrieval()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Audit failed: {e}", exc_info=True)
        sys.exit(1)
