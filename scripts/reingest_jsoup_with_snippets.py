"""
Re-ingest Jsoup Repository with Code Snippet Extraction (Bug 0 Fix)

This script:
1. Clears old LanceDB cache
2. Reads entity metadata from Kuzu (name, type, file_path, line numbers)
3. Extracts code snippets directly from cloned Jsoup repository
4. Stores entities with code snippets in LanceDB
5. Verifies snippet coverage is >80%

Architecture:
- Kuzu: Stores entity metadata and relationships (NO code)
- LanceDB: Stores entity embeddings + code snippets for semantic search
"""

import sys
import os
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import logging
from src.vector_storage.lance_manager import LanceManager
from src.vector_storage.vector_indexer import VectorIndexer
from src.relevance.embedding_generator import EmbeddingGenerator
from src.kuzu_manager import KuzuManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('workspace/logs/reingest_jsoup.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


def find_jsoup_repo():
    """Find the cloned Jsoup repository"""
    possible_paths = [
        Path("workspace/repos/jhy_jsoup"),
        Path("workspace/repos/jsoup"),
        Path("workspace/repos/jhy/jsoup"),
    ]
    
    for path in possible_paths:
        if path.exists() and path.is_dir():
            logger.info(f"Found Jsoup repository at: {path}")
            return path
    
    logger.error("Jsoup repository not found. Please run repository ingestion first.")
    return None


def extract_code_snippet(file_path: str, line_start: int, line_end: int, repo_path: Path, max_lines: int = 20) -> str:
    """
    Extract code snippet from file in the cloned repository
    
    Args:
        file_path: Relative file path from entity metadata
        line_start: Starting line number (1-indexed)
        line_end: Ending line number (1-indexed)
        repo_path: Path to cloned repository
        max_lines: Maximum lines to extract
    
    Returns:
        Extracted code snippet or empty string
    """
    if not file_path:
        return ''
    
    try:
        # Try multiple path resolution strategies
        full_path = None
        
        # Strategy 1: Direct path relative to repo
        candidate = repo_path / file_path
        if candidate.exists():
            full_path = candidate
        
        # Strategy 2: Remove leading path components (e.g., "src/main/java/...")
        if not full_path:
            parts = Path(file_path).parts
            for i in range(len(parts)):
                candidate = repo_path / Path(*parts[i:])
                if candidate.exists():
                    full_path = candidate
                    break
        
        # Strategy 3: Search for filename in repo
        if not full_path:
            filename = Path(file_path).name
            for found_file in repo_path.rglob(filename):
                if found_file.is_file():
                    full_path = found_file
                    break
        
        if not full_path or not full_path.exists():
            return ''
        
        # Read file and extract lines
        lines = full_path.read_text(encoding='utf-8', errors='ignore').splitlines()
        if not lines:
            return ''
        
        if line_start and line_end and line_start > 0 and line_end >= line_start:
            # Extract specified range
            start = max(0, line_start - 1)
            end = min(len(lines), line_end)
            snippet = lines[start:end]
            return '\n'.join(snippet[:max_lines]).strip()
        
        # Fallback: return first max_lines from file
        return '\n'.join(lines[:max_lines]).strip()
        
    except Exception as e:
        logger.debug(f"Failed to extract snippet from {file_path}: {e}")
        return ''


def clear_lancedb():
    """Clear old LanceDB data"""
    lancedb_path = Path("workspace/lancedb")
    
    if lancedb_path.exists():
        logger.info(f"Clearing old LanceDB at {lancedb_path}")
        try:
            shutil.rmtree(lancedb_path)
            logger.info("[OK] Old LanceDB cleared")
        except Exception as e:
            logger.error(f"[ERROR] Failed to clear LanceDB: {e}")
            return False
    else:
        logger.info("No existing LanceDB found")
    
    return True


def get_entities_from_kuzu(kg_manager):
    """
    Get all entity metadata from Kuzu (NO code, just metadata)
    
    Args:
        kg_manager: KuzuManager instance
    
    Returns:
        List of entity dictionaries with metadata
    """
    logger.info("Reading entity metadata from Kuzu...")
    
    try:
        # Query all CodeEntity nodes (metadata only)
        query = """
        MATCH (c:CodeEntity) 
        RETURN c.id AS id, 
               c.name AS name, 
               c.type AS type, 
               c.file_path AS file_path, 
               c.line_start AS line_start, 
               c.line_end AS line_end
        """
        result = kg_manager.connection.execute(query)
        
        entities = []
        while result.has_next():
            row = result.get_next()
            entities.append({
                'entity_id': row[0],
                'entity_name': row[1],
                'entity_type': row[2],
                'file_path': row[3],
                'line_start': row[4],
                'line_end': row[5]
            })
        
        logger.info(f"Found {len(entities)} entities in Kuzu")
        return entities
        
    except Exception as e:
        logger.error(f"Failed to read entities from Kuzu: {e}")
        import traceback
        traceback.print_exc()
        return []


def extract_snippets_and_create_vectors(entities, repo_path, embedding_generator):
    """
    Extract code snippets from repository and create vectors for LanceDB
    
    Args:
        entities: List of entity metadata from Kuzu
        repo_path: Path to cloned repository
        embedding_generator: EmbeddingGenerator instance
    
    Returns:
        List of vectors ready for LanceDB storage
    """
    logger.info("Extracting code snippets and generating embeddings...")
    
    vectors = []
    snippets_extracted = 0
    snippets_failed = 0
    
    for i, entity in enumerate(entities):
        # Extract code snippet from repository
        code_snippet = extract_code_snippet(
            file_path=entity['file_path'],
            line_start=entity['line_start'],
            line_end=entity['line_end'],
            repo_path=repo_path,
            max_lines=20
        )
        
        if code_snippet:
            snippets_extracted += 1
        else:
            snippets_failed += 1
        
        # Prepare text for embedding
        text_parts = [
            f"{entity['entity_type']} {entity['entity_name']}",
            f"in {entity['file_path']}"
        ]
        if code_snippet:
            text_parts.append(code_snippet[:500])  # Limit for embedding
        
        text = " ".join(text_parts)
        
        # Generate embedding
        try:
            embedding = embedding_generator.generate_embedding(text)
            
            vectors.append({
                'entity_id': entity['entity_id'],
                'entity_name': entity['entity_name'],
                'entity_type': entity['entity_type'],
                'file_path': entity['file_path'],
                'line_start': entity['line_start'],
                'line_end': entity['line_end'],
                'embedding': embedding,
                'code_snippet': code_snippet,
                'relevance_score': 0.0,
                'semantic_similarity': 0.0,
                'textual_similarity': 0.0,
            })
        except Exception as e:
            logger.warning(f"Failed to generate embedding for {entity['entity_id']}: {e}")
            continue
        
        # Log progress
        if (i + 1) % 500 == 0:
            logger.info(f"Processed {i + 1}/{len(entities)} entities ({snippets_extracted} with code)")
    
    coverage = (snippets_extracted / len(entities) * 100) if entities else 0
    logger.info(f"Code snippet extraction complete:")
    logger.info(f"  Total entities: {len(entities)}")
    logger.info(f"  With snippets: {snippets_extracted} ({coverage:.2f}%)")
    logger.info(f"  Without snippets: {snippets_failed} ({100-coverage:.2f}%)")
    
    return vectors, snippets_extracted, len(entities)


def store_vectors_in_lancedb(vectors, lance_manager, vector_indexer):
    """
    Store vectors in LanceDB
    
    Args:
        vectors: List of vector dictionaries
        lance_manager: LanceManager instance
        vector_indexer: VectorIndexer instance
    
    Returns:
        Number of vectors stored
    """
    logger.info("Storing vectors in LanceDB...")
    
    try:
        table_name = "code_entity_embeddings"
        
        # Store in batches
        batch_size = 1000
        total_inserted = 0
        
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i+batch_size]
            result = lance_manager.add_vectors(table_name, batch)
            
            if result.get('success'):
                total_inserted += result.get('inserted', 0)
                logger.info(f"Inserted batch {i//batch_size + 1}: {result.get('inserted', 0)} vectors")
        
        # Create index for efficient search
        if total_inserted > 0:
            logger.info("Creating vector index...")
            vector_indexer.create_index(table_name)
        
        logger.info(f"[OK] Stored {total_inserted} vectors in LanceDB")
        return total_inserted
        
    except Exception as e:
        logger.error(f"Failed to store vectors in LanceDB: {e}")
        import traceback
        traceback.print_exc()
        return 0


def verify_snippet_coverage(lance_manager):
    """
    Verify that entities in LanceDB have code snippets
    
    Args:
        lance_manager: LanceManager instance
    
    Returns:
        Coverage percentage and detailed stats
    """
    logger.info("Verifying snippet coverage in LanceDB...")
    
    try:
        table = lance_manager.get_table("code_entity_embeddings")
        if not table:
            logger.error("[ERROR] Table 'code_entity_embeddings' not found")
            return 0.0, {}
        
        df = table.to_pandas()
        total = len(df)
        
        with_snippets = 0
        without_snippets = 0
        snippet_lengths = []
        
        # Sample entities for verification
        sample_with_code = []
        sample_without_code = []
        
        for idx, row in df.iterrows():
            code_snippet = row.get('code_snippet', '')
            entity_name = row.get('entity_name', 'unknown')
            entity_type = row.get('entity_type', 'unknown')
            
            if code_snippet and len(code_snippet) > 0:
                with_snippets += 1
                snippet_lengths.append(len(code_snippet))
                
                # Collect samples
                if len(sample_with_code) < 5:
                    sample_with_code.append({
                        'name': entity_name,
                        'type': entity_type,
                        'snippet_length': len(code_snippet),
                        'snippet_preview': code_snippet[:100]
                    })
            else:
                without_snippets += 1
                
                # Collect samples
                if len(sample_without_code) < 5:
                    sample_without_code.append({
                        'name': entity_name,
                        'type': entity_type,
                        'file_path': row.get('file_path', '')
                    })
        
        coverage = (with_snippets / total * 100) if total > 0 else 0
        avg_length = sum(snippet_lengths) / len(snippet_lengths) if snippet_lengths else 0
        
        logger.info(f"Snippet coverage verification:")
        logger.info(f"  Total entities: {total}")
        logger.info(f"  With snippets: {with_snippets} ({coverage:.2f}%)")
        logger.info(f"  Without snippets: {without_snippets} ({100-coverage:.2f}%)")
        logger.info(f"  Avg snippet length: {avg_length:.0f} chars")
        
        # Show samples
        if sample_with_code:
            logger.info(f"\nSample entities WITH code snippets:")
            for i, sample in enumerate(sample_with_code, 1):
                logger.info(f"  {i}. {sample['name']} ({sample['type']}) - {sample['snippet_length']} chars")
                logger.info(f"     Preview: {sample['snippet_preview']}...")
        
        if sample_without_code:
            logger.info(f"\nSample entities WITHOUT code snippets:")
            for i, sample in enumerate(sample_without_code, 1):
                logger.info(f"  {i}. {sample['name']} ({sample['type']}) - {sample['file_path']}")
        
        stats = {
            'total': total,
            'with_snippets': with_snippets,
            'without_snippets': without_snippets,
            'coverage': coverage,
            'avg_length': avg_length,
            'sample_with_code': sample_with_code,
            'sample_without_code': sample_without_code
        }
        
        return coverage, stats
        
    except Exception as e:
        logger.error(f"Failed to verify coverage: {e}")
        import traceback
        traceback.print_exc()
        return 0.0, {}


def main():
    """Main re-ingestion process"""
    logger.info("="*80)
    logger.info("JSOUP RE-INGESTION WITH CODE SNIPPET EXTRACTION")
    logger.info("="*80)
    
    # Step 1: Clear old LanceDB
    logger.info("\n[Step 1/6] Clearing old LanceDB cache")
    logger.info("-"*40)
    if not clear_lancedb():
        logger.error("[ERROR] Failed to clear LanceDB. Aborting.")
        return 1
    
    # Step 2: Find Jsoup repository
    logger.info("\n[Step 2/6] Locating Jsoup repository")
    logger.info("-"*40)
    
    repo_path = find_jsoup_repo()
    if not repo_path:
        logger.error("[ERROR] Jsoup repository not found. Aborting.")
        logger.error("Please run repository ingestion first to clone the repo.")
        return 1
    
    # Step 3: Initialize components
    logger.info("\n[Step 3/6] Initializing components")
    logger.info("-"*40)
    
    try:
        # Initialize Kuzu (for entity metadata)
        kg_path = "workspace/gater_knowledge_graph"
        kg_manager = KuzuManager(kg_path)
        if not kg_manager.connect():
            logger.error("[ERROR] Failed to connect to Kuzu. Run repository ingestion first.")
            return 1
        logger.info("[OK] Connected to Kuzu")
        
        # Initialize LanceDB
        lance_manager = LanceManager("workspace/lancedb")
        if not lance_manager.is_available():
            logger.error("[ERROR] LanceDB not available")
            return 1
        logger.info("[OK] Initialized LanceDB")
        
        # Initialize Vector Indexer
        vector_indexer = VectorIndexer(lance_manager)
        logger.info("[OK] Initialized Vector Indexer")
        
        # Initialize Embedding Generator
        embedding_generator = EmbeddingGenerator(cache_dir="workspace/embeddings_cache")
        logger.info("[OK] Initialized Embedding Generator")
        
    except Exception as e:
        logger.error(f"[ERROR] Failed to initialize components: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # Step 4: Get entity metadata from Kuzu
    logger.info("\n[Step 4/6] Reading entity metadata from Kuzu")
    logger.info("-"*40)
    
    entities = get_entities_from_kuzu(kg_manager)
    
    if not entities:
        logger.error("[ERROR] No entities found in Kuzu. Run repository ingestion first.")
        return 1
    
    logger.info(f"[OK] Found {len(entities)} entities in Kuzu")
    
    # Step 5: Extract code snippets and create vectors
    logger.info("\n[Step 5/6] Extracting code snippets from repository")
    logger.info("-"*40)
    
    vectors, snippets_extracted, total_entities = extract_snippets_and_create_vectors(
        entities, repo_path, embedding_generator
    )
    
    if not vectors:
        logger.error("[ERROR] Failed to create vectors. Aborting.")
        return 1
    
    extraction_coverage = (snippets_extracted / total_entities * 100) if total_entities > 0 else 0
    logger.info(f"[OK] Created {len(vectors)} vectors ({extraction_coverage:.2f}% with code)")
    
    # Store in LanceDB
    logger.info("\nStoring vectors in LanceDB...")
    vectors_stored = store_vectors_in_lancedb(vectors, lance_manager, vector_indexer)
    
    if vectors_stored == 0:
        logger.error("[ERROR] Failed to store vectors in LanceDB. Aborting.")
        return 1
    
    # Step 6: Verify snippet coverage
    logger.info("\n[Step 6/6] Verifying snippet coverage in LanceDB")
    logger.info("-"*40)
    
    final_coverage, stats = verify_snippet_coverage(lance_manager)
    
    # Summary
    logger.info("\n" + "="*80)
    logger.info("RE-INGESTION SUMMARY")
    logger.info("="*80)
    logger.info(f"Repository: {repo_path}")
    logger.info(f"Total entities in Kuzu: {total_entities}")
    logger.info(f"Code snippets extracted: {snippets_extracted} ({extraction_coverage:.2f}%)")
    logger.info(f"Vectors stored in LanceDB: {vectors_stored}")
    logger.info(f"Final LanceDB coverage: {final_coverage:.2f}%")
    
    if stats:
        logger.info(f"Average snippet length: {stats.get('avg_length', 0):.0f} chars")
    
    # Verdict
    logger.info("\n" + "="*80)
    logger.info("VERDICT")
    logger.info("="*80)
    
    if final_coverage >= 80:
        logger.info(f"\n[SUCCESS] Re-ingestion completed successfully!")
        logger.info(f"Snippet coverage is {final_coverage:.2f}% (target: >80%)")
        logger.info("LanceDB is ready for semantic search with code context.")
        return 0
    elif final_coverage >= 50:
        logger.warning(f"\n[PARTIAL SUCCESS] Re-ingestion completed with {final_coverage:.2f}% coverage")
        logger.warning("Coverage is below target (80%) but may be sufficient for testing.")
        logger.warning("Some entities may not have accessible file paths.")
        return 0
    else:
        logger.error(f"\n[FAILED] Re-ingestion completed but coverage is only {final_coverage:.2f}%")
        logger.error("Expected >80% coverage. Possible issues:")
        logger.error("  1. File paths in Kuzu don't match repository structure")
        logger.error("  2. Repository was not cloned correctly")
        logger.error("  3. Entity extraction didn't capture line numbers")
        return 1


if __name__ == '__main__':
    # Ensure logs directory exists
    Path('workspace/logs').mkdir(parents=True, exist_ok=True)
    
    sys.exit(main())
