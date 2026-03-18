#!/usr/bin/env python3
"""
GATeR Pipeline Script - Run full pipeline on jhy/jsoup repository

This script runs the complete GATR (Graph-Aware Test Repair) pipeline
on the jsoup repository for extensive testing and validation.

Usage:
    python scripts/run_jsoup_pipeline.py [--skip-clone] [--limit N]
"""

import sys
import os
import argparse
import logging
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.parsers.repo_parser import RepoParser
from src.extractors.entity_extractor import EntityExtractor
from src.kuzu_manager import KuzuManager
from src.gatr.gatr_engine import GATREngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('workspace/logs/jsoup_pipeline.log')
    ]
)
logger = logging.getLogger('jsoup_pipeline')


def run_pipeline(skip_clone: bool = False, entity_limit: int = 1000):
    """
    Run the complete GATR pipeline on jhy/jsoup
    
    Args:
        skip_clone: Skip cloning if repo already exists
        entity_limit: Maximum number of entities to process
    """
    start_time = datetime.now()
    logger.info("=" * 60)
    logger.info("GATeR Pipeline - jhy/jsoup Analysis")
    logger.info("=" * 60)
    
    workspace_path = Path("workspace")
    repos_path = workspace_path / "repos"
    data_path = workspace_path / "data"
    
    # Ensure directories exist
    repos_path.mkdir(parents=True, exist_ok=True)
    data_path.mkdir(parents=True, exist_ok=True)
    
    results = {
        'repository': 'jhy/jsoup',
        'started_at': start_time.isoformat(),
        'steps': {}
    }
    
    # ============ Step 1: Clone/Parse Repository ============
    logger.info("\n[Step 1/5] Repository Parsing")
    logger.info("-" * 40)
    
    repo_path = repos_path / "jhy_jsoup"
    
    try:
        parser = RepoParser()
        
        if skip_clone and repo_path.exists():
            logger.info(f"Skipping clone - using existing repo at {repo_path}")
            repo_url = "https://github.com/jhy/jsoup"
        else:
            repo_url = "https://github.com/jhy/jsoup"
            logger.info(f"Cloning {repo_url}...")
        
        # Parse repository
        parse_result = parser.parse_repository(
            repo_url,
            clone_path=str(repos_path),
            max_files=500,
            include_tests=True
        )
        
        results['steps']['parsing'] = {
            'success': parse_result.get('success', False),
            'files_parsed': len(parse_result.get('files', [])),
            'repo_path': str(repo_path)
        }
        
        logger.info(f"Parsed {len(parse_result.get('files', []))} files")
        
    except Exception as e:
        logger.error(f"Repository parsing failed: {e}")
        results['steps']['parsing'] = {'success': False, 'error': str(e)}
        return results
    
    # ============ Step 2: Entity Extraction ============
    logger.info("\n[Step 2/5] Entity Extraction")
    logger.info("-" * 40)
    
    try:
        extractor = EntityExtractor()
        
        entities = []
        files = parse_result.get('files', [])
        
        for i, file_info in enumerate(files[:entity_limit]):
            if i % 50 == 0:
                logger.info(f"Extracting entities from file {i+1}/{min(len(files), entity_limit)}")
            
            file_entities = extractor.extract_entities(
                file_info.get('content', ''),
                file_info.get('path', ''),
                file_info.get('language', 'java')
            )
            entities.extend(file_entities)
        
        results['steps']['extraction'] = {
            'success': True,
            'entities_extracted': len(entities),
            'entity_types': list(set(e.get('type', 'unknown') for e in entities))
        }
        
        logger.info(f"Extracted {len(entities)} entities")
        
        # Save entities to JSON
        entities_file = data_path / "jhy_jsoup_entities.json"
        with open(entities_file, 'w', encoding='utf-8') as f:
            json.dump(entities[:500], f, indent=2, default=str)
        logger.info(f"Saved entities to {entities_file}")
        
    except Exception as e:
        logger.error(f"Entity extraction failed: {e}")
        results['steps']['extraction'] = {'success': False, 'error': str(e)}
        return results
    
    # ============ Step 3: Knowledge Graph Construction ============
    logger.info("\n[Step 3/5] Knowledge Graph Construction")
    logger.info("-" * 40)
    
    try:
        kg_path = workspace_path / "gater_knowledge_graph"
        kg_manager = KuzuManager(str(kg_path))
        
        # Add entities to knowledge graph
        added_count = 0
        for entity in entities[:500]:
            try:
                kg_manager.add_entity(entity)
                added_count += 1
            except Exception as e:
                pass  # Skip duplicates or invalid entities
        
        # Build relationships
        relationships_added = 0
        for entity in entities[:200]:
            try:
                # Add simple relationships based on file co-occurrence
                related = [e for e in entities if e.get('file') == entity.get('file') and e != entity]
                for rel_entity in related[:5]:
                    kg_manager.add_relationship(
                        entity.get('name', ''),
                        rel_entity.get('name', ''),
                        'co_located'
                    )
                    relationships_added += 1
            except Exception:
                pass
        
        results['steps']['knowledge_graph'] = {
            'success': True,
            'entities_added': added_count,
            'relationships_added': relationships_added
        }
        
        logger.info(f"Added {added_count} entities and {relationships_added} relationships to KG")
        
    except Exception as e:
        logger.error(f"Knowledge graph construction failed: {e}")
        results['steps']['knowledge_graph'] = {'success': False, 'error': str(e)}
        return results
    
    # ============ Step 4: GATR Engine Initialization ============
    logger.info("\n[Step 4/5] GATR Engine Test")
    logger.info("-" * 40)
    
    try:
        engine = GATREngine()
        
        # Check LLM status
        llm_status = engine.get_llm_status()
        
        results['steps']['gatr_engine'] = {
            'success': True,
            'llm_available': llm_status.get('available', False),
            'llm_model': llm_status.get('lm_studio_model') or llm_status.get('ollama_model', 'N/A'),
            'models_available': len(llm_status.get('models', []))
        }
        
        logger.info(f"GATR Engine initialized - LLM available: {llm_status.get('available', False)}")
        
    except Exception as e:
        logger.error(f"GATR engine initialization failed: {e}")
        results['steps']['gatr_engine'] = {'success': False, 'error': str(e)}
        return results
    
    # ============ Step 5: Sample Repair Test ============
    logger.info("\n[Step 5/5] Sample Repair Test")
    logger.info("-" * 40)
    
    try:
        # Create a sample broken test for jsoup
        sample_test = {
            'test_name': 'test_httpconnection_fetch',
            'test_code': '''
import org.jsoup.Connection;
import org.jsoup.helper.HttpConnection;

public class HttpConnectionTest {
    @Test
    public void testFetchResponse() {
        Connection.Response res = new HttpConnection.Fetch();
        assertNotNull(res);
    }
}
''',
            'file_path': 'src/test/java/org/jsoup/helper/HttpConnectionTest.java'
        }
        
        error_message = "HttpConnection has no member Fetch"
        
        # Run repair
        repair_result = engine.repair_test(
            broken_test=sample_test,
            error_message=error_message,
            project_name='jsoup_test'
        )
        
        results['steps']['sample_repair'] = {
            'success': repair_result.success,
            'repair_strategy': repair_result.repair_strategy,
            'confidence': repair_result.confidence,
            'processing_time': repair_result.processing_time,
            'has_diff': bool(repair_result.diff_content),
            'diff_file': repair_result.diff_file_path
        }
        
        if repair_result.diff_content:
            logger.info("Repair generated successfully!")
            logger.info(f"Diff preview:\n{repair_result.diff_content[:500]}...")
        else:
            logger.warning("No diff generated")
        
    except Exception as e:
        logger.error(f"Sample repair test failed: {e}")
        results['steps']['sample_repair'] = {'success': False, 'error': str(e)}
    
    # ============ Summary ============
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    results['completed_at'] = end_time.isoformat()
    results['duration_seconds'] = duration
    results['overall_success'] = all(
        step.get('success', False) 
        for step in results['steps'].values()
    )
    
    logger.info("\n" + "=" * 60)
    logger.info("Pipeline Summary")
    logger.info("=" * 60)
    
    for step_name, step_result in results['steps'].items():
        status = "SUCCESS" if step_result.get('success') else "FAILED"
        logger.info(f"  {step_name}: {status}")
    
    logger.info(f"\nTotal duration: {duration:.2f} seconds")
    logger.info(f"Overall: {'SUCCESS' if results['overall_success'] else 'FAILED'}")
    
    # Save results
    results_file = data_path / f"jsoup_pipeline_results_{start_time.strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, default=str)
    logger.info(f"\nResults saved to: {results_file}")
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Run GATeR pipeline on jhy/jsoup')
    parser.add_argument('--skip-clone', action='store_true', 
                        help='Skip cloning if repo already exists')
    parser.add_argument('--limit', type=int, default=500,
                        help='Maximum number of files to process (default: 500)')
    
    args = parser.parse_args()
    
    # Ensure logs directory exists
    Path('workspace/logs').mkdir(parents=True, exist_ok=True)
    
    results = run_pipeline(
        skip_clone=args.skip_clone,
        entity_limit=args.limit
    )
    
    return 0 if results.get('overall_success') else 1


if __name__ == '__main__':
    sys.exit(main())
