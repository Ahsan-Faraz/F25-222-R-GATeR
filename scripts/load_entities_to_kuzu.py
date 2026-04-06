"""
Load entities from JSONL files into Kuzu database
"""

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import logging
from src.kuzu_manager import KuzuManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_entities_from_jsonl(file_path):
    """Load entities from JSONL file"""
    entities = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                entities.append(json.loads(line))
    return entities


def load_relationships_from_jsonl(file_path):
    """Load relationships from JSONL file"""
    relationships = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                relationships.append(json.loads(line))
    return relationships


def main():
    logger.info("="*80)
    logger.info("LOADING ENTITIES INTO KUZU")
    logger.info("="*80)
    
    # Initialize Kuzu
    kg_path = "workspace/gater_knowledge_graph"
    kg_manager = KuzuManager(kg_path)
    
    if not kg_manager.connect():
        logger.error("Failed to connect to Kuzu")
        return 1
    
    logger.info("Connected to Kuzu")
    
    # Load entities
    entities_file = Path("workspace/data/entities.jsonl")
    if not entities_file.exists():
        logger.error(f"Entities file not found: {entities_file}")
        return 1
    
    logger.info(f"Loading entities from {entities_file}...")
    entities = load_entities_from_jsonl(entities_file)
    logger.info(f"Loaded {len(entities)} entities")
    
    # Insert entities
    logger.info("Inserting entities into Kuzu...")
    inserted, failed = kg_manager.insert_entities(entities, batch_size=1000)
    logger.info(f"Inserted: {inserted}, Failed: {failed}")
    
    # Load relationships
    kg_file = Path("workspace/data/knowledge_graph.jsonl")
    if kg_file.exists():
        logger.info(f"Loading relationships from {kg_file}...")
        relationships = load_relationships_from_jsonl(kg_file)
        logger.info(f"Loaded {len(relationships)} relationships")
        
        # Insert relationships
        logger.info("Inserting relationships into Kuzu...")
        rel_inserted = kg_manager.insert_relationships(relationships)
        logger.info(f"Inserted {rel_inserted} relationships")
    
    # Get stats
    stats = kg_manager.get_stats()
    logger.info("\n" + "="*80)
    logger.info("KUZU DATABASE STATS")
    logger.info("="*80)
    logger.info(f"Total nodes: {stats.get('total_nodes', 0)}")
    logger.info(f"Total relationships: {stats.get('total_relationships', 0)}")
    
    logger.info("\n[SUCCESS] Entities loaded into Kuzu successfully!")
    return 0


if __name__ == '__main__':
    sys.exit(main())
