# GATR Workflow Documentation

**Last Updated**: April 7, 2026  
**Status**: Production Ready ✅

---

## Overview

GATR (Graph-Aware Test Repair) is an automated test repair system that uses knowledge graphs, vector embeddings, and LLM reasoning to fix broken tests. This document describes the complete workflow from repository analysis to test repair.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GATR PIPELINE FLOW                            │
└─────────────────────────────────────────────────────────────────┘

1. REPOSITORY ANALYSIS
   ├─ Clone repository
   ├─ Extract entities (classes, methods, functions)
   ├─ Build knowledge graph (Kuzu)
   └─ Extract code snippets → LanceDB
   
2. RAW CONTEXT INGESTION (Step 1)
   ├─ Vector search (LanceDB) → Semantic hits
   ├─ Knowledge graph (Kuzu) → kg_seed entities
   ├─ KGCompass scoring → Relevance scores
   └─ Merge all sources → raw_context
   
3. CONTEXT COMPRESSION (Steps 2.1-2.6)
   ├─ 2.1: Hybrid scoring (KGCompass + Semantic)
   ├─ 2.2: Entity filtering (remove noise)
   ├─ 2.3: Snippet compression (keep relevant lines)
   ├─ 2.4: Test pattern compression
   ├─ 2.5: Reasoning path reduction
   └─ 2.6: Final assembly (dynamic budgeting)
   
4. RAG AGGREGATION (Steps 3.1-3.4)
   ├─ 3.1: Entity clustering
   ├─ 3.2: API delta extraction
   ├─ 3.3: Canonical usage synthesis
   └─ 3.4: Repair strategy selection
   
5. REPAIR GENERATION (Step 4)
   ├─ GraphRAG Step 7: Retrieve context
   ├─ GraphRAG Step 8: Augment context
   ├─ GraphRAG Step 9: Generate fix (LLM)
   └─ Return repaired code
```

---

## Detailed Workflow

### Phase 1: Repository Analysis

**Purpose**: Extract entities and build knowledge graph

**Steps**:
1. Clone repository to `workspace/repos/`
2. Parse source files (Java, Python, etc.)
3. Extract entities:
   - Classes, interfaces, enums
   - Methods, functions, constructors
   - Fields, variables
   - Test methods
   - Imports, packages
4. Build relationships:
   - CALLS (method → method)
   - BELONGS_TO (method → class)
   - IMPORTS (file → package)
   - TESTS (test → method)
   - CREATES (method → class)
5. Store in Kuzu (metadata only, no code)
6. Extract code snippets and store in LanceDB with embeddings

**Output**:
- Kuzu database: `workspace/gater_knowledge_graph/`
- LanceDB: `workspace/lancedb/`
- Entities: ~5,000-10,000 per repository
- Snippet coverage: 100%

---

### Phase 2: Raw Context Ingestion (Step 1)

**Purpose**: Gather all relevant entities for the broken test

**Input**:
- Broken test code
- Error message
- Test metadata (file, class, method)

**Process**:

1. **AST-Based Query Formulation**:
   - Extract method calls from broken line
   - Extract literals and identifiers
   - Build semantic query (e.g., "selectFirst Element text")

2. **Vector Search (LanceDB)**:
   - Search for entities matching semantic query
   - Boost entities with exact method name matches
   - Return top 20 semantic hits with code snippets

3. **Knowledge Graph Traversal (Kuzu)**:
   - Get entities related to test (kg_seed)
   - Filter by entity type (function, class, method)
   - Score by keyword overlap with error
   - Return top 120 entities

4. **KGCompass Relevance Scoring**:
   - Score entities by graph connectivity
   - Consider semantic similarity
   - Return top 20 most relevant entities

5. **Cross-Reference for Snippets**:
   - kg_seed entities lookup snippets in LanceDB
   - Targeted search by entity name
   - Fallback to file system extraction

6. **Merge All Sources**:
   - Combine vector, kg_seed, and kgcompass entities
   - Deduplicate by entity ID
   - Preserve source tracking

**Output**:
- `raw_context` dictionary:
  - `entities`: ~150 entities (80% with snippets)
  - `snippets`: ~120 code snippets
  - `semantic_hits`: ~20 vector matches
  - `graph_paths`: ~185 relationships
  - `conventions`: Project patterns

**Metrics**:
- Entities found: 150-200
- Snippet coverage: 80%
- Processing time: 30-50s

---

### Phase 3: Context Compression (Steps 2.1-2.6)

**Purpose**: Compress raw context to fit LLM token budget

#### Step 2.1: Hybrid Scoring

**Formula**:
```
combined_score = (0.4 × KGCompass) + (0.6 × Semantic) + snippet_boost
snippet_boost = +0.1 if has_snippet else -0.05
```

**Output**: Scored entities sorted by relevance

#### Step 2.2: Entity Filtering

**Filters**:
- Score threshold: `combined_score >= 0.15`
- Remove duplicates by entity ID
- Remove documentation-only nodes
- Remove infrastructure nodes (repository, commit, import)
- Exempt vector/kgcompass entities from connectivity filter

**Output**: ~56 filtered entities

#### Step 2.3: Snippet Compression

**Process**:
1. Build snippet lookup from raw_snippets
2. For each entity:
   - Get snippet from entity.compressed_snippet
   - Fallback to snippet_lookup
   - Fallback to file system extraction
3. Compress snippet (keep signatures, logic, remove comments)
4. Limit to 15 lines per snippet

**Output**: ~42 compressed snippets

#### Step 2.4: Test Pattern Compression

**Detects**:
- Setup patterns (@Before, setUp, @pytest.fixture)
- Assertion format (assertThat, expect, assert)
- Naming conventions (camelCase, snake_case)

**Output**: Pattern string

#### Step 2.5: Reasoning Path Reduction

**Process**:
- Extract graph paths for top entities
- Limit to 20 paths
- Include relationship types (CALLS, BELONGS_TO, etc.)

**Output**: ~20 compressed paths

#### Step 2.6: Final Assembly (Smart Budgeting)

**Process**:
```python
# Smart Snippet Budgeting with three gates
MAX_SNIPPET_CHARS = 8000   # ~2k tokens (conservative for 4k models)
MAX_SNIPPET_COUNT = 20     # Hard cap to prevent attention dilution
MIN_RELEVANCE_SCORE = 0.25 # Quality gate to filter noise

snippets_to_include = []
current_chars = 0

for entity in entities:  # Iterate through scored entities
    snippet_text = getattr(entity, 'compressed_snippet', '')
    if not snippet_text:
        continue
    
    # Gate 1: Quality filtering
    if entity.combined_score < MIN_RELEVANCE_SCORE:
        continue  # Skip low-quality entities
    
    # Gate 2: Attention cap
    if len(snippets_to_include) >= MAX_SNIPPET_COUNT:
        break  # Prevent attention dilution
    
    # Gate 3: Budget limit
    if current_chars + len(snippet_text) <= MAX_SNIPPET_CHARS:
        snippets_to_include.append(snippet)
        current_chars += len(snippet_text)
    else:
        break  # Budget exhausted
```

**Three Gates Explained**:

1. **Quality Gate** (MIN_RELEVANCE_SCORE = 0.25):
   - Filters out low-relevance entities
   - Improves signal-to-noise ratio
   - Prevents noise from diluting context

2. **Attention Cap** (MAX_SNIPPET_COUNT = 20):
   - Prevents "needle in haystack" problem
   - LLMs have finite attention span
   - Too many snippets = diluted focus

3. **Budget Gate** (MAX_SNIPPET_CHARS = 8000):
   - Ensures safe token usage (~2k tokens)
   - Leaves room for test code, error, relations
   - Fits comfortably in 4k context models

**Output**:
- `CompressedContext`:
  - `top_entities`: 20 entities
  - `compressed_snippets`: ≤20 snippets, ≤8000 chars
  - `compressed_patterns`: Pattern string
  - `compressed_paths`: 20 paths
  - `error_summary`: Compressed error

**Metrics**:
- Snippet coverage: ~67% (quality-filtered)
- Budget used: ~7,600 / 8,000 chars
- Token estimate: ~1,900 tokens
- Low-quality filtered: ~10 entities

---

### Phase 4: RAG Aggregation (Steps 3.1-3.4)

**Purpose**: Aggregate context into actionable repair strategy

#### Step 3.1: Entity Clustering

**Process**:
- Group entities by file path
- Cluster by entity type
- Identify related entities

**Output**: ~9 clusters

#### Step 3.2: API Delta Extraction

**Detects**:
- Parameter changes
- Return type changes
- Method renames
- Factory pattern changes

**Output**: ~1 API delta

#### Step 3.3: Canonical Usage Synthesis

**Process**:
- Extract usage patterns from snippets
- Identify assertion patterns
- Find object creation patterns

**Output**: ~16 canonical usages

#### Step 3.4: Repair Strategy Selection

**Strategies**:
- `modify_lines`: Change specific lines
- `add_null_check`: Add null safety
- `update_api`: Update API usage
- `fix_assertion`: Fix assertion logic

**Output**: Selected strategy with confidence

---

### Phase 5: Repair Generation (Step 4)

**Purpose**: Generate repaired test code using LLM

#### GraphRAG Step 7: Retrieve Context

**Process**:
- Search LanceDB for additional context
- Filter by relevance to error
- Return top 30 entities

**Output**: Retrieved entities (may be 0 if compressed context sufficient)

#### GraphRAG Step 8: Augment Context

**Process**:
- Merge retrieved entities with compressed context
- Deduplicate entities
- Extract failing line from error
- Build final entity list

**Output**: Augmented context with ~135 entities

#### GraphRAG Step 9: Generate Fix

**Process**:
1. **Build Prompt**:
   - System message (repair instructions)
   - Test information (file, language, error)
   - Error message
   - Broken test code (annotated with >>> markers)
   - Entity section (top 12 entities with snippets)
   - Relations (15 relationships)
   - API deltas (if any)
   - Usage patterns (if space)

2. **Token Budget Management**:
   - Max prompt: 14,000 chars (~3,500 tokens)
   - Reserve 500 tokens for LLM output
   - Prioritize: test + error > entities > relations > patterns

3. **LLM Call**:
   - Model: deepseek-r1-0528-qwen3-8b (or configured)
   - Temperature: 0.1 (deterministic)
   - Max tokens: 2000
   - Timeout: 120s

4. **Parse Response**:
   - Extract repaired code
   - Validate syntax
   - Generate diff

**Output**:
- Repaired test code
- Diff patch
- Repair report (JSON)

**Metrics**:
- Prompt size: 7,670 chars (~1,917 tokens)
- Entities in prompt: 12 (100% with snippets)
- Relations: 15
- Processing time: 8-10s (LLM call)

---

## Key Features

### 1. Smart Snippet Budgeting

**Problem**: Need to balance context richness with attention management

**Solution**: Three-gate system for optimal snippet selection

**Implementation**:
```python
# Gate 1: Quality filtering (MIN_RELEVANCE_SCORE = 0.25)
# Gate 2: Attention cap (MAX_SNIPPET_COUNT = 20)
# Gate 3: Budget limit (MAX_SNIPPET_CHARS = 8000)
```

**Benefits**:
- Filters low-quality entities (score < 0.25)
- Prevents attention dilution (max 20 snippets)
- Safe token usage (~2k tokens for snippets)
- Better signal-to-noise ratio

### 2. Field Standardization

**Problem**: Inconsistent field names (code, code_snippet, compressed_snippet)

**Solution**: Fallback pattern handles all variants

**Benefits**:
- Backward compatible
- No data loss
- Clean API

### 3. Cross-Reference Lookup

**Problem**: kg_seed entities missing snippets

**Solution**: Targeted LanceDB lookup by entity name

**Benefits**:
- 100% snippet coverage in storage
- 80% coverage during ingestion
- 73% coverage at runtime

---

## Performance Metrics

### End-to-End Pipeline

**Input**: Broken test + error message  
**Output**: Repaired test code  
**Time**: 56-60 seconds

**Breakdown**:
- Step 1 (Ingestion): 48s
- Step 2 (Compression): 0.015s
- Step 3 (Aggregation): 0.0002s
- Step 4 (Generation): 8s

### Resource Usage

**Memory**:
- Kuzu: ~100 MB
- LanceDB: ~500 MB
- Python process: ~1 GB

**Disk**:
- Kuzu database: ~50 MB
- LanceDB: ~200 MB
- Repository: ~10-50 MB

---

## Configuration

### Environment Variables

```bash
# LLM Configuration
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=deepseek/deepseek-r1-0528-qwen3-8b
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_REQUEST_TIMEOUT_S=120

# Database Paths
LANCEDB_PATH=workspace/lancedb
KUZU_DB_PATH=workspace/gater_knowledge_graph

# Snippet Budgeting
GATR_MAX_SNIPPETS=40000  # Character limit for snippets

# Fallback Mode
GATR_DISABLE_FALLBACK=true  # Disable deterministic fallbacks
```

### Tuning Parameters

**Context Compression** (`src/gatr/context_compressor.py`):
```python
KG_WEIGHT = 0.4              # KGCompass weight in hybrid scoring
SEMANTIC_WEIGHT = 0.6        # Semantic weight in hybrid scoring
MIN_COMBINED_SCORE = 0.15    # Minimum score threshold
MAX_SNIPPET_LINES = 15       # Max lines per snippet

# Smart Budgeting (Step 2.6)
MAX_SNIPPET_CHARS = 8000     # Max total chars for snippets (~2k tokens)
MAX_SNIPPET_COUNT = 20       # Max snippet count (attention management)
MIN_RELEVANCE_SCORE = 0.25   # Quality threshold (noise filtering)
```

**Prompt Building** (`src/gatr/gatr_engine.py`):
```python
MAX_PROMPT_TOKENS = 3500     # Max tokens for prompt
MAX_PROMPT_CHARS = 14000     # Max chars for prompt (~3500 tokens)
```

---

## Troubleshooting

### Low Snippet Coverage

**Symptom**: Repair quality poor, logs show <50% snippet coverage

**Diagnosis**:
```bash
python scripts/audit_vector_db_snippets.py
```

**Solutions**:
1. Check LanceDB coverage (should be 100%)
2. Check ingestion logs for snippet extraction
3. Verify repository path is correct
4. Re-analyze repository if needed

### LLM Timeout

**Symptom**: Repair fails with timeout error

**Solutions**:
1. Increase `LM_STUDIO_REQUEST_TIMEOUT_S`
2. Check LLM server is running
3. Reduce prompt size (lower `MAX_SNIPPET_CHARS`)

### Poor Repair Quality

**Symptom**: Generated code is incorrect or unchanged

**Diagnosis**:
- Check snippet coverage in logs
- Check entity relevance scores
- Review prompt content in report JSON

**Solutions**:
1. Ensure snippet coverage >60%
2. Verify error message is clear
3. Check LLM model quality
4. Review entity filtering thresholds

---

## Best Practices

### For Users

1. **Provide Clear Error Messages**: Include full stack trace
2. **Use Descriptive Test Names**: Helps entity matching
3. **Keep Tests Focused**: Single responsibility per test
4. **Review Generated Repairs**: Always validate before committing

### For Developers

1. **Monitor Snippet Coverage**: Should be >60% at runtime
2. **Log Extensively**: Use structured logging for debugging
3. **Test with Real Repositories**: Synthetic tests miss edge cases
4. **Profile Performance**: Identify bottlenecks early

---

## Future Enhancements

1. **Smarter Snippet Compression**: AST-based line selection
2. **Caching**: Cache extracted snippets by file hash
3. **Frontend Metrics**: Display snippet coverage in UI
4. **Multi-Language Support**: Expand beyond Java/Python
5. **Incremental Updates**: Update only changed entities

---

**For questions or issues, see KNOWN_ISSUES.md or PIPELINE_STATUS_REPORT.md**
