"""
Deep audit of GATR context pipeline
Examines exactly what data flows through each stage
"""

import logging
import sys
import requests
import json
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('audit_gatr')

BASE_URL = 'http://localhost:5000'

def audit_gatr_context():
    """Deep audit of GATR context flow"""
    
    try:
        logger.info("=" * 80)
        logger.info("GATR CONTEXT DEEP AUDIT")
        logger.info("=" * 80)
        
        # Prepare test case
        test_code = '''import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class ComplexJsoupAssertionTest {
    @Test
    void testPosts() {
        Document doc = Jsoup.parse(HTML_INPUT);
        Elements posts = doc.select(".post");
        
        for (Element post : posts) {
            Element body = post.select(".body").first();
            String text = body.text();
            assertTrue(text.trim().length() > 0, "Body content should not be empty");
            
            Elements tags = post.select(".tags li");
            assertTrue(tags.size() >= 1, "There should be at least one tag");
            assertFalse(tags.first().text().trim().isEmpty(), "First tag should not be empty");
        }
    }
}'''
        
        error_message = '''org.opentest4j.AssertionFailedError: Body content should not be empty
    at ComplexJsoupAssertionTest.testPosts(ComplexJsoupAssertionTest.java:38)'''
        
        payload = {
            'test_name': 'testPosts',
            'test_code': test_code,
            'test_file': 'ComplexJsoupAssertionTest.java',
            'test_class': 'ComplexJsoupAssertionTest',
            'error_message': error_message,
            'project_name': 'jsoup_audit',
            'include_debug_trace': True
        }
        
        logger.info("\n1. Calling GATR repair endpoint with debug trace...")
        response = requests.post(
            f'{BASE_URL}/gatr/repair',
            json=payload,
            timeout=120
        )
        
        if response.status_code != 200:
            logger.error(f"API returned {response.status_code}: {response.text}")
            return False
        
        result = response.json()
        
        # Save full result for inspection
        audit_file = Path('workspace/fix/gatr_audit_full_result.json')
        audit_file.parent.mkdir(parents=True, exist_ok=True)
        with open(audit_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        logger.info(f"   Full result saved to: {audit_file}")
        
        # ============ AUDIT RAW CONTEXT ============
        logger.info("\n" + "=" * 80)
        logger.info("STAGE 1: RAW CONTEXT INGESTION")
        logger.info("=" * 80)
        
        raw_context = result.get('raw_context_details', {})
        if not raw_context:
            logger.error("❌ No raw_context_details in result!")
            return False
        
        logger.info(f"\nTotal entities found: {raw_context.get('entities_found', 0)}")
        logger.info(f"Semantic hits: {raw_context.get('semantic_hits', 0)}")
        logger.info(f"Snippets found: {raw_context.get('snippets_found', 0)}")
        logger.info(f"Graph paths: {raw_context.get('graph_paths', 0)}")
        
        # Analyze top entities by source
        top_entities = raw_context.get('top_entities', [])
        if top_entities:
            logger.info(f"\n📊 Top {len(top_entities)} entities breakdown:")
            
            by_source = {}
            for entity in top_entities:
                src = entity.get('src', 'unknown')
                has_snippet = entity.get('has_snippet', False)
                
                if src not in by_source:
                    by_source[src] = {'total': 0, 'with_snippet': 0, 'entities': []}
                
                by_source[src]['total'] += 1
                if has_snippet:
                    by_source[src]['with_snippet'] += 1
                by_source[src]['entities'].append(entity)
            
            for src, data in by_source.items():
                coverage = data['with_snippet'] / data['total'] if data['total'] > 0 else 0
                logger.info(f"\n   Source: {src}")
                logger.info(f"   - Total: {data['total']}")
                logger.info(f"   - With snippet: {data['with_snippet']} ({coverage:.1%})")
                
                # Show top 3 entities from this source
                logger.info(f"   - Top entities:")
                for i, entity in enumerate(data['entities'][:3], 1):
                    name = entity.get('name', 'unknown')
                    etype = entity.get('type', 'unknown')
                    score = entity.get('score', 0)
                    has_snippet = '✅' if entity.get('has_snippet') else '❌'
                    logger.info(f"      {i}. {name} ({etype}) - score: {score:.3f} - snippet: {has_snippet}")
        
        # ============ AUDIT COMPRESSED CONTEXT ============
        logger.info("\n" + "=" * 80)
        logger.info("STAGE 2: CONTEXT COMPRESSION")
        logger.info("=" * 80)
        
        compressed_context = result.get('compressed_context_details', {})
        if not compressed_context:
            logger.error("❌ No compressed_context_details in result!")
            return False
        
        # Step 2.1: Hybrid Scoring
        hybrid_scoring = compressed_context.get('step_2_1_hybrid_scoring', {})
        if hybrid_scoring:
            logger.info(f"\n2.1 Hybrid Scoring:")
            logger.info(f"   Total scored: {hybrid_scoring.get('total_scored', 0)}")
            logger.info(f"   KGCompass weight: {hybrid_scoring.get('kgcompass_weight', 0)}")
            logger.info(f"   Semantic weight: {hybrid_scoring.get('semantic_weight', 0)}")
        
        # Step 2.2: Entity Filtering
        entity_filtering = compressed_context.get('step_2_2_entity_filtering', {})
        if entity_filtering:
            logger.info(f"\n2.2 Entity Filtering:")
            logger.info(f"   Entities after filter: {entity_filtering.get('entities_after_filter', 0)}")
            logger.info(f"   Filtered out: {entity_filtering.get('filtered_out', 0)}")
        
        # Step 2.3: Snippet Compression (CRITICAL)
        snippet_compression = compressed_context.get('step_2_3_snippet_compression', {})
        if snippet_compression:
            logger.info(f"\n2.3 Snippet Compression (CRITICAL):")
            logger.info(f"   Input entities: {snippet_compression.get('input_entities', 0)}")
            logger.info(f"   Raw snippets available: {snippet_compression.get('raw_snippets', 0)}")
            logger.info(f"   Snippets retained: {snippet_compression.get('snippets_retained', 0)}")
            logger.info(f"   Missing snippets: {snippet_compression.get('missing_snippets', 0)}")
            logger.info(f"   Fallback extractions: {snippet_compression.get('fallback_extractions', 0)}")
            logger.info(f"   Fallback used: {snippet_compression.get('fallback_used', False)}")
            
            # Calculate coverage
            input_ent = snippet_compression.get('input_entities', 0)
            retained = snippet_compression.get('snippets_retained', 0)
            if input_ent > 0:
                coverage = retained / input_ent
                status = '✅' if coverage >= 0.7 else '⚠️' if coverage >= 0.5 else '❌'
                logger.info(f"   Coverage: {coverage:.1%} {status}")
        
        # ============ AUDIT AGGREGATED CONTEXT ============
        logger.info("\n" + "=" * 80)
        logger.info("STAGE 3: RAG AGGREGATION")
        logger.info("=" * 80)
        
        aggregated_context = result.get('aggregated_context_details', {})
        if aggregated_context:
            logger.info(f"\nAPI deltas: {aggregated_context.get('api_deltas_count', 0)}")
            logger.info(f"Canonical usages: {aggregated_context.get('canonical_usages_count', 0)}")
        
        # ============ AUDIT FINAL PROMPT ============
        logger.info("\n" + "=" * 80)
        logger.info("STAGE 4: FINAL PROMPT GENERATION")
        logger.info("=" * 80)
        
        final_prompt = result.get('final_rag_prompt', {})
        if final_prompt:
            system_msg = final_prompt.get('system_message', '')
            user_prompt = final_prompt.get('user_prompt', '')
            
            logger.info(f"\nSystem message length: {len(system_msg)} chars")
            logger.info(f"User prompt length: {len(user_prompt)} chars")
            
            # Count code blocks in prompt
            code_blocks = user_prompt.count('```')
            logger.info(f"Code blocks in prompt: {code_blocks // 2}")
            
            # Check for entity section
            if '## KNOWLEDGE GRAPH CONTEXT' in user_prompt:
                logger.info("✅ Knowledge graph context section present")
                
                # Count entities with code
                import re
                entity_pattern = r'### \d+\. (\w+) \((\w+)\) — relevance: ([\d.]+)'
                entities_in_prompt = re.findall(entity_pattern, user_prompt)
                logger.info(f"   Entities in prompt: {len(entities_in_prompt)}")
                
                # Check for fallback markers
                fallback_count = user_prompt.count('[Fallback snippet')
                logger.info(f"   Fallback snippets: {fallback_count}")
                
                # Show entities
                if entities_in_prompt:
                    logger.info(f"\n   Top entities in prompt:")
                    for i, (name, etype, score) in enumerate(entities_in_prompt[:5], 1):
                        logger.info(f"      {i}. {name} ({etype}) - relevance: {score}")
            else:
                logger.warning("⚠️ No knowledge graph context section in prompt!")
            
            # Save prompt for manual inspection
            prompt_file = Path('workspace/fix/gatr_audit_prompt.txt')
            with open(prompt_file, 'w', encoding='utf-8') as f:
                f.write(f"=== SYSTEM MESSAGE ===\n{system_msg}\n\n")
                f.write(f"=== USER PROMPT ===\n{user_prompt}\n")
            logger.info(f"\n   Prompt saved to: {prompt_file}")
        
        # ============ RETRIEVAL TRACE ============
        logger.info("\n" + "=" * 80)
        logger.info("RETRIEVAL TRACE ANALYSIS")
        logger.info("=" * 80)
        
        retrieval_trace = result.get('retrieval_trace', {})
        if retrieval_trace:
            logger.info("\nRetrieval methods used:")
            
            # KG retrieval
            kg_trace = retrieval_trace.get('knowledge_graph', {})
            if kg_trace:
                logger.info(f"\n   Knowledge Graph:")
                logger.info(f"   - Entities retrieved: {kg_trace.get('entities_retrieved', 0)}")
                logger.info(f"   - Paths found: {kg_trace.get('paths_found', 0)}")
                logger.info(f"   - Query: {kg_trace.get('query', 'N/A')}")
            
            # Vector retrieval
            vector_trace = retrieval_trace.get('vector_search', {})
            if vector_trace:
                logger.info(f"\n   Vector Search:")
                logger.info(f"   - Results: {vector_trace.get('results_count', 0)}")
                logger.info(f"   - Query: {vector_trace.get('query', 'N/A')}")
                logger.info(f"   - Top K: {vector_trace.get('top_k', 0)}")
            
            # KGCompass retrieval
            kgcompass_trace = retrieval_trace.get('kgcompass', {})
            if kgcompass_trace:
                logger.info(f"\n   KGCompass:")
                logger.info(f"   - Candidates: {kgcompass_trace.get('candidates', 0)}")
                logger.info(f"   - Top scored: {kgcompass_trace.get('top_scored', 0)}")
        
        # ============ IDENTIFY FLAWS ============
        logger.info("\n" + "=" * 80)
        logger.info("FLAW IDENTIFICATION")
        logger.info("=" * 80)
        
        flaws = []
        
        # Flaw 1: Low snippet coverage in compression
        if snippet_compression:
            input_ent = snippet_compression.get('input_entities', 0)
            retained = snippet_compression.get('snippets_retained', 0)
            if input_ent > 0:
                coverage = retained / input_ent
                if coverage < 0.5:
                    flaws.append({
                        'severity': 'HIGH',
                        'stage': 'Compression',
                        'issue': f'Low snippet retention: {retained}/{input_ent} ({coverage:.1%})',
                        'impact': 'Most entities have no code in prompt'
                    })
        
        # Flaw 2: Missing snippets from specific sources
        if top_entities:
            for src, data in by_source.items():
                coverage = data['with_snippet'] / data['total'] if data['total'] > 0 else 0
                if coverage < 0.8:
                    flaws.append({
                        'severity': 'MEDIUM' if src == 'kgcompass' else 'LOW',
                        'stage': 'Raw Ingestion',
                        'issue': f'{src} source has low snippet coverage: {coverage:.1%}',
                        'impact': f'{src} entities lack code context'
                    })
        
        # Flaw 3: Few code blocks in prompt
        if final_prompt:
            code_blocks = user_prompt.count('```') // 2
            if code_blocks < 5:
                flaws.append({
                    'severity': 'HIGH',
                    'stage': 'Prompt Generation',
                    'issue': f'Only {code_blocks} code blocks in prompt',
                    'impact': 'LLM has minimal code examples'
                })
        
        # Flaw 4: No fallback usage when snippets missing
        if snippet_compression:
            missing = snippet_compression.get('missing_snippets', 0)
            fallback = snippet_compression.get('fallback_extractions', 0)
            if missing > 0 and fallback == 0:
                flaws.append({
                    'severity': 'MEDIUM',
                    'stage': 'Compression',
                    'issue': f'{missing} missing snippets, but 0 fallback extractions',
                    'impact': 'File system fallback not working'
                })
        
        if flaws:
            logger.warning(f"\n⚠️ {len(flaws)} FLAWS IDENTIFIED:")
            for i, flaw in enumerate(flaws, 1):
                logger.warning(f"\n   Flaw {i} [{flaw['severity']}]:")
                logger.warning(f"   Stage: {flaw['stage']}")
                logger.warning(f"   Issue: {flaw['issue']}")
                logger.warning(f"   Impact: {flaw['impact']}")
        else:
            logger.info("\n✅ No critical flaws identified")
        
        # ============ SUMMARY ============
        logger.info("\n" + "=" * 80)
        logger.info("AUDIT SUMMARY")
        logger.info("=" * 80)
        
        logger.info(f"\nData Flow:")
        logger.info(f"   Raw entities: {raw_context.get('entities_found', 0)}")
        logger.info(f"   → Filtered: {entity_filtering.get('entities_after_filter', 0) if entity_filtering else 'N/A'}")
        logger.info(f"   → With snippets: {snippet_compression.get('snippets_retained', 0) if snippet_compression else 'N/A'}")
        
        # Count entities in prompt (handle case where entities_in_prompt may not be defined)
        entities_count = 'N/A'
        if final_prompt:
            try:
                import re
                entity_pattern = r'### \d+\. (\w+) \((\w+)\) — relevance: ([\d.]+)'
                entities_in_prompt_list = re.findall(entity_pattern, final_prompt.get('user_prompt', ''))
                entities_count = len(entities_in_prompt_list)
            except Exception:
                entities_count = 'N/A'
        logger.info(f"   → In prompt: {entities_count}")
        
        logger.info(f"\nSnippet Sources:")
        if top_entities:
            for src, data in by_source.items():
                coverage = data['with_snippet'] / data['total'] if data['total'] > 0 else 0
                status = '✅' if coverage >= 0.8 else '⚠️' if coverage >= 0.5 else '❌'
                logger.info(f"   {src}: {data['with_snippet']}/{data['total']} ({coverage:.1%}) {status}")
        
        logger.info(f"\nFlaws: {len(flaws)}")
        logger.info(f"Critical issues: {sum(1 for f in flaws if f['severity'] == 'HIGH')}")
        
        return len(flaws) == 0
        
    except Exception as e:
        logger.error(f"\n❌ Audit failed: {e}", exc_info=True)
        return False

if __name__ == '__main__':
    success = audit_gatr_context()
    sys.exit(0 if success else 1)
