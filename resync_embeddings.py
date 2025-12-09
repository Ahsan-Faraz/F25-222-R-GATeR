"""
Resync all Knowledge Graph entities to LanceDB with proper deduplication
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.kuzu_manager import KuzuManager
from src.knowledge_graph.kg_manager import KnowledgeGraphManager
from src.vector_storage.lance_manager import LanceManager
from src.relevance.embedding_generator import EmbeddingGenerator
import numpy as np
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def resync_embeddings():
    """Resync all KG entities to LanceDB with proper deduplication"""
    
    print("=" * 60)
    print(" Resync Knowledge Graph to LanceDB")
    print("=" * 60)
    
    # Initialize components
    print("\n[1] Initializing components...")
    kg_manager = KnowledgeGraphManager(kuzu_db_path="workspace/gater_knowledge_graph")
    lance_manager = LanceManager(db_path="workspace/lancedb")
    embedding_generator = EmbeddingGenerator()
    
    print(f"    KG Entities: {kg_manager.graph.number_of_nodes()}")
    print(f"    KG Edges: {kg_manager.graph.number_of_edges()}")
    
    # Get all entities from KG
    print("\n[2] Collecting entities from Knowledge Graph...")
    
    # Include ALL relevant entity types
    candidate_types = ['function', 'method', 'class', 'test', 'test_method', 'file', 'import', 'resource', 'unknown_function']
    
    candidates = []
    seen_ids = set()  # For deduplication
    
    for node_id, node_data in kg_manager.graph.nodes(data=True):
        # Skip if already seen
        if node_id in seen_ids:
            continue
        seen_ids.add(node_id)
        
        entity_type = node_data.get('type', 'unknown')
        entity_name = node_data.get('name', node_id)
        file_path = node_data.get('file_path', '')
        
        # Skip imports and resources (not useful for test repair)
        if entity_type in ['import', 'resource']:
            continue
        
        # CRITICAL: Skip entities without file paths (these are function CALLS, not definitions)
        # They pollute search results and don't provide useful context for repairs
        if not file_path or file_path.strip() == '':
            # Allow Repository and Commit types even without file path
            if entity_type not in ['Repository', 'Commit']:
                continue
            
        candidates.append({
            'entity_id': node_id,
            'entity_name': entity_name,
            'entity_type': entity_type,
            'file_path': file_path,
            'line_start': node_data.get('line_start', 0),
            'line_end': node_data.get('line_end', 0),
            'code_snippet': node_data.get('code', node_data.get('code_snippet', '')),
        })
    
    print(f"    Found {len(candidates)} unique entities to embed")
    
    # Count by type
    type_counts = {}
    for c in candidates:
        t = c['entity_type']
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"    Entity types: {type_counts}")
    
    # Delete existing table and recreate
    print("\n[3] Clearing existing LanceDB table...")
    table_name = "code_entity_embeddings"
    try:
        if table_name in lance_manager.db.table_names():
            lance_manager.db.drop_table(table_name)
            print(f"    Dropped existing table '{table_name}'")
    except Exception as e:
        print(f"    Warning: Could not drop table: {e}")
    
    # Generate embeddings for all entities
    print("\n[4] Generating embeddings...")
    vectors_to_store = []
    
    for i, candidate in enumerate(candidates):
        try:
            # Prepare text for embedding - combine name, type, and code
            text_parts = [
                candidate['entity_name'],
                f"({candidate['entity_type']})",
            ]
            if candidate.get('code_snippet'):
                text_parts.append(candidate['code_snippet'][:500])
            if candidate.get('file_path'):
                text_parts.append(f"in {candidate['file_path']}")
            
            text = " ".join(text_parts)
            
            # Generate embedding
            embedding = embedding_generator.generate_embedding(text)
            
            vectors_to_store.append({
                'entity_id': candidate['entity_id'],
                'entity_name': candidate['entity_name'],
                'entity_type': candidate['entity_type'],
                'file_path': candidate['file_path'],
                'line_start': candidate['line_start'],
                'line_end': candidate['line_end'],
                'embedding': embedding,
                'code_snippet': candidate.get('code_snippet', ''),
                'relevance_score': 0.0,
                'semantic_similarity': 0.0,
                'textual_similarity': 0.0,
            })
            
            if (i + 1) % 100 == 0:
                print(f"    Processed {i + 1}/{len(candidates)} entities...")
                
        except Exception as e:
            logger.warning(f"Failed to embed {candidate['entity_id']}: {e}")
            continue
    
    print(f"    Generated {len(vectors_to_store)} embeddings")
    
    # Store in LanceDB
    print("\n[5] Storing embeddings in LanceDB...")
    result = lance_manager.add_vectors(table_name, vectors_to_store)
    
    if result.get('success'):
        print(f"    SUCCESS: Stored {result.get('inserted', 0)} vectors")
    else:
        print(f"    ERROR: {result.get('error', 'Unknown error')}")
        return False
    
    # Verify
    print("\n[6] Verifying...")
    stats = lance_manager.get_stats(table_name)
    print(f"    Total vectors in LanceDB: {stats.get('row_count', 0)}")
    
    # Test search
    print("\n[7] Testing search...")
    test_queries = [
        "fuzzy match food parser",
        "normalize text",
        "parse portion",
        "FoodParser class"
    ]
    
    for query in test_queries:
        query_embedding = embedding_generator.generate_embedding(query)
        results = lance_manager.search_vectors(table_name, query_embedding, top_k=3)
        
        if results.get('success'):
            print(f"\n    Query: '{query}'")
            for r in results.get('results', [])[:3]:
                print(f"      - {r.get('entity_name')} ({r.get('entity_type')}) score: {r.get('score', 0):.4f}")
    
    print("\n" + "=" * 60)
    print(" Resync Complete!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = resync_embeddings()
    sys.exit(0 if success else 1)
