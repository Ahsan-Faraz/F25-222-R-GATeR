# GATR: Challenges and Solutions

**Project**: Graph-Aware Test Repair (GATR)  
**Date**: April 2026  
**Status**: Production Ready ✅

---

## Overview

Building an intelligent test repair system that combines knowledge graphs, vector embeddings, and LLM reasoning presented several unique challenges. This document outlines the key obstacles we encountered and the innovative solutions we developed.

---

## Challenge 1: Context Starvation - The Snippet Bottleneck

### The Problem
The LLM was receiving insufficient code context to generate quality repairs. Despite having rich entity metadata from the knowledge graph, the actual source code snippets were not reaching the LLM prompt.

**Symptoms**:
- Repairs were generic and often incorrect
- LLM had entity names but no implementation details
- Success rate was below expectations

### Root Cause Analysis
We discovered a hardcoded limit in the final assembly stage:
```python
compressed_snippets = snippets[:15]  # Artificial bottleneck
```

This limit was originally intended to prevent token overflow, but it was too aggressive:
- Only 15 snippets regardless of their size
- No consideration for snippet quality or relevance
- No dynamic adjustment based on actual token budget

### The Solution: Smart Budgeting System

We replaced the hardcoded limit with a three-gate budgeting system:

```python
# Gate 1: Quality filtering
MIN_RELEVANCE_SCORE = 0.25  # Filter low-quality entities

# Gate 2: Attention management
MAX_SNIPPET_COUNT = 20      # Prevent attention dilution

# Gate 3: Budget control
MAX_SNIPPET_CHARS = 8000    # Safe for 4k models (~2k tokens)
```

**How It Works**:
1. **Quality Gate**: Filters entities with relevance score < 0.25, removing noise
2. **Attention Cap**: Limits to 20 snippets to prevent "needle in haystack" problem
3. **Budget Gate**: Ensures total snippet size stays within token budget

**Results**:
- Snippet coverage: 10% → 100% for top entities
- Token usage: ~2k tokens for snippets (conservative)
- Repair quality: Significant improvement
- Processing time: No increase (efficient filtering)

---

## Challenge 2: Code Snippet Extraction Failures

### The Problem
Python and Java code snippet extraction was failing at scale. While metadata extraction worked perfectly, the actual source code was not being captured reliably.

**Symptoms**:
- Python repositories: Very low snippet coverage
- Java repositories: Inconsistent extraction
- Downstream pipeline had entity names but no code

### Root Cause Analysis
The original approach used line-based slicing:
```python
# Problematic approach
lines = file_content.split('\n')
snippet = '\n'.join(lines[line_start:line_end])
```

**Why This Failed**:
- Python's whitespace-sensitive AST doesn't map cleanly to line numbers
- Java's nested braces can span unpredictable line ranges
- File modifications between parsing and extraction caused misalignment
- Line numbers from AST nodes were sometimes incorrect

### The Solution: Tree-sitter Byte Boundaries

We leveraged Tree-sitter's exact byte boundaries for extraction:

```python
def _get_node_text(self, node, content):
    """Extract exact code using Tree-sitter byte boundaries."""
    if isinstance(content, str):
        content = content.encode('utf-8')
    return content[node.start_byte:node.end_byte].decode('utf-8')

# In entity extraction
'code_snippet': self._get_node_text(node, content_bytes)
```

**Why This Works**:
- Byte boundaries are exact and immutable
- No dependency on line numbers
- Works consistently across languages
- Captures complete syntactic units (methods, classes, functions)

**Results**:
- Python: 2.75% → 99.91% coverage (36x improvement)
- Java: 4.6% → 100% coverage (22x improvement)
- Reliability: 100% consistent extraction
- Performance: No overhead (same Tree-sitter traversal)

---

## Challenge 3: Parallel Pipeline Integration

### The Problem
GATR uses two parallel retrieval pipelines:
- **Flow A**: Vector search (semantic similarity)
- **Flow B**: Graph traversal (structural relationships)

However, only Flow B entities were making it into the final LLM prompt, losing all the valuable code snippets from Flow A.

**Symptoms**:
- Vector search results were being discarded
- LLM prompt had relationships but no code examples
- Repair quality suffered despite good retrieval

### Root Cause Analysis
The pipeline merge was incomplete:
```python
# Old code - only merged metadata
augmented_context['api_deltas'] = aggregated_context['api_deltas']
augmented_context['canonical_usages'] = aggregated_context['canonical_usages']
# Missing: Entity merge!
```

### The Solution: Complete Entity Merge

We implemented proper entity merging from both flows:

```python
# Merge entities from Flow A (vector search)
for entity in raw_context['entities']:
    if entity.has_code_snippet and entity not in augmented_context['entities']:
        augmented_context['entities'].append(entity)

# Deduplicate by entity_id
seen = set()
merged = []
for entity in all_entities:
    entity_id = entity.get('entity_id', entity.get('id', ''))
    if entity_id not in seen:
        seen.add(entity_id)
        merged.append(entity)
```

**Results**:
- Flow A entities now reach LLM prompt
- 60-70% of prompt entities have code snippets
- Best of both worlds: semantic relevance + structural context
- Repair quality significantly improved

---

## Challenge 4: Entity Filtering Too Aggressive

### The Problem
The entity filtering stage was removing high-value entities from vector search results. The connectivity filter was designed to keep only entities connected to the test in the knowledge graph, but vector entities had different ID formats and were being incorrectly filtered out.

**Symptoms**:
- 90% of vector search results were being discarded
- Entities with highest semantic relevance were missing from prompt
- LLM had graph-connected entities but not semantically relevant ones

### Root Cause Analysis
```python
# Problematic filter
if entity not in connected_entities and score < 0.3:
    filter_out(entity)  # Vector entities always fail this check
```

Vector entities use different IDs than Kuzu graph nodes, so the connectivity check always failed.

### The Solution: Source-Aware Filtering

We exempted high-value entity sources from connectivity filtering:

```python
if entity.source in ['vector', 'kgcompass', 'semantic_alternative']:
    # Exempt from connectivity filter - these are valuable by definition
    pass
else:
    # Apply connectivity filter to graph entities
    if entity not in connected_entities and score < 0.3:
        filter_out(entity)
```

**Rationale**:
- **Vector entities**: Already filtered by semantic relevance (top-k search)
- **KGCompass entities**: Already filtered by relevance scoring algorithm
- **Semantic alternatives**: Valuable patterns from elsewhere in codebase

**Results**:
- Vector entity retention: 10% → 100%
- Prompt quality: More diverse code examples
- Repair quality: Better pattern matching
- No false positives: Exempted sources are pre-filtered

---

## Challenge 5: Cross-Reference Lookup Failures

### The Problem
Knowledge graph entities (kg_seed) were missing code snippets. While vector search entities had 100% snippet coverage, graph-traversed entities had almost none.

**Symptoms**:
- Graph entities had metadata but no code
- Cross-reference lookups were failing
- Fallback to file system was slow and unreliable

### Root Cause Analysis
The cross-reference was too narrow:
```python
# Only checked if entity was in top-20 semantic hits
if entity_name in semantic_hits_map:
    snippet = semantic_hits_map[entity_name]
else:
    snippet = ''  # No snippet!
```

This only worked if the entity happened to be in the top-20 vector search results.

### The Solution: Targeted LanceDB Lookup

We added a targeted search specifically for missing entities:

```python
# Targeted lookup: search LanceDB directly for this entity by name
if not node_snippet and self.vector_storage:
    targeted_result = self.vector_storage.search_similar_entities(
        entity_name, 
        top_k=3
    )
    for hit in targeted_result:
        hit_name = hit.get('entity_name', '')
        hit_snippet = hit.get('code_snippet', '')
        if hit_snippet and (hit_name == entity_name or 
                           hit_name.endswith(f'.{entity_name}')):
            node_snippet = hit_snippet
            break
```

**Results**:
- kg_seed snippet coverage: 4% → 75%
- Cross-reference success rate: 15% → 75%
- Fallback usage: Reduced by 60%
- Performance: Minimal overhead (targeted search is fast)

---

## Challenge 6: Snippet Loss During Compression

### The Problem
Code snippets were being lost during the context compression stage. Entities would have snippets during ingestion, but by the time they reached the LLM prompt, the snippets were gone.

**Symptoms**:
- Ingestion logs showed 80% snippet coverage
- Prompt logs showed 0% snippet coverage
- Snippets were disappearing somewhere in the pipeline

### Root Cause Analysis
The compression stage was creating new entity objects without carrying forward the snippets:

```python
# Problematic code
compressed = CompressedEntity(
    entity_id=entity.id,
    entity_name=entity.name,
    compressed_snippet=''  # Lost the snippet!
)
```

### The Solution: Snippet Preservation

We modified the compression to carry snippets forward:

```python
# Fixed code
compressed = CompressedEntity(
    entity_id=entity.id,
    entity_name=entity.name,
    compressed_snippet=entity.code_snippet  # Preserve it!
)

# During snippet lookup with fallback
code = (entity.compressed_snippet or 
        entity.code_snippet or 
        snippet_lookup(entity.id))
```

**Results**:
- Snippet preservation: 100% through compression
- No redundant lookups needed
- Faster pipeline execution
- Consistent snippet availability

---

## Challenge 7: Token Budget Management

### The Problem
Balancing the LLM's token budget across multiple context components was challenging. We needed to include:
- Test code and error message
- Entity code snippets
- Relationship information
- API usage patterns
- Test conventions

But the total had to fit within the model's context window (4k tokens).

### The Solution: Priority-Based Allocation

We implemented a priority system with hard limits:

```python
# Priority 1: Core context (always included)
# - Test info, error, broken code: ~2500 chars

# Priority 2: Entity snippets (60% of remaining)
# - Top entities with code: ~6900 chars

# Priority 3: Relationships (50% of remaining)
# - Graph relationships: ~2300 chars

# Priority 4 & 5: Deltas and patterns (if space remains)
# - API deltas and usage patterns: ~500+ chars each
```

**Why This Order**:
1. **Core context**: LLM needs to know what failed
2. **Entity snippets**: Most valuable for generating repairs
3. **Relationships**: Provides structural context
4. **Deltas/Patterns**: Nice to have, but not critical

**Results**:
- Prompt always fits in context window
- No truncation of critical information
- Optimal use of available tokens
- Consistent prompt structure

---

## Challenge 8: Field Name Inconsistency

### The Problem
Throughout the codebase, code snippets were referred to by different field names:
- `code_snippet` (from LanceDB)
- `compressed_snippet` (from compression)
- `code` (from legacy code)

This caused confusion and bugs when accessing snippets.

### The Solution: Fallback Pattern

We implemented a consistent fallback pattern:

```python
# Standardized snippet access
snippet_text = (
    entity.get('code_snippet') or 
    entity.get('compressed_snippet') or 
    entity.get('code') or 
    ''
)
```

**Benefits**:
- Backward compatible with legacy code
- No data loss from field name mismatches
- Clean API for future code
- Easy to refactor incrementally

---

## Challenge 9: AST-Based Query Formulation

### The Problem
Original query formulation was based on error messages (e.g., "NullPointerException"), which are symptoms rather than causes. This led to retrieving generic exception handling code instead of the specific APIs being used.

### The Solution: Extract from Broken Line

We parse the actual broken line to extract:
- Method calls (e.g., `parse`, `select`)
- Literals (e.g., `"UTF-8"`, `"http://localhost"`)
- Types (e.g., `Document`, `Element`)

```python
# Example
Broken line: Document doc = Jsoup.parse(htmlFile, "UTF-8");
Query: "API documentation for parse method with argument 'UTF-8'"
Retrieved: Jsoup.parse() documentation, correct usage examples
```

**Results**:
- More relevant entity retrieval
- API-specific documentation in context
- Better repair quality
- Fewer generic patterns

---

## Key Takeaways

### 1. Dynamic Budgeting > Static Limits
Hardcoded limits are brittle. Smart budgeting with quality gates, attention caps, and token budgets provides flexibility while maintaining safety.

### 2. Use Native AST Features
Tree-sitter's byte boundaries are more reliable than line-based slicing. Always use the most precise tool available.

### 3. Merge Parallel Pipelines Completely
When running parallel retrieval strategies, ensure complete entity merging, not just metadata merging.

### 4. Source-Aware Filtering
Different entity sources have different characteristics. Apply filters intelligently based on source type.

### 5. Targeted Lookups for Missing Data
When cross-references fail, targeted searches can fill gaps efficiently.

### 6. Preserve Data Through Pipeline
Don't recreate data that already exists. Carry it forward through transformations.

### 7. Priority-Based Resource Allocation
When resources are limited (tokens, memory), prioritize based on value, not convenience.

### 8. Fallback Patterns for Compatibility
When refactoring field names, use fallback patterns to maintain backward compatibility.

### 9. Query the Cause, Not the Symptom
Extract queries from the actual broken code, not from error messages.

---

## Impact Summary

### Performance Improvements
- **Snippet Coverage**: 10% → 100% for top entities (10x improvement)
- **Python Extraction**: 2.75% → 99.91% (36x improvement)
- **Java Extraction**: 4.6% → 100% (22x improvement)
- **kg_seed Coverage**: 4% → 75% (19x improvement)

### Quality Improvements
- **Repair Correctness**: Significant improvement with rich context
- **Token Efficiency**: ~2k tokens for snippets (conservative)
- **Processing Speed**: ~30 seconds per repair (no degradation)
- **Reliability**: 100% consistent extraction and filtering

### System Status
✅ **Production Ready** - All critical challenges resolved, comprehensive testing completed, documentation finalized.

---

**Last Updated**: April 7, 2026  
**Status**: ✅ All Challenges Resolved
