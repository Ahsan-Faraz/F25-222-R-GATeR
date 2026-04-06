# GATR Known Issues & Fixes

**Last Updated**: 2026-04-05  
**Status**: All critical bugs FIXED

---

## Critical Bugs (ALL FIXED ✅)

### Bug 0: LanceDB Missing Code Snippets (ROOT CAUSE)

**Status**: ✅ FIXED  
**Severity**: CRITICAL  
**Impact**: 0% snippet coverage in LanceDB

**Problem**:
- LanceDB stored entity metadata (name, type, file_path) but NOT actual code
- `code_snippet` field contained prepared text like "MyClass method /path/to/file.java"
- No actual source code was extracted from files during ingestion

**Root Cause**:
```python
# WRONG - stored metadata text, not code
'code_snippet': entity_text[:500]
```

**Fix Applied**:
- Added `_extract_code_snippet()` method in `step5_relevance_scoring.py`
- Extracts actual source code from files using file_path + line_start + line_end
- Added `line_start` and `line_end` fields to `RelevanceScore` dataclass
- Updated all RelevanceScore constructors to populate line numbers

**Files Modified**:
- `src/relevance/step5_relevance_scoring.py` (~60 lines)
- `src/relevance/relevance_scorer.py` (~10 lines)

**Expected Result**: 90-100% LanceDB entities have code snippets

---

### Bug 1: Vector Entities Filtered Out on Connectivity

**Status**: ✅ FIXED  
**Severity**: HIGH  
**Impact**: Vector entities (100% snippet coverage) dropped before compression

**Problem**:
- Vector entities from LanceDB don't have graph node IDs
- Connectivity filter checked if entity_id in connected_entities
- Vector entities always failed this check and were dropped if score < 0.3

**Root Cause**:
```python
# Dropped vector entities that weren't in graph paths
if len(connected_entities) > 0 and entity_id not in connected_entities:
    if combined_score < 0.3:
        continue
```

**Fix Applied**:
```python
# Exempt vector/kgcompass entities from connectivity filter
if len(connected_entities) > 0 and entity_id not in connected_entities:
    source = entity.get('source', '')
    if source not in ('vector', 'kgcompass', 'semantic_alternative') and combined_score < 0.3:
        continue
```

**Files Modified**:
- `src/gatr/context_compressor.py:347-351`

**Expected Result**: Vector entities preserved through filtering

---

### Bug 2: Ingestion Snippets Discarded at CompressedEntity Creation

**Status**: ✅ FIXED  
**Severity**: HIGH  
**Impact**: Snippets lost during compression, forcing failed snippet_lookup

**Problem**:
- `code_snippet` populated during ingestion was not carried to `CompressedEntity`
- `compressed_snippet` always initialized to empty string
- Forced reliance on `snippet_lookup` which often failed for kg_seed entities

**Root Cause**:
```python
# Discarded ingestion snippet
compressed_snippet='',
```

**Fix Applied (Part 1)**:
```python
# Carry forward ingestion snippet
compressed_snippet=entity.get('code_snippet', ''),
```

**Fix Applied (Part 2)**:
```python
# Check carried snippet FIRST before lookup
code = entity.compressed_snippet or snippet_lookup.get(entity.entity_id, '') or snippet_lookup.get(str(entity.entity_id), '')
```

**Files Modified**:
- `src/gatr/context_compressor.py:361, 428`

**Expected Result**: Entities with pre-populated snippets retain code through compression

---

### Bug 3: Two Parallel Pipelines Never Merge

**Status**: ✅ FIXED  
**Severity**: CRITICAL  
**Impact**: Prompt built from snippet-less entities only

**Problem**:
- **Flow A**: `_ingest_raw_context` → `_compress_context` → `_aggregate_context`
  - Has snippet-rich entities from LanceDB cross-reference
- **Flow B**: `_graphrag_retrieve_context` → `_graphrag_augment_context`
  - Has Kuzu entities with NO snippets (Kuzu stores relations only)
- Prompt built from Flow B only, ignoring Flow A's snippet-rich entities

**Root Cause**:
- Only `api_deltas` and `canonical_usages` merged from Flow A
- Entities from Flow A completely ignored

**Fix Applied**:
```python
# After api_deltas and canonical_usages merge, add entity merge
for raw_ent in raw_context.get('entities', []):
    eid = raw_ent.get('entity_id', '')
    if not eid or eid in existing_entity_ids:
        continue
    snippet = raw_ent.get('code_snippet', '')
    if not snippet:
        continue  # Only merge entities with code
    augmented_context['entities'].append({
        'id': eid,
        'name': raw_ent.get('entity_name', ''),
        'type': raw_ent.get('entity_type', 'unknown'),
        'file_path': raw_ent.get('file_path', ''),
        'score': float(raw_ent.get('relevance_score', raw_ent.get('score', 0.0)) or 0.0),
        'code_snippet': snippet,
        'source': raw_ent.get('source', 'raw'),
        'relationship': 'ingestion_crossref',
        'docstring': '',
        'usage_examples': [],
    })
```

**Files Modified**:
- `src/gatr/gatr_engine.py:2832-2861` (entity merge)
- `src/gatr/gatr_engine.py:2777-2782` (updated signature)
- `src/gatr/gatr_engine.py:886-891` (updated call)

**Expected Result**: Prompt receives entities from both pipelines

---

### Bug 4: kg_seed Cross-Reference Too Narrow

**Status**: ✅ FIXED  
**Severity**: MEDIUM  
**Impact**: kg_seed entities (75% of total) had 0% snippet coverage

**Problem**:
- Cross-reference only checked top-20 general semantic hits
- If kg_seed entity name not in those 20, it got no snippet
- Most kg_seed entities missed

**Root Cause**:
```python
# Only checked 20 general hits
for hit in raw_context.get('semantic_hits', []):
    if hit.get('entity_name') == entity_name:
        node_snippet = hit.get('code_snippet')
```

**Fix Applied**:
```python
# Added targeted lookup by entity name
if not node_snippet and self.vector_storage:
    try:
        targeted_result = self.vector_storage.search_similar_entities(entity_name, top_k=3)
        for hit in self._normalize_vector_hits(targeted_result):
            hit_name = hit.get('entity_name', '')
            hit_snippet = hit.get('code_snippet', '')
            if hit_snippet and (hit_name == entity_name or hit_name.endswith(f'.{entity_name}')):
                node_snippet = hit_snippet
                snippet_source = 'lancedb_targeted'
                break
    except Exception as _e:
        pass
```

**Files Modified**:
- `src/gatr/gatr_engine.py:1327-1342`

**Expected Result**: kg_seed entities get direct LanceDB lookup, improving coverage

---

## Expected Metrics After All Fixes

### Before Fixes
- LanceDB snippet coverage: 0%
- Raw ingestion coverage: 12% (vector only)
- After compression: 15%
- In prompt: 0%
- Entities in prompt: 0
- Code blocks in prompt: 0

### After Fixes
- LanceDB snippet coverage: 90-100% ✅
- Raw ingestion coverage: 70-80% ✅
- After compression: 60-70% ✅
- In prompt: 60-70% ✅
- Entities in prompt: 10-12 ✅
- Code blocks in prompt: 5+ ✅

---

## Verification Checklist

After running pipeline, check logs for:

```
✅ [SNIPPET_COVERAGE] Compression: X/Y (Z%)
   → Z should be ≥60% (was ~15%)

✅ [ENTITY_MERGE] augmented_context now has N entities after merging raw_context
   → N should be >0 (was missing)

✅ [TOKEN_BUDGET] Including N/M entities
   → N should be >0 (was 0)

✅ Code blocks in prompt: N
   → N should be ≥5 (was 0)
```

---

## Known Limitations (Not Bugs)

### 1. File Path Resolution
- Some entities may have invalid file_path values
- Fallback extraction handles this gracefully
- Not a bug - data quality issue

### 2. Line Number Accuracy
- Some entities may have line_start=0 or line_end=0
- Fallback uses first N lines of file
- Not a bug - depends on entity extraction quality

### 3. Token Budget Constraints
- Qwen model has 4000 token limit
- Not all entities can fit in prompt
- Not a bug - design constraint

---

## Testing

### Verify LanceDB Snippets
```bash
python scripts/verify_lancedb_snippets.py
```

Expected: 80-100% coverage

### Run GATR Repair
```bash
curl -X POST http://localhost:5000/api/gatr/repair \
  -H "Content-Type: application/json" \
  -d '{
    "test_name": "testExample",
    "test_file": "src/test/java/ExampleTest.java",
    "test_code": "...",
    "error_message": "..."
  }'
```

Check response for entities_used > 0 and snippets_used > 0

---

## Conclusion

All 5 critical bugs (0-4) are fixed. The GATR pipeline should now:
1. Store actual code in LanceDB (Bug 0)
2. Preserve vector entities through filtering (Bug 1)
3. Carry snippets through compression (Bug 2)
4. Merge both pipelines into prompt (Bug 3)
5. Use targeted lookup for kg_seed entities (Bug 4)

Result: Rich context with code snippets for accurate LLM-generated repairs.


---

## Bug 5: Infinite Loop - Embedding Model Reloaded on Every Search

**STATUS**: ✅ FIXED

**Severity**: CRITICAL - Causes backend to hang indefinitely

**Symptoms**:
- Backend stuck in infinite loop loading sentence transformer model
- Frontend returns "Internal Server Error" 
- Log shows repeated model loading: "Load pretrained SentenceTransformer: sentence-transformers/all-MiniLM-L6-v2"
- Program aborts with "control-C event"

**Root Cause**:
File: `src/vector_storage/step6_vector_storage.py:217`

The `search_similar_entities()` method was creating a NEW `SentenceTransformer` instance on EVERY search query:

```python
# OLD CODE (BROKEN)
def search_similar_entities(self, query: str, top_k: int = 20):
    # ...
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')  # ❌ Reloads every time!
    query_embedding = model.encode(query, convert_to_numpy=True)
```

This caused:
1. Model downloaded/loaded from HuggingFace on every search (5-10 seconds each)
2. Multiple searches in quick succession → infinite loop
3. Memory exhaustion and backend hang

**Fix Applied**:

1. Added `_embedding_model` cache to `__init__`:
```python
def __init__(self, workspace_dir: str = "workspace", db_path: Optional[str] = None):
    # ...
    # Cache the embedding model to avoid reloading on every search
    self._embedding_model = None
```

2. Updated `search_similar_entities()` to use cached model:
```python
# NEW CODE (FIXED)
def search_similar_entities(self, query: str, top_k: int = 20):
    # ...
    # Use cached model to avoid reloading on every search
    if self._embedding_model is None:
        from sentence_transformers import SentenceTransformer
        self.logger.info("Loading embedding model (first time only)...")
        self._embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.logger.info("Embedding model loaded and cached")
    
    query_embedding = self._embedding_model.encode(query, convert_to_numpy=True)
```

**Impact**:
- Model loads ONCE per server instance (first search only)
- Subsequent searches use cached model → instant embedding generation
- Backend no longer hangs
- Frontend works correctly

**Verification**:
Run `python scripts/test_model_caching.py` to verify model is loaded only once across multiple searches.

**Files Modified**:
- `src/vector_storage/step6_vector_storage.py` - Added model caching

