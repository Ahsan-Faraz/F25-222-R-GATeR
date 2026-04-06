# GATR Pipeline Final Evaluation - Post Re-ingestion

**Date**: 2026-04-07  
**Status**: RE-INGESTION COMPLETED - PARTIAL SUCCESS

---

## Executive Summary

Successfully re-ingested Jsoup repository with code snippet extraction, improving LanceDB coverage from **4.59% to 58.83%** (12.8x improvement). However, test suite results show that snippet coverage during repair requests remains at ~2%, indicating a disconnect between LanceDB storage and runtime retrieval.

---

## What We Fixed

### 1. LanceDB Re-ingestion Architecture ✅

**Problem**: LanceDB was populated before Bug 0 fix, resulting in 4.59% snippet coverage.

**Solution Implemented**:
- Created `scripts/reingest_jsoup_with_snippets.py` that:
  1. Reads entity metadata from Kuzu (name, type, file_path, line numbers)
  2. Extracts code snippets directly from cloned Jsoup repository
  3. Generates embeddings for each entity
  4. Stores entities with code snippets in LanceDB

**Architecture Clarification**:
- **Kuzu**: Stores entity metadata and relationships (NO code)
- **LanceDB**: Stores entity embeddings + code snippets for semantic search
- **Repository**: Source of truth for code snippets

**Results**:
```
Before Re-ingestion:
- Total entities: 5,663
- With snippets: 260 (4.59%)
- Without snippets: 5,403 (95.41%)

After Re-ingestion:
- Total entities: 9,559
- With snippets: 5,624 (58.83%)
- Without snippets: 3,935 (41.17%)
- Avg snippet length: 477 chars
```

**Improvement**: 12.8x increase in snippet coverage (4.59% → 58.83%)

---

### 2. Code Snippet Extraction ✅

**Implementation**:
- Multi-strategy path resolution:
  1. Direct path relative to repo
  2. Remove leading path components
  3. Search for filename in repo
- Extracts 20 lines of code per entity
- Handles encoding errors gracefully

**Sample Extracted Snippets**:
```java
// Progress.java (file) - 715 chars
package org.jsoup;

@FunctionalInterface
public interface Progress<ProgressContext> {
    /**
     Called to report progress...
     */
    void onProgress(int processed, int total, float percent, ProgressContext context);
}

// Progress (class) - 695 chars
@FunctionalInterface
public interface Progress<ProgressContext> {
    /**
     Called to report progress. Note that this will be executed by the same thread...
     */
}
```

---

### 3. Entities Without Snippets (41.17%) ✅

**Analysis**: The 3,935 entities without snippets are primarily:
- External library calls: `Collections.unmodifiableMap`, `super.toString`
- Method invocations: `req.cookieManager`, `storedCookies.entrySet`
- Type: `unknown_function`

**Verdict**: This is EXPECTED behavior. These are not actual code entities from Jsoup but references to external APIs. The 58.83% coverage represents actual Jsoup code entities.

---

## Current Issue: Runtime Retrieval Problem 🚨

### Test Suite Results (Post Re-ingestion)

Despite 58.83% coverage in LanceDB, test repairs show:

| Test | Entities Found | Snippets Found | Snippets Retained | Coverage |
|------|----------------|----------------|-------------------|----------|
| Test 1 | 140 | 0 | 3 | 2.14% |
| Test 2 | 138 | 0 | 3 | 2.17% |
| Test 3 | 140 | 0 | 3 | 2.14% |
| Test 4 | 139 | 0 | 3 | 2.16% |
| Test 5 | 140 | 0 | 3 | 2.14% |

**Average**: 139 entities found, but only 2.15% have snippets at runtime

---

### Root Cause Analysis

**Disconnect Between Storage and Retrieval**:

1. **LanceDB Storage**: 58.83% of entities have code snippets ✅
2. **Runtime Retrieval**: Only 2.15% of retrieved entities have snippets ❌

**Hypothesis**: The entities being retrieved during repair are NOT the same entities that have snippets in LanceDB.

**Possible Causes**:
1. **Vector search returns wrong entities**: Semantic search may be returning external library calls instead of Jsoup code
2. **KG seed entities don't have snippets**: Initial entities from error message may not have code
3. **Cross-reference lookup fails**: Bug 4 fix may not be finding the right entities
4. **Entity ID mismatch**: Entities in Kuzu may have different IDs than LanceDB

---

## Next Steps to Fix Runtime Retrieval

### Investigation Required

1. **Check which entities are being retrieved**:
   - Log entity names and types during repair
   - Verify if they match entities with snippets in LanceDB
   - Check if entity IDs match between Kuzu and LanceDB

2. **Verify vector search quality**:
   - Test if semantic search returns relevant Jsoup entities
   - Check if embeddings are correctly generated
   - Verify search is not biased toward external library calls

3. **Audit entity flow**:
   - Step 1 (Raw Context): Which entities are found?
   - Step 2 (Compression): Which entities are retained?
   - Step 3 (Aggregation): Which entities reach the prompt?
   - Check if entities with snippets are being filtered out

### Potential Fixes

**Option 1: Improve Vector Search**
- Boost relevance of entities with code snippets
- Filter out `unknown_function` types during search
- Prioritize entities from Jsoup package

**Option 2: Fix Entity ID Matching**
- Ensure Kuzu and LanceDB use same entity IDs
- Add entity ID mapping if needed
- Verify cross-reference lookup uses correct IDs

**Option 3: Enhance KG Seed**
- Ensure seed entities from error message have snippets
- Add fallback to find similar entities with code
- Expand seed to include more relevant entities

---

## Files Created/Modified

### Scripts Created
1. `scripts/reingest_jsoup_with_snippets.py` - Re-ingestion with code extraction
2. `scripts/load_entities_to_kuzu.py` - Load entities from JSONL to Kuzu
3. `scripts/audit_vector_db_snippets.py` - Audit LanceDB snippet coverage
4. `scripts/run_test_suite_audit.py` - Test suite runner with metrics

### Test Cases
- `test_cases/jsoup_test_suite.json` - 5 comprehensive test cases

### Documentation
- `docs/FINAL_EVALUATION_CONCLUSION.md` - This document
- `AUDIT_REPORT.md` - Initial audit findings

---

## Success Metrics

### Achieved ✅
- [x] LanceDB snippet coverage: 4.59% → 58.83% (12.8x improvement)
- [x] Total entities: 5,663 → 9,559 (1.7x increase)
- [x] Avg snippet length: 380 → 477 chars
- [x] Architecture clarified (Kuzu = metadata, LanceDB = code)
- [x] Re-ingestion pipeline working

### Not Yet Achieved ❌
- [ ] Runtime snippet coverage: Still at 2.15% (target: >60%)
- [ ] Repair quality: Still poor (wrong lines changed)
- [ ] Entity retrieval: Not finding entities with snippets

---

## Conclusion

**Phase 1 (Storage) - COMPLETE**: Successfully re-ingested Jsoup repository with 58.83% snippet coverage in LanceDB. The storage layer is working correctly.

**Phase 2 (Retrieval) - IN PROGRESS**: Runtime retrieval is not accessing the entities with snippets. Need to investigate and fix the entity retrieval pipeline to ensure entities with code snippets are being found and used during repairs.

**Priority**: Fix runtime retrieval to match storage coverage (58.83%)

---

## Commands for Verification

```bash
# Verify LanceDB coverage
python scripts/audit_vector_db_snippets.py
# Expected: 58.83% coverage

# Run test suite
python scripts/run_test_suite_audit.py
# Current: 2.15% coverage (needs fix)

# Check entity retrieval (debug)
# Need to add logging to gatr_engine.py to see which entities are retrieved
```

---

**Report Generated**: 2026-04-07 02:30:00  
**Status**: Phase 1 Complete, Phase 2 In Progress  
**Next Action**: Investigate runtime entity retrieval
