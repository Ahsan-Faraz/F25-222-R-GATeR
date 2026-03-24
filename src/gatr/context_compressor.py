"""
GATR Context Compressor
Implements the official GATR Context Compression Algorithm
Steps 2.1-2.6 of the GATR pipeline
"""

import logging
import math
import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

logger = logging.getLogger('gatr.context_compressor')


@dataclass
class CompressedEntity:
    """Compressed entity with hybrid score"""
    entity_id: str
    entity_name: str
    entity_type: str
    file_path: str
    combined_score: float
    kg_compass_score: float
    semantic_similarity: float
    compressed_snippet: str
    relationships: List[Dict] = field(default_factory=list)
    line_start: int = 0
    line_end: int = 0


@dataclass
class CompressedContext:
    """Final compressed context bundle"""
    top_entities: List[CompressedEntity]
    compressed_snippets: List[Dict]
    compressed_patterns: str
    compressed_paths: List[Dict]
    semantic_examples: List[Dict]
    error_summary: str
    api_deltas: List[Dict]


class ContextCompressor:
    """
    GATR Context Compression Algorithm Implementation
    Compresses raw RAG context into optimized bundle for test repair
    """
    
    # KGCompass weight for hybrid scoring
    KG_WEIGHT = 0.7
    SEMANTIC_WEIGHT = 0.3
    
    # Filtering thresholds
    MIN_COMBINED_SCORE = 0.15
    MAX_SNIPPET_LINES = 15
    MAX_PATH_HOPS = 3
    
    # Valid relationship types for filtering
    VALID_RELATIONSHIPS = {'TESTS', 'CALLS', 'IMPORTS', 'MENTIONS', 'MODIFIES', 'BELONGS_TO'}
    
    def __init__(self):
        self.logger = logging.getLogger('gatr.context_compressor')
    
    def compress_context(self, 
                         broken_test: Dict,
                         error_message: str,
                         raw_entities: List[Dict],
                         raw_snippets: List[Dict],
                         usage_examples: List[Dict],
                         graph_paths: List[Dict],
                         semantic_hits: List[Dict],
                         conventions: Dict) -> CompressedContext:
        """
        Execute the complete GATR context compression algorithm
        
        Args:
            broken_test: Information about the broken test
            error_message: Error message from test failure
            raw_entities: Raw graph entities from knowledge graph
            raw_snippets: Raw code snippets
            usage_examples: Raw usage examples
            graph_paths: Raw graph paths
            semantic_hits: Raw LanceDB semantic matches
            conventions: Project conventions
            
        Returns:
            CompressedContext: Compressed context bundle
        """
        self.logger.info("Starting GATR context compression")
        
        # Step 2.1: Hybrid Scoring
        scored_entities = self._step_hybrid_scoring(raw_entities, semantic_hits)
        
        # Step 2.2: Entity Filtering
        filtered_entities = self._step_entity_filtering(scored_entities, graph_paths)
        
        # Step 2.3: Snippet Compression
        compressed_snippets = self._step_snippet_compression(filtered_entities, raw_snippets)
        
        # Step 2.4: Test Pattern Compression
        compressed_patterns = self._step_test_pattern_compression(usage_examples, conventions)
        
        # Step 2.5: Reasoning Path Reduction
        compressed_paths = self._step_reasoning_path_reduction(graph_paths, filtered_entities)
        
        # Step 2.6: Final Compressed Context Assembly
        compressed_context = self._step_final_assembly(
            filtered_entities,
            compressed_snippets,
            compressed_patterns,
            compressed_paths,
            semantic_hits,
            error_message,
            broken_test
        )
        
        self.logger.info(f"Context compression complete: {len(compressed_context.top_entities)} entities")
        return compressed_context
    
    def _step_hybrid_scoring(self, 
                              raw_entities: List[Dict], 
                              semantic_hits: List[Dict]) -> List[Dict]:
        """
        Step 2.1: Hybrid Scoring
        combined_score = 0.7 * KGCompassScore + 0.3 * SemanticSimilarity
        """
        self.logger.debug("Step 2.1: Hybrid scoring")
        
        # Create semantic score lookup
        semantic_scores = {}
        for hit in semantic_hits:
            entity_id = hit.get('entity_id', '')
            if entity_id:
                semantic_scores[entity_id] = hit.get('score', hit.get('semantic_similarity', 0))
        
        scored_entities = []
        for entity in raw_entities:
            entity_id = entity.get('entity_id', entity.get('id', ''))
            
            # Get KGCompass score
            kg_score = entity.get('score', entity.get('total_score', entity.get('relevance_score', 0)))
            if isinstance(kg_score, str):
                try:
                    kg_score = float(kg_score)
                except:
                    kg_score = 0.0
            if not isinstance(kg_score, (int, float)) or math.isnan(kg_score) or math.isinf(kg_score):
                kg_score = 0.0
            
            # Get semantic similarity
            semantic_score = semantic_scores.get(entity_id, entity.get('semantic_similarity', 0))
            if isinstance(semantic_score, str):
                try:
                    semantic_score = float(semantic_score)
                except:
                    semantic_score = 0.0
            if not isinstance(semantic_score, (int, float)) or math.isnan(semantic_score) or math.isinf(semantic_score):
                semantic_score = 0.0
            
            # Calculate combined score
            combined_score = (self.KG_WEIGHT * kg_score) + (self.SEMANTIC_WEIGHT * semantic_score)
            
            scored_entity = {
                **entity,
                'combined_score': combined_score,
                'kg_compass_score': kg_score,
                'semantic_similarity': semantic_score
            }
            scored_entities.append(scored_entity)
        
        # Sort by combined score (descending)
        scored_entities.sort(key=lambda x: x.get('combined_score', 0), reverse=True)
        
        self.logger.debug(f"Scored {len(scored_entities)} entities")
        return scored_entities
    
    def _step_entity_filtering(self, 
                                scored_entities: List[Dict], 
                                graph_paths: List[Dict]) -> List[CompressedEntity]:
        """
        Step 2.2: Entity Filtering
        Remove entities with low scores, duplicates, disconnected nodes, dead code, doc-only nodes
        """
        self.logger.debug("Step 2.2: Entity filtering")
        
        # Build set of connected entities from graph paths
        connected_entities = set()
        for path in graph_paths:
            nodes = path.get('nodes', path.get('path', []))
            for node in nodes:
                if isinstance(node, dict):
                    connected_entities.add(node.get('id', ''))
                else:
                    connected_entities.add(str(node))
            
            # Also add relationships
            relationships = path.get('relationships', [])
            for rel in relationships:
                connected_entities.add(rel.get('source', ''))
                connected_entities.add(rel.get('target', ''))
        
        seen_ids = set()
        filtered = []
        
        for entity in scored_entities:
            entity_id = entity.get('entity_id', entity.get('id', ''))
            entity_type = entity.get('entity_type', entity.get('type', '')).lower()
            entity_name = entity.get('entity_name', entity.get('name', ''))
            combined_score = entity.get('combined_score', 0)
            
            # Filter: Score threshold
            if combined_score < self.MIN_COMBINED_SCORE:
                continue
            
            # Filter: Duplicates
            if entity_id in seen_ids:
                continue
            seen_ids.add(entity_id)
            
            # Filter: Documentation-only nodes
            if entity_type in ('docstring', 'comment', 'documentation'):
                continue
            
            # Filter: Dead code (entities with no connections - relaxed for top entities)
            if len(connected_entities) > 0 and entity_id not in connected_entities:
                # Allow top-scored entities even if not in paths
                if combined_score < 0.3:
                    continue
            
            # Create compressed entity
            compressed = CompressedEntity(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                file_path=entity.get('file_path', ''),
                combined_score=combined_score,
                kg_compass_score=entity.get('kg_compass_score', 0),
                semantic_similarity=entity.get('semantic_similarity', 0),
                compressed_snippet='',
                line_start=entity.get('line_start', 0),
                line_end=entity.get('line_end', 0)
            )
            filtered.append(compressed)
        
        self.logger.debug(f"Filtered to {len(filtered)} entities")
        return filtered
    
    def _step_snippet_compression(self, 
                                   entities: List[CompressedEntity], 
                                   raw_snippets: List[Dict]) -> List[Dict]:
        """
        Step 2.3: Snippet Compression
        Keep only lines related to signatures, logic, object creation
        Max 10-15 lines per snippet, strip comments/blanks/unused imports
        """
        self.logger.debug("Step 2.3: Snippet compression")
        
        # Build snippet lookup
        snippet_lookup = {}
        for snippet in raw_snippets:
            entity_id = snippet.get('entity_id', snippet.get('id', ''))
            if entity_id:
                snippet_lookup[entity_id] = snippet.get('code', snippet.get('code_snippet', ''))
        
        compressed_snippets = []
        
        for entity in entities:
            code = snippet_lookup.get(entity.entity_id, '')
            
            if not code:
                continue
            
            # Compress the snippet
            compressed_code = self._compress_code_snippet(code)
            entity.compressed_snippet = compressed_code
            
            compressed_snippets.append({
                'entity_id': entity.entity_id,
                'entity_name': entity.entity_name,
                'entity_type': entity.entity_type,
                'file_path': entity.file_path,
                'code': compressed_code,
                'score': entity.combined_score
            })
        
        return compressed_snippets
    
    def _compress_code_snippet(self, code: str) -> str:
        """Compress a code snippet to essential lines"""
        if not code:
            return ''
        
        lines = code.split('\n')
        compressed_lines = []
        
        for line in lines:
            stripped = line.strip()
            
            # Skip blank lines
            if not stripped:
                continue
            
            # Skip pure comment lines (but keep inline comments)
            if stripped.startswith('#') or stripped.startswith('//'):
                continue
            
            # Skip docstrings (simplified detection)
            if stripped.startswith('"""') or stripped.startswith("'''"):
                continue
            
            compressed_lines.append(line)
            
            # Limit to max lines
            if len(compressed_lines) >= self.MAX_SNIPPET_LINES:
                break
        
        return '\n'.join(compressed_lines)
    
    def _step_test_pattern_compression(self, 
                                        usage_examples: List[Dict], 
                                        conventions: Dict) -> str:
        """
        Step 2.4: Test Pattern Compression
        Infer dominant test style and summarize patterns
        """
        self.logger.debug("Step 2.4: Test pattern compression")
        
        patterns = []
        
        # Analyze test conventions
        setup_patterns = conventions.get('setup_patterns', [])
        if setup_patterns:
            patterns.append(f"Setup: {', '.join(setup_patterns[:3])}")
        
        teardown_patterns = conventions.get('teardown_patterns', [])
        if teardown_patterns:
            patterns.append(f"Teardown: {', '.join(teardown_patterns[:3])}")
        
        # Detect builder vs direct constructor usage
        builder_usage = 0
        direct_constructor = 0
        
        for example in usage_examples:
            code = example.get('code', '')
            if 'Builder' in code or '.builder()' in code or '.build()' in code:
                builder_usage += 1
            if ' = new ' in code or '()' in code:
                direct_constructor += 1
        
        if builder_usage > direct_constructor:
            patterns.append("Object creation: Builder pattern preferred")
        else:
            patterns.append("Object creation: Direct constructors")
        
        # Detect assertion format
        assertion_formats = conventions.get('assertion_format', 'standard')
        patterns.append(f"Assertions: {assertion_formats}")
        
        # Detect naming patterns
        naming = conventions.get('naming_pattern', 'camelCase')
        patterns.append(f"Naming: {naming}")
        
        # Utility methods
        utilities = conventions.get('utility_methods', [])
        if utilities:
            patterns.append(f"Utilities: {', '.join(utilities[:5])}")
        
        return '\n'.join(patterns[:10])  # Max 10 lines
    
    def _step_reasoning_path_reduction(self, 
                                        graph_paths: List[Dict], 
                                        entities: List[CompressedEntity]) -> List[Dict]:
        """
        Step 2.5: Reasoning Path Reduction
        Keep only shortest meaningful paths, max 3 hops, remove cycles
        """
        self.logger.debug("Step 2.5: Reasoning path reduction")
        
        entity_ids = {e.entity_id for e in entities}
        compressed_paths = []
        seen_paths = set()
        
        for path in graph_paths:
            nodes = path.get('nodes', path.get('path', []))
            
            # Skip if path too long
            if len(nodes) > self.MAX_PATH_HOPS + 1:
                continue
            
            # Build path key for deduplication
            node_ids = []
            for node in nodes:
                if isinstance(node, dict):
                    node_ids.append(node.get('id', ''))
                else:
                    node_ids.append(str(node))
            
            path_key = '->'.join(node_ids)
            
            # Skip duplicates
            if path_key in seen_paths:
                continue
            
            # Check for cycles
            if len(node_ids) != len(set(node_ids)):
                continue
            
            # Keep path if it connects to relevant entities
            if any(nid in entity_ids for nid in node_ids):
                seen_paths.add(path_key)
                
                compressed_paths.append({
                    'path': path_key,
                    'nodes': node_ids,
                    'length': len(nodes) - 1,
                    'relationship_types': path.get('relationship_types', [])
                })
        
        # Sort by path length
        compressed_paths.sort(key=lambda x: x['length'])
        
        return compressed_paths[:20]  # Limit to 20 paths
    
    def _step_final_assembly(self,
                              entities: List[CompressedEntity],
                              snippets: List[Dict],
                              patterns: str,
                              paths: List[Dict],
                              semantic_hits: List[Dict],
                              error_message: str,
                              broken_test: Dict) -> CompressedContext:
        """
        Step 2.6: Final Compressed Context Assembly
        """
        self.logger.debug("Step 2.6: Final assembly")
        
        # Extract API deltas from entities
        api_deltas = self._extract_api_deltas(entities, semantic_hits)
        
        # Compress error message
        error_summary = self._compress_error_message(error_message)
        
        # Take top semantic examples
        semantic_examples = []
        for hit in semantic_hits[:5]:
            semantic_examples.append({
                'entity_id': hit.get('entity_id', ''),
                'entity_name': hit.get('entity_name', ''),
                'score': hit.get('score', 0),
                'snippet': hit.get('code_snippet', '')[:200]
            })
        
        return CompressedContext(
            top_entities=entities[:20],  # Top 20 entities
            compressed_snippets=snippets[:15],  # Top 15 snippets
            compressed_patterns=patterns,
            compressed_paths=paths,
            semantic_examples=semantic_examples,
            error_summary=error_summary,
            api_deltas=api_deltas
        )
    
    def _extract_api_deltas(self, 
                            entities: List[CompressedEntity], 
                            semantic_hits: List[Dict]) -> List[Dict]:
        """Extract API changes/deltas from entities"""
        deltas = []
        
        # Group by entity type to detect API patterns
        type_groups = defaultdict(list)
        for entity in entities:
            type_groups[entity.entity_type].append(entity)
        
        # Look for potential API changes in method signatures
        for entity in entities:
            if entity.entity_type in ('function', 'method', 'class', 'interface', 'constructor'):
                # Extract signature info
                delta = {
                    'entity_id': entity.entity_id,
                    'entity_name': entity.entity_name,
                    'type': 'signature',
                    'file_path': entity.file_path
                }
                deltas.append(delta)
        
        return deltas[:10]  # Limit deltas
    
    def _compress_error_message(self, error_message: str) -> str:
        """Compress error message to essential information"""
        if not error_message:
            return ''
        
        lines = error_message.split('\n')
        essential_lines = []
        
        for line in lines[:20]:  # First 20 lines max
            stripped = line.strip()
            
            # Skip empty lines
            if not stripped:
                continue
            
            # Keep error type and message
            if 'Error' in stripped or 'Exception' in stripped:
                essential_lines.append(stripped)
            elif 'at ' in stripped and '(' in stripped:
                # Stack trace line - keep first few
                if len(essential_lines) < 10:
                    essential_lines.append(stripped)
            elif 'assert' in stripped.lower() or 'expected' in stripped.lower():
                essential_lines.append(stripped)
        
        return '\n'.join(essential_lines[:10])
