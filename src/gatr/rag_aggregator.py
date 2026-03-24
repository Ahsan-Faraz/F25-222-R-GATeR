"""
GATR RAG Aggregator
Implements RAG aggregation for test repair context
Steps 3.1-3.4 of the GATR pipeline
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
import re

from .context_compressor import CompressedContext, CompressedEntity

logger = logging.getLogger('gatr.rag_aggregator')


@dataclass
class EntityCluster:
    """Cluster of related entities"""
    cluster_id: str
    cluster_type: str  # 'class', 'method', 'api_lineage'
    entities: List[CompressedEntity]
    primary_entity: Optional[CompressedEntity] = None
    

@dataclass 
class APIDelta:
    """API change/delta between old and new usage"""
    entity_id: str
    entity_name: str
    delta_type: str  # 'param_change', 'type_change', 'factory_change', 'return_change', 'exception_change'
    old_pattern: str
    new_pattern: str
    confidence: float


@dataclass
class CanonicalUsage:
    """Canonical/correct usage pattern"""
    entity_name: str
    usage_pattern: str
    example_code: str
    confidence: float
    source: str  # 'snippet', 'example', 'similar_test', 'convention'


@dataclass
class RepairStrategy:
    """Test repair strategy"""
    strategy_type: str  # 'rewrite', 'modify_lines', 'replace_builders', 'update_validation', 'replace_assertions'
    target_entities: List[str]
    changes_required: List[Dict]
    confidence: float
    rationale: str


class RAGAggregator:
    """
    GATR RAG Aggregator
    Aggregates compressed context for test repair generation
    """
    
    def __init__(self):
        self.logger = logging.getLogger('gatr.rag_aggregator')
    
    def aggregate(self, compressed_context: CompressedContext) -> Dict:
        """
        Execute RAG aggregation on compressed context
        
        Args:
            compressed_context: Compressed context from ContextCompressor
            
        Returns:
            Dict containing aggregated information for repair generation
        """
        self.logger.info("Starting RAG aggregation")
        
        # Step 3.1: Entity Aggregation
        entity_clusters = self._step_entity_aggregation(compressed_context.top_entities)
        
        # Step 3.2: API Delta Extraction
        api_deltas = self._step_api_delta_extraction(
            compressed_context.top_entities,
            compressed_context.compressed_snippets,
            compressed_context.api_deltas
        )
        
        # Step 3.3: Canonical Usage Synthesis
        canonical_usages = self._step_canonical_usage_synthesis(
            compressed_context.compressed_snippets,
            compressed_context.semantic_examples,
            compressed_context.compressed_patterns
        )
        
        # Step 3.4: Test Repair Strategy Selection
        repair_strategy = self._step_repair_strategy_selection(
            compressed_context.error_summary,
            api_deltas,
            canonical_usages,
            entity_clusters
        )
        
        aggregated_result = {
            'entity_clusters': [self._cluster_to_dict(c) for c in entity_clusters],
            'api_deltas': [self._delta_to_dict(d) for d in api_deltas],
            'canonical_usages': [self._usage_to_dict(u) for u in canonical_usages],
            'repair_strategy': self._strategy_to_dict(repair_strategy),
            'compressed_context': {
                'top_entities_count': len(compressed_context.top_entities),
                'snippets_count': len(compressed_context.compressed_snippets),
                'paths_count': len(compressed_context.compressed_paths),
                'error_summary': compressed_context.error_summary,
                'patterns': compressed_context.compressed_patterns
            }
        }
        
        self.logger.info(f"RAG aggregation complete: {len(entity_clusters)} clusters, {len(api_deltas)} deltas")
        return aggregated_result
    
    def _step_entity_aggregation(self, entities: List[CompressedEntity]) -> List[EntityCluster]:
        """
        Step 3.1: Entity Aggregation
        Cluster entities by class, method, or API lineage
        """
        self.logger.debug("Step 3.1: Entity aggregation")
        
        clusters = []
        
        # Group by file path (class-level clustering)
        file_groups = defaultdict(list)
        for entity in entities:
            file_path = entity.file_path
            file_groups[file_path].append(entity)
        
        cluster_id = 0
        for file_path, file_entities in file_groups.items():
            if len(file_entities) == 0:
                continue
            
            # Create cluster for this file/class
            cluster = EntityCluster(
                cluster_id=f"cluster_{cluster_id}",
                cluster_type='class',
                entities=file_entities,
                primary_entity=max(file_entities, key=lambda e: e.combined_score)
            )
            clusters.append(cluster)
            cluster_id += 1
        
        # Also group by entity type (method-level clustering)
        type_groups = defaultdict(list)
        for entity in entities:
            type_groups[entity.entity_type].append(entity)
        
        for entity_type, type_entities in type_groups.items():
            if entity_type in ('function', 'method', 'class', 'interface', 'constructor') and len(type_entities) > 1:
                cluster = EntityCluster(
                    cluster_id=f"cluster_{cluster_id}",
                    cluster_type='method',
                    entities=type_entities,
                    primary_entity=max(type_entities, key=lambda e: e.combined_score)
                )
                clusters.append(cluster)
                cluster_id += 1
        
        return clusters
    
    def _step_api_delta_extraction(self,
                                    entities: List[CompressedEntity],
                                    snippets: List[Dict],
                                    raw_deltas: List[Dict]) -> List[APIDelta]:
        """
        Step 3.2: API Delta Extraction
        Diff old vs new usage patterns
        """
        self.logger.debug("Step 3.2: API delta extraction")
        
        deltas = []
        
        # Build snippet lookup
        snippet_lookup = {}
        for snippet in snippets:
            entity_id = snippet.get('entity_id', '')
            snippet_lookup[entity_id] = snippet.get('code', '')
        
        # Analyze each entity for potential API changes
        for entity in entities:
            code = snippet_lookup.get(entity.entity_id, entity.compressed_snippet)
            if not code:
                continue
            
            # Detect parameter changes
            param_patterns = self._detect_param_patterns(code)
            for pattern in param_patterns:
                delta = APIDelta(
                    entity_id=entity.entity_id,
                    entity_name=entity.entity_name,
                    delta_type='param_change',
                    old_pattern=pattern.get('old', ''),
                    new_pattern=pattern.get('new', code[:100]),
                    confidence=0.7
                )
                deltas.append(delta)
            
            # Detect factory/builder changes
            if 'builder' in code.lower() or 'factory' in code.lower():
                delta = APIDelta(
                    entity_id=entity.entity_id,
                    entity_name=entity.entity_name,
                    delta_type='factory_change',
                    old_pattern='',
                    new_pattern=self._extract_builder_pattern(code),
                    confidence=0.8
                )
                deltas.append(delta)
        
        return deltas[:15]  # Limit deltas
    
    def _detect_param_patterns(self, code: str) -> List[Dict]:
        """Detect parameter patterns in code"""
        patterns = []
        
        # Look for function definitions
        func_pattern = r'def\s+(\w+)\s*\((.*?)\)'
        matches = re.findall(func_pattern, code, re.DOTALL)
        
        for name, params in matches:
            patterns.append({
                'name': name,
                'params': params.strip(),
                'new': f"def {name}({params.strip()})"
            })
        
        return patterns
    
    def _extract_builder_pattern(self, code: str) -> str:
        """Extract builder/factory pattern from code"""
        lines = code.split('\n')
        builder_lines = []
        
        for line in lines:
            if 'builder' in line.lower() or 'factory' in line.lower() or '.build()' in line:
                builder_lines.append(line.strip())
        
        return '\n'.join(builder_lines[:5])
    
    def _step_canonical_usage_synthesis(self,
                                         snippets: List[Dict],
                                         examples: List[Dict],
                                         patterns: str) -> List[CanonicalUsage]:
        """
        Step 3.3: Canonical Usage Synthesis
        Reconstruct correct modern API usage
        """
        self.logger.debug("Step 3.3: Canonical usage synthesis")
        
        usages = []
        
        # From code snippets (highest confidence)
        for snippet in snippets[:10]:
            code = snippet.get('code', '')
            if code:
                usage = CanonicalUsage(
                    entity_name=snippet.get('entity_name', ''),
                    usage_pattern=self._infer_usage_pattern(code),
                    example_code=code[:200],
                    confidence=0.9,
                    source='snippet'
                )
                usages.append(usage)
        
        # From semantic examples
        for example in examples[:5]:
            snippet = example.get('snippet', '')
            if snippet:
                usage = CanonicalUsage(
                    entity_name=example.get('entity_name', ''),
                    usage_pattern=self._infer_usage_pattern(snippet),
                    example_code=snippet[:200],
                    confidence=0.7,
                    source='example'
                )
                usages.append(usage)
        
        # From patterns
        if patterns:
            usage = CanonicalUsage(
                entity_name='project_conventions',
                usage_pattern=patterns,
                example_code='',
                confidence=0.6,
                source='convention'
            )
            usages.append(usage)
        
        return usages
    
    def _infer_usage_pattern(self, code: str) -> str:
        """Infer usage pattern from code"""
        patterns = []
        
        # Detect assertion style
        if 'assert' in code:
            if 'assertEqual' in code or 'assertEquals' in code:
                patterns.append('assertion:assertEqual')
            elif 'assertTrue' in code:
                patterns.append('assertion:assertTrue')
            elif 'assertThat' in code:
                patterns.append('assertion:assertThat')
            else:
                patterns.append('assertion:assert')
        
        # Detect setup style
        if 'setUp' in code or 'setup' in code or '@Before' in code:
            patterns.append('setup:method')
        if '@pytest.fixture' in code:
            patterns.append('setup:fixture')
        
        # Detect object creation
        if '.builder()' in code or 'Builder' in code:
            patterns.append('creation:builder')
        elif ' = new ' in code or '()' in code:
            patterns.append('creation:constructor')
        
        return ', '.join(patterns) if patterns else 'unknown'
    
    def _step_repair_strategy_selection(self,
                                         error_summary: str,
                                         api_deltas: List[APIDelta],
                                         canonical_usages: List[CanonicalUsage],
                                         entity_clusters: List[EntityCluster]) -> RepairStrategy:
        """
        Step 3.4: Test Repair Strategy Selection
        Choose appropriate repair strategy
        """
        self.logger.debug("Step 3.4: Repair strategy selection")
        
        # Analyze error to determine strategy
        error_lower = error_summary.lower()
        
        strategy_type = 'modify_lines'
        confidence = 0.7
        rationale = 'Default: modify failing lines'
        target_entities = []
        changes = []
        
        # Check for specific error patterns
        if 'assertionerror' in error_lower or 'expected' in error_lower:
            strategy_type = 'update_validation'
            rationale = 'Assertion failure detected - update validation rules'
            confidence = 0.85
            
        elif 'attributeerror' in error_lower or 'no attribute' in error_lower:
            strategy_type = 'replace_builders'
            rationale = 'Attribute error - likely API change, replace builders/constructors'
            confidence = 0.8
            
        elif 'typeerror' in error_lower or 'type' in error_lower:
            strategy_type = 'modify_lines'
            rationale = 'Type error - modify parameter types in failing lines'
            confidence = 0.75
            
        elif 'importerror' in error_lower or 'modulenotfounderror' in error_lower:
            strategy_type = 'rewrite'
            rationale = 'Import error - may need to rewrite test structure'
            confidence = 0.7
            
        elif 'deprecat' in error_lower:
            strategy_type = 'replace_assertions'
            rationale = 'Deprecation - replace deprecated methods/assertions'
            confidence = 0.8
        
        # Add target entities from clusters
        for cluster in entity_clusters[:3]:
            if cluster.primary_entity:
                target_entities.append(cluster.primary_entity.entity_id)
        
        # Build changes from API deltas
        for delta in api_deltas[:5]:
            changes.append({
                'entity': delta.entity_name,
                'delta_type': delta.delta_type,
                'new_pattern': delta.new_pattern
            })
        
        return RepairStrategy(
            strategy_type=strategy_type,
            target_entities=target_entities,
            changes_required=changes,
            confidence=confidence,
            rationale=rationale
        )
    
    def _cluster_to_dict(self, cluster: EntityCluster) -> Dict:
        """Convert EntityCluster to dictionary"""
        return {
            'cluster_id': cluster.cluster_id,
            'cluster_type': cluster.cluster_type,
            'entity_count': len(cluster.entities),
            'primary_entity': cluster.primary_entity.entity_name if cluster.primary_entity else None,
            'entities': [{'id': e.entity_id, 'name': e.entity_name, 'score': e.combined_score} 
                        for e in cluster.entities]
        }
    
    def _delta_to_dict(self, delta: APIDelta) -> Dict:
        """Convert APIDelta to dictionary"""
        return {
            'entity_id': delta.entity_id,
            'entity_name': delta.entity_name,
            'delta_type': delta.delta_type,
            'old_pattern': delta.old_pattern,
            'new_pattern': delta.new_pattern,
            'confidence': delta.confidence
        }
    
    def _usage_to_dict(self, usage: CanonicalUsage) -> Dict:
        """Convert CanonicalUsage to dictionary"""
        return {
            'entity_name': usage.entity_name,
            'usage_pattern': usage.usage_pattern,
            'example_code': usage.example_code,
            'confidence': usage.confidence,
            'source': usage.source
        }
    
    def _strategy_to_dict(self, strategy: RepairStrategy) -> Dict:
        """Convert RepairStrategy to dictionary"""
        return {
            'strategy_type': strategy.strategy_type,
            'target_entities': strategy.target_entities,
            'changes_required': strategy.changes_required,
            'confidence': strategy.confidence,
            'rationale': strategy.rationale
        }
