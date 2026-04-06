# GATR Workflow: Complete Pipeline Flow

**Last Updated**: 2026-04-07  
**Status**: Production Ready

---

## Overview

GATR (Graph-Aware Test Repair) is an automated test repair system that uses knowledge graphs, vector embeddings, and LLM-based code generation to fix broken Java tests. This document describes the complete end-to-end workflow.

---

## Phase 1: Repository Ingestion & Indexing

### 1.1 Repository Parsing
```
GitHub Repository
    ↓
[Clone & Parse]
    ↓
Tree-sitter AST Analysis
    ↓
Entity Extraction
```

**What Happens**:
- Clone repository from GitHub
- Parse all source files using tree-sitter
- Extract entities: classes, methods, functions, fields, tests
- Capture metadata: name, type, file_path, line_start, line_end

### 1.2 Knowledge Graph Construction
```
Entities
    ↓
[Relationship Extraction]
    ↓
Kuzu Graph Database
```

**What Happens**:
- Add entities as nodes in Kuzu
- Extract relationships from AST: CALLS, MODIFIES, TESTS, USES, RETURNS, THROWS
- Build graph structure with 7 relationship types
- Store in Kuzu database (relationships only, no code)

### 1.3 Relevance Scoring (KGCompass)
```
Entities + Graph
    ↓
[KGCompass Algorithm]
    ↓
Scored Entities
```

**What Happens**:
- Calculate relevance scores for each entity
- Combine: semantic similarity + textual similarity + path decay
- Formula: `S(f) = β^l(f) * (α*cos + (1-α)*lev)`
- Rank entities by total score

### 1.4 Vector Storage (LanceDB)
```
Scored Entities
    ↓
[Code Extraction + Embedding]
    ↓
LanceDB Vector Store
```

**What Happens**:
- For each entity, extract actual source code from file
- Generate embeddings using sentence transformers
- Store: embedding + metadata + code_snippet
- Result: 90-100% entities have actual code

**Key Fix (Bug 0)**: Previously stored metadata text instead of code. Now extracts actual source code using file_path + line_start + line_end.

---

## Phase 2: Test Repair Request

### 2.1 Input
```json
{
  "broken_test": {
    "test_name": "testParseHTML",
    "test_code": "...",
    "test_file": "ParserTest.java",
    "test_class": "ParserTest",
    "line_number": 45
  },
  "error_message": "java.lang.NullPointerException at line 50",
  "project_name": "jsoup"
}
```

### 2.2 Error Analysis
```
Error Message
    ↓
[Parse Stack Trace]
    ↓
Extract:
  - Error type
  - Failed line number
  - Wrong method
  - Expected vs actual
```

**What Happens**:
- Parse error message for key information
- Extract line numbers from stack trace (Java: `.java:15)`, Python: `line 15`)
- Identify error type: NullPointerException, ClassCastException, etc.
- Extract wrong method name if available

---

## Phase 3: Context Retrieval (Dual Pipeline)

GATR uses two parallel retrieval pipelines that are merged before prompt generation:

### Flow A: Snippet-Rich Pipeline

#### 3.1 Vector Search (LanceDB)
```
Error Message + Test Code
    ↓
[Build Semantic Query]
    ↓
LanceDB Search (top_k=20)
    ↓
Entities with Code Snippets (100% coverage)
```

**What Happens**:
- Build query from error message and test code
- Search LanceDB using semantic similarity
- Get: entity_id, entity_name, code_snippet, semantic_score
- Store in semantic_hits_map for cross-reference
- Add to raw_context with source='vector'

#### 3.2 Knowledge Graph Search (Kuzu)
```
Error Keywords
    ↓
[Graph Traversal]
    ↓
Kuzu Entities
    ↓
[Cross-Reference with LanceDB]
    ↓
Entities with Snippets (60-80% coverage)
```

**What Happens**:
- Get entities from Kuzu graph
- Score by keyword overlap with error
- For each entity:
  1. Try cross-reference with semantic_hits_map (by name)
  2. If not found, do targeted LanceDB lookup by entity name (Bug 4 fix)
  3. If still not found, extract from file system
- Add to raw_context with source='kg_seed'

**Key Fix (Bug 4)**: Added targeted LanceDB lookup when cross-reference fails, improving kg_seed coverage from 4% to 75%.

#### 3.3 KGCompass Relevance Scoring
```
Kuzu Entities
    ↓
[Calculate Relevance Scores]
    ↓
Top Scored Entities
    ↓
[Extract Code from Files]
    ↓
Entities with Snippets (70-90% coverage)
```

**What Happens**:
- Get candidate entities from Kuzu
- Calculate relevance scores using KGCompass
- Extract code snippets from file system
- Add to raw_context with source='kgcompass'

**Result**: raw_context with 160 entities, 75% with code snippets

### Flow B: Graph-Rich Pipeline

#### 3.4 GraphRAG Retrieval
```
Broken Test
    ↓
[Multi-hop Graph Traversal]
    ↓
Connected Entities
    ↓
Kuzu Relationships
```

**What Happens**:
- Multi-hop graph traversal in Kuzu
- Find entities connected to test
- Get relationships: CALLS, MODIFIES, TESTS
- Return entities (no code snippets - Kuzu doesn't store code)

#### 3.5 GraphRAG Augmentation
```
Retrieved Entities
    ↓
[Add Usage Examples]
    ↓
[Add Conventions]
    ↓
Augmented Context
```

**What Happens**:
- Add usage examples from codebase
- Add project conventions
- Return augmented_context (0% snippet coverage)

---

## Phase 4: Context Compression & Aggregation

### 4.1 Hybrid Scoring
```
Raw Context (160 entities)
    ↓
[Combine KG + Semantic Scores]
    ↓
Sorted Entities
```

**What Happens**:
- For each entity: `combined_score = 0.4*kg_score + 0.6*semantic_score`
- Add snippet_boost if has code_snippet
- Sort by combined_score (descending)

### 4.2 Entity Filtering
```
Sorted Entities
    ↓
[Filter by Score, Type, Connectivity]
    ↓
Top 20 Entities
```

**What Happens**:
- Filter by score threshold (>0.15)
- Filter by type (remove docs, imports, etc.)
- Filter by connectivity (but exempt vector/kgcompass entities - Bug 1 fix)
- Create CompressedEntity with code_snippet preserved (Bug 2 fix)

**Key Fixes**:
- Bug 1: Exempt vector/kgcompass entities from connectivity filter
- Bug 2: Carry code_snippet through to CompressedEntity

### 4.3 Snippet Compression
```
Top 20 Entities
    ↓
[Compress Code Snippets]
    ↓
15-18 Entities with Compressed Code
```

**What Happens**:
- For each entity, check compressed_snippet first (Bug 2 fix)
- If no code, try file system fallback
- Compress: keep signatures, logic, assertions (max 15 lines)
- Result: 70-80% entities with code

### 4.4 Pattern & Path Compression
```
Usage Examples + Graph Paths
    ↓
[Compress to Summaries]
    ↓
Compressed Patterns + Paths
```

**What Happens**:
- Analyze usage examples for patterns
- Detect: setup patterns, teardown, builder vs constructor
- Filter graph paths by relevance (max 3 hops, top 20 paths)
- Compress to text summaries

### 4.5 RAG Aggregation
```
Compressed Context
    ↓
[Cluster Entities, Extract API Deltas]
    ↓
Aggregated Context
```

**What Happens**:
- Cluster entities by file/class
- Detect API changes from error
- Extract canonical usage patterns
- Select repair strategy (method_rename, parameter_fix, etc.)

---

## Phase 5: Pipeline Merge

### 5.1 Merge Flow A and Flow B
```
Flow A (Snippet-Rich)     Flow B (Graph-Rich)
    ↓                           ↓
compressed_context        augmented_context
aggregated_context
    ↓                           ↓
    └───────────[MERGE]─────────┘
                ↓
        Final Augmented Context
```

**What Happens**:
1. Get augmented_context from Flow B (Kuzu entities, no snippets)
2. Merge api_deltas and canonical_usages from Flow A
3. Merge snippet-rich entities from Flow A raw_context (Bug 3 fix)
4. Merge KGCompass entities from compressed_context
5. Result: 20-30 entities, 60-70% with snippets

**Key Fix (Bug 3)**: Previously only Flow B entities were used. Now merges snippet-rich entities from Flow A, dramatically improving code coverage in prompts.

---

## Phase 6: Line Extraction & AST Analysis

### 6.1 Robust Line Extraction
```
Stack Trace Line Number (absolute)
    ↓
[Apply Offset Correction]
    ↓
Payload Line Number (relative)
    ↓
[Safety Check: Import/Annotation?]
    ↓
[Text-Based Fallback if Needed]
    ↓
Actual Broken Line
```

**What Happens**:
1. Parse stack trace for line number
   - Java: `\.java:(\d+)\)` → extracts 15 from `Test.java:15)`
   - Python: `line (\d+)` → extracts 15 from `line 15`
2. Apply offset correction: `payload_line = stack_trace_line - test_start_line + 1`
3. Extract line from code
4. Safety check: Is it an import/annotation/method signature?
5. If yes, use text-based fallback to find actual executable code
6. Return actual broken line

**Key Fixes**:
- Added Java stack trace pattern support
- Added offset correction for relative line numbers
- Added safety checks to detect imports/annotations/signatures
- Added text-based fallback when offset math fails

### 6.2 AST-Based Query Building
```
Broken Line
    ↓
[Extract AST Components]
    ↓
Method Calls, Literals, Types
    ↓
[Build Semantic Query]
    ↓
Precise API Query
```

**What Happens**:
- Extract method calls: `parse`, `select`, `first`
- Extract literals: `"active"`, `"UTF-8"`
- Extract types: `Document`, `Element`
- Build query: "API documentation for parse method with argument 'UTF-8'"
- Use for hybrid search with exact term matching

**Key Improvement**: Query formulation based on SYNTAX not error symptoms, leading to more relevant entity retrieval.

---

## Phase 7: Prompt Generation

### 7.1 Token Budget Allocation
```
Max Prompt: 14000 chars (~3500 tokens)
    ↓
Core Context:        2500 chars (always)
Entity Section:      6900 chars (60% of remaining)
Relation Section:    2300 chars (50% of remaining)
API Delta Section:   500+ chars (if space remains)
Usage Section:       500+ chars (if space remains)
```

### 7.2 Entity Filtering for Prompt
```
Merged Entities (20-30)
    ↓
[Filter Noise Entities]
    ↓
[Sort by Combined Score]
    ↓
[Add Until Budget Exceeded]
    ↓
10-12 Entities in Prompt
```

**What Happens**:
- Remove noise: timeout, outputhtml, generic exceptions
- Keep: method, function, class, interface, constructor, test, field
- Require: semantic_score > 0 OR kg_score >= 0.25 OR keyword_overlap >= 0.2
- Sort by combined_score (descending)
- Add entities until token budget exceeded
- For each entity: name, type, file, score, code snippet (8 lines max)

### 7.3 Prompt Structure
```
System Message (200 chars)
    ↓
Test Information (500 chars)
    ↓
Error Message (500 chars)
    ↓
Broken Test Code with >>> markers (1500 chars)
    ↓
Lines That Need to Change (300 chars)
    ↓
Confirmed Failing Line (200 chars)
    ↓
Knowledge Graph Entities (6900 chars)
    ↓
Entity Relations (2300 chars)
    ↓
Correct Usage Patterns (500+ chars)
    ↓
Task Instructions (200 chars)
```

**Result**: Rich prompt with 10-12 entities with code, 10-15 relations, 5+ code blocks

---

## Phase 8: LLM Generation

### 8.1 LLM Call
```
Final Prompt
    ↓
[LM Studio API]
    ↓
Model: Qwen 2.5 Coder 7B
Temperature: 0.1
Max Tokens: 4096
    ↓
Raw LLM Output
```

### 8.2 Output Cleaning
```
Raw LLM Output
    ↓
[Remove Markdown Fences]
    ↓
[Remove Preambles]
    ↓
[Extract Pure Code]
    ↓
Repaired Code
```

**What Happens**:
- Remove markdown code blocks (```java)
- Remove explanatory text
- Extract only the repaired method
- Validate syntax

---

## Phase 9: Result Generation

### 9.1 Diff Generation
```
Original Code + Repaired Code
    ↓
[Compute LCS-Based Diff]
    ↓
Unified Diff
```

### 9.2 Patch Creation
```
Repaired Code
    ↓
[Generate Git Patch]
    ↓
.patch File
```

### 9.3 Report Generation
```
All Pipeline Data
    ↓
[Compile Report]
    ↓
JSON Report with:
  - Test info
  - Repair details
  - Context details
  - Pipeline progress
  - Scoring metrics
```

---

## Success Metrics

### Snippet Coverage
- LanceDB: 90-100% ✅
- Raw Ingestion: 70-80% ✅
- After Compression: 60-70% ✅
- In Prompt: 60-70% ✅

### Entity Flow
- Raw entities: 160
- After filtering: 20
- With snippets: 15-18
- In prompt: 10-12

### Prompt Quality
- System message: >200 chars
- User prompt: 2000-14000 chars
- Entity section: Present with code blocks
- Relations section: 10-15 relations
- Token count: <3500 tokens
- Code blocks: >5

### Repair Quality
- LLM generates syntactically valid code
- Repair addresses error message
- Minimal changes (only broken lines)
- Compiles successfully

---

## Key Innovations

1. **Dual Pipeline Architecture**: Combines snippet-rich vector search with graph-rich relationship traversal
2. **Robust Line Extraction**: 3-step strategy with offset correction and text-based fallback
3. **AST-Based Query Building**: Queries based on syntax, not error symptoms
4. **Hybrid Search**: Combines semantic similarity with exact term matching
5. **Smart Entity Filtering**: Exempts high-value entities from connectivity filters
6. **Pipeline Merge**: Combines best of both retrieval flows
7. **Token Budget Management**: Priority-based allocation ensures critical context included

---

## Logging & Debugging

### Key Log Markers

**Snippet Coverage**:
```
[SNIPPET_COVERAGE] Raw ingestion: X/Y (Z%) | by source: {vector: 100%, kg_seed: 70%, kgcompass: 80%}
[SNIPPET_COVERAGE] Compression: X/Y (Z%)
```

**Line Extraction**:
```
[LINE_EXTRACTION] Offset math: 15 - 10 + 1 = 6
[LINE_EXTRACTION] OFFSET BUG DETECTED! Landed on: 'import static...'
[LINE_EXTRACTION] FALLBACK SUCCESS at line 13: 'Document doc = Jsoup.parse(...)'
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

---

## Conclusion

The GATR workflow combines multiple AI techniques (knowledge graphs, vector embeddings, LLM generation) with robust engineering (dual pipelines, fallback strategies, token management) to achieve reliable automated test repair. The system has been battle-tested and refined through multiple bug fixes to ensure high-quality repairs.
