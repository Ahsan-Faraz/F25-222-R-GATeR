# GATR Pipeline Complete Flow

**Last Updated**: 2026-04-05  
**Status**: All bugs fixed, pipeline operational

---

## Architecture Overview

### Data Sources

**Kuzu (Graph Database)**
- Purpose: Store entity RELATIONSHIPS
- Contains: CALLS, MODIFIES, TESTS, USES, RETURNS, THROWS relations
- Does NOT store: Code snippets (not designed for this)
- Query: Graph traversal to find connected entities

**LanceDB (Vector Database)**
- Purpose: Store entity CODE SNIPPETS with semantic embeddings
- Contains: Entity metadata + actual source code + embeddings
- Primary source: All code snippets in prompts
- Query: Semantic similarity search

**File System**
- Purpose: Fallback source for code extraction
- Used when: LanceDB doesn't have entity or snippet missing
- Extraction: Uses file_path + line_start + line_end

---

## Complete Pipeline Flow

### Phase 1: Repository Ingestion

```
1. Parse Repository
   ├─ Clone from GitHub
   ├─ Parse source files with tree-sitter
   └─ Extract file metadata

2. Extract Entities
   ├─ Parse AST for each file
   ├─ Extract: classes, methods, functions, fields
   ├─ Capture: name, type, file_path, line_start, line_end
   └─ Store entity metadata

3. Build Knowledge Graph (Kuzu)
   ├─ Add entities as nodes
   ├─ Extract relationships from AST
   ├─ Add edges: CALLS, MODIFIES, TESTS, etc.
   └─ Store in Kuzu database

4. Calculate Relevance Scores (KGCompass)
   ├─ For each entity, calculate:
   │  ├─ Semantic similarity (embeddings)
   │  ├─ Textual similarity (Levenshtein)
   │  ├─ Path length from issue
   │  └─ Path decay factor
   ├─ Combine: S(f) = β^l(f) * (α*cos + (1-α)*lev)
   └─ Rank entities by total score

5. Store in LanceDB (Bug 0 Fix)
   ├─ For each scored entity:
   │  ├─ Generate embedding
   │  ├─ Extract code snippet from file ✅ NEW
   │  │  └─ Read file_path[line_start:line_end]
   │  └─ Store: embedding + metadata + code_snippet
   └─ Result: LanceDB has actual code (90-100% coverage)
```

---

### Phase 2: Test Repair Request

When a broken test is submitted for repair:

```
GATR repair_test() receives:
├─ broken_test: {test_name, test_code, test_file, test_class}
├─ error_message: Stack trace and error details
└─ project_name: For saving results
```

---

### Phase 3: Raw Context Ingestion (Flow A)

**Step 1: Raw Context Ingestion**

```
_ingest_raw_context(broken_test, error_message)
│
├─ 1A. Vector Search (LanceDB) - DONE FIRST ✅
│   ├─ Build query from error + test code
│   ├─ Search LanceDB: search_similar_entities(query, top_k=20)
│   ├─ Get: entity_id, entity_name, code_snippet, semantic_score
│   ├─ Store in semantic_hits_map for cross-reference
│   └─ Add to raw_context['entities'] with source='vector'
│
├─ 1B. Knowledge Graph Search (Kuzu) - WITH CROSS-REFERENCE ✅
│   ├─ Get entities from Kuzu graph
│   ├─ Filter by type (method, function, class, etc.)
│   ├─ Score by keyword overlap with error
│   ├─ For each entity:
│   │   ├─ Try cross-reference with semantic_hits_map (by name/ID)
│   │   ├─ If not found, try targeted LanceDB lookup ✅ Bug 4 Fix
│   │   │   └─ search_similar_entities(entity_name, top_k=3)
│   │   ├─ If still not found, extract from file system
│   │   │   └─ _extract_local_snippet(file_path, line_start, line_end)
│   │   └─ Store snippet_source: lancedb_crossref | lancedb_targeted | file_fallback
│   └─ Add to raw_context['entities'] with source='kg_seed'
│
├─ 1C. KGCompass Relevance Scoring
│   ├─ Get candidate entities from Kuzu
│   ├─ Calculate relevance scores
│   ├─ For each scored entity:
│   │   └─ Extract code snippet from file system if missing
│   └─ Add to raw_context['entities'] with source='kgcompass'
│
└─ Result: raw_context with 3 entity sources
    ├─ vector: 20 entities, 100% snippet coverage
    ├─ kg_seed: 120 entities, 60-80% snippet coverage (Bug 4 fix)
    └─ kgcompass: 20 entities, 70-90% snippet coverage
```

---

### Phase 4: Context Compression (Flow A Continued)

**Step 2: Context Compression**

```
_compress_context(broken_test, error_message, raw_context)
│
├─ 2.1 Hybrid Scoring
│   ├─ For each entity:
│   │   ├─ combined_score = 0.4*kg_score + 0.6*semantic_score
│   │   └─ Add snippet_boost if has code_snippet
│   └─ Sort by combined_score (descending)
│
├─ 2.2 Entity Filtering ✅ Bug 1 & 2 Fixes
│   ├─ Filter by score threshold (>0.15)
│   ├─ Filter by type (remove docs, imports, etc.)
│   ├─ Filter by connectivity:
│   │   └─ Exempt vector/kgcompass entities ✅ Bug 1 Fix
│   ├─ Create CompressedEntity:
│   │   └─ compressed_snippet = entity.get('code_snippet', '') ✅ Bug 2 Fix
│   └─ Result: 20 top entities with snippets preserved
│
├─ 2.3 Snippet Compression ✅ Bug 2 Fix Part 2
│   ├─ For each entity:
│   │   ├─ code = entity.compressed_snippet OR snippet_lookup ✅ Check carried snippet first
│   │   ├─ If no code, try file system fallback
│   │   ├─ Compress: keep signatures, logic, assertions (max 15 lines)
│   │   └─ Store in compressed_snippets
│   └─ Result: 15-18 entities with compressed code (70-80% coverage)
│
├─ 2.4 Test Pattern Compression
│   ├─ Analyze usage examples
│   ├─ Detect: setup patterns, teardown, builder vs constructor
│   └─ Compress to text summary
│
├─ 2.5 Reasoning Path Reduction
│   ├─ Filter graph paths by relevance
│   ├─ Limit to max 3 hops
│   └─ Keep top 20 paths
│
└─ 2.6 Final Assembly
    └─ Return CompressedContext with:
        ├─ top_entities: 20 entities with compressed_snippet
        ├─ compressed_snippets: 15-18 code blocks
        ├─ compressed_patterns: Test patterns summary
        ├─ compressed_paths: 20 graph paths
        └─ error_summary: Parsed error info
```

---

### Phase 5: RAG Aggregation (Flow A Continued)

**Step 3: RAG Aggregation**

```
_aggregate_context(compressed_context)
│
├─ 3.1 Entity Aggregation
│   ├─ Cluster entities by file/class
│   └─ Identify entity relationships
│
├─ 3.2 API Delta Extraction
│   ├─ Detect API changes from error
│   └─ Find old → new patterns
│
├─ 3.3 Canonical Usage Synthesis
│   ├─ Extract usage patterns from snippets
│   └─ Identify correct API usage
│
└─ 3.4 Repair Strategy Selection
    ├─ Analyze error type
    ├─ Select strategy: method_rename, parameter_fix, etc.
    └─ Return aggregated_context with:
        ├─ entity_clusters
        ├─ api_deltas
        ├─ canonical_usages
        └─ repair_strategy
```

---

### Phase 6: GraphRAG Retrieval (Flow B)

**Step 7: GraphRAG Retrieve Context**

```
_graphrag_retrieve_context(broken_test, error_message)
│
├─ Multi-hop graph traversal in Kuzu
├─ Find entities connected to test
├─ Get relationships: CALLS, MODIFIES, TESTS
└─ Return retrieved_context with:
    ├─ entities: From Kuzu (NO code snippets)
    ├─ relationships: Graph edges
    └─ paths: Multi-hop paths
```

---

### Phase 7: GraphRAG Augmentation (Flow B Continued)

**Step 8: GraphRAG Augment Context**

```
_graphrag_augment_context(retrieved_context, broken_test)
│
├─ Add code snippets to Kuzu entities (reads from Kuzu node data)
├─ Add usage examples
├─ Add conventions
└─ Return augmented_context with:
    └─ entities: Kuzu entities (0% snippet coverage - Kuzu has no code)
```

---

### Phase 8: Pipeline Merge ✅ Bug 3 Fix

**Step 8.5: Merge Flow A and Flow B**

```
_generate_repair() receives:
├─ compressed_context (Flow A - has snippets)
├─ aggregated_context (Flow A - has api_deltas, canonical_usages)
└─ raw_context (Flow A - has snippet-rich entities) ✅ NEW

Merge Process:
│
├─ 1. Get augmented_context from Flow B
│      └─ Has Kuzu entities (no snippets)
│
├─ 2. Merge api_deltas and canonical_usages from Flow A
│      augmented_context['api_deltas'] = aggregated_context['api_deltas']
│      augmented_context['canonical_usages'] = aggregated_context['canonical_usages']
│
├─ 3. Merge snippet-rich entities from Flow A ✅ Bug 3 Fix
│      For each entity in raw_context['entities']:
│         If has code_snippet and not already in augmented_context:
│            Add to augmented_context['entities']
│
├─ 4. Merge KGCompass entities from compressed_context
│      _merge_kgcompass_entities(augmented_context, compressed_context)
│
└─ Result: augmented_context with entities from BOTH flows
    ├─ Flow A entities: 15-18 with code snippets ✅
    ├─ Flow B entities: Kuzu relations
    └─ Total: 20-30 entities, 60-70% with snippets
```

---

### Phase 9: Prompt Generation

**Step 9: Generate Prompt**

```
_create_graphrag_prompt(augmented_context, error_info)
│
├─ Priority 1: Core Context (Always Included)
│   ├─ Test information
│   ├─ Complete error message
│   ├─ Annotated broken test code (>>> markers)
│   ├─ Broken lines section
│   └─ Budget: ~2000-3000 chars
│
├─ Priority 2: Knowledge Graph Entities (60% of remaining)
│   ├─ Filter: _is_prompt_relevant_entity()
│   │   ├─ Remove noise (timeout, outputhtml, generic exceptions)
│   │   ├─ Keep: method, function, class, interface, constructor, test, field
│   │   └─ Require: semantic_score > 0 OR kg_score >= 0.25 OR keyword_overlap >= 0.2
│   ├─ Sort by combined_score (descending)
│   ├─ For each entity (up to token budget):
│   │   ├─ Add entity metadata (name, type, file, score)
│   │   ├─ Add code snippet (8 lines max)
│   │   └─ Mark if fallback extraction
│   └─ Budget: ~6900 chars (~10-12 entities)
│
├─ Priority 3: Entity Relations (50% of remaining)
│   ├─ Extract from Kuzu for top entities
│   ├─ Types: CALLS, MODIFIES, TESTS, USES, RETURNS, THROWS
│   ├─ Format: "User.set_name MODIFIES User.name"
│   └─ Budget: ~2300 chars (~10-15 relations)
│
├─ Priority 4: API Deltas (if space remains)
│   ├─ Old pattern → New pattern
│   └─ Budget: If >500 chars remain
│
├─ Priority 5: Canonical Usage Patterns (if space remains)
│   ├─ Correct usage examples
│   └─ Budget: If >500 chars remain
│
└─ Result: Prompt with rich context
    ├─ System message: ~200 chars
    ├─ User prompt: 2000-14000 chars
    ├─ Total: <3500 tokens (Qwen limit)
    ├─ Entities: 10-12 with code
    ├─ Relations: 10-15
    └─ Code blocks: 5+
```

---

### Phase 10: LLM Generation

**Step 9: Generate Fix**

```
_graphrag_generate_fix(augmented_context, error_info)
│
├─ Build final prompt
├─ Call LM Studio API
│   ├─ Model: Qwen 2.5 Coder 7B
│   ├─ Temperature: 0.1 (deterministic)
│   ├─ Max tokens: 4096
│   └─ Stop sequences: ["---END---", "\n\n\n"]
│
├─ Clean LLM output
│   ├─ Remove markdown code blocks
│   ├─ Remove preambles
│   └─ Extract pure code
│
└─ Return repaired_code
```

---

## Token Budget Management

### Configuration
- Max prompt tokens: 3500 (reserve 500 for output)
- Max prompt chars: 14000 (estimate: 1 token ≈ 4 chars)
- Model: Qwen 2.5 Coder 7B (4000 token context)

### Allocation
```
Core Context:        ~2500 chars (always)
Remaining:           ~11500 chars

Entity Budget:       60% = ~6900 chars
Relation Budget:     50% of remaining = ~2300 chars
API Delta Budget:    If >500 chars remain
Usage Budget:        If >500 chars remain
Task Section:        ~200 chars (always)
```

### Truncation Logic
1. Entities: Loop through sorted entities, estimate size, stop when budget exceeded
2. Relations: Loop through relations, estimate size, stop when budget exceeded
3. Usage: Add if space remains

---

## Logging & Debugging

### Key Log Markers

**Snippet Coverage**:
```
[SNIPPET_COVERAGE] Raw ingestion: X/Y (Z%) | by source: {vector: 100%, kg_seed: 70%, kgcompass: 80%}
[SNIPPET_COVERAGE] Compression: X/Y (Z%)
```

**Entity Flow**:
```
[ENTITY_FLOW] After compression: X entities, Y with compressed_snippet (Z%)
[ENTITY_MERGE] augmented_context now has N entities after merging raw_context
```

**Token Budget**:
```
[TOKEN_BUDGET] Including N/M entities (budget: X chars, used: Y chars)
[TOKEN_BUDGET] Including N/M relations (budget: X chars, used: Y chars)
```

**Snippet Sources**:
```
[KG_SEED_SNIPPET] Found snippet for X via LanceDB cross-reference (by name)
[KG_SEED_SNIPPET] Targeted lookup found snippet for X
[KG_SEED_SNIPPET] Extracted snippet for X from file system
```

---

## Success Criteria

### Snippet Coverage
- ✅ LanceDB: 90-100%
- ✅ Raw Ingestion: 70-80%
- ✅ After Compression: 60-70%
- ✅ In Prompt: 60-70%

### Entity Flow
- ✅ Raw entities: 160
- ✅ After filtering: 20
- ✅ With snippets: 15-18
- ✅ In prompt: 10-12

### Prompt Quality
- ✅ System message: >200 chars
- ✅ User prompt: 2000-14000 chars
- ✅ Entity section: Present with code blocks
- ✅ Relations section: 10-15 relations
- ✅ Token count: <3500 tokens
- ✅ Code blocks: >5

### Repair Quality
- ✅ LLM generates syntactically valid code
- ✅ Repair addresses error message
- ✅ Minimal changes (only broken lines)
- ✅ Compiles successfully

---

## Data Flow Summary

```
Repository
    ↓
[Parse & Extract]
    ↓
Entities (with line numbers)
    ↓
[Build KG] → Kuzu (relations only)
    ↓
[Calculate Relevance]
    ↓
[Extract Code Snippets] ✅ Bug 0 Fix
    ↓
LanceDB (embeddings + code)
    ↓
[Test Repair Request]
    ↓
┌─────────────────┬─────────────────┐
│    Flow A       │     Flow B      │
│  (Snippet-Rich) │  (Graph-Rich)   │
├─────────────────┼─────────────────┤
│ Vector Search   │ Graph Traversal │
│ KG Cross-Ref    │ Multi-hop Paths │
│ Targeted Lookup │ Relationships   │
│ File Fallback   │                 │
├─────────────────┼─────────────────┤
│ Compression     │ Augmentation    │
│ Aggregation     │                 │
└─────────────────┴─────────────────┘
           ↓
    [Merge] ✅ Bug 3 Fix
           ↓
  Augmented Context
  (Both flows combined)
           ↓
   [Build Prompt]
           ↓
   LLM (Qwen 2.5)
           ↓
   Repaired Code
```

---

## Conclusion

The GATR pipeline now correctly:
1. Stores actual code in LanceDB (Bug 0)
2. Preserves vector entities (Bug 1)
3. Carries snippets through compression (Bug 2)
4. Merges both pipelines (Bug 3)
5. Uses targeted lookup (Bug 4)

Result: Rich, code-heavy prompts for accurate test repairs.
