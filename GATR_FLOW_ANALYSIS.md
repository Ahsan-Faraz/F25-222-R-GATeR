# GATR Test Repair Flow: Frontend to Backend

## Frontend Input (GATRPanel.tsx)

### User Fills Form:
```typescript
// REQUIRED FIELDS (always sent):
- testName: string          // e.g., "testParseFood"
- testCode: string          // The actual broken test code
- errorMessage: string      // The assertion error/traceback

// OPTIONAL FIELDS (only sent if user expands and fills):
- testFile: string          // e.g., "tests/test_parser.py" 
- testClass: string         // e.g., "TestFoodParser"
```

### Frontend Sends Request:
```typescript
// frontend/src/components/gatr/GATRPanel.tsx - handleRepair()
const result = await repairTest({
  test_code: testCode,
  test_name: testName || 'unknown_test',
  error_message: errorMessage,
  // Optional - only included if provided:
  ...(testFile && { test_file: testFile }),
  ...(testClass && { test_class: testClass }),
});
```

### API Call with Timeout:
```typescript
// frontend/src/lib/api/gatr.ts - repairTest()
// POST to /api/backend/gatr/repair
// Timeout: 120 seconds (2 minutes)
// Body: JSON with fields above
```

---

## Backend Processing (web_server.py)

### 1. Request Received:
```python
# web_server.py - @app.route('/gatr/repair', methods=['POST'])

# Extract from request:
test_name = data.get('test_name', '').strip()        # REQUIRED
test_code = data.get('test_code', '').strip()        # REQUIRED  
error_message = data.get('error_message', '').strip() # REQUIRED
test_file = data.get('test_file', '')                # OPTIONAL - defaults to ''
test_class = data.get('test_class', '')              # OPTIONAL - defaults to ''
project_name = data.get('project_name', '').strip() or 'default_project'
```

### 2. Build broken_test Dict:
```python
broken_test = {
    'test_name': test_name,           # "testParseFood"
    'test_code': test_code,           # Full test code
    'test_file': test_file,           # "" or "tests/test_parser.py"
    'test_class': test_class,         # "" or "TestFoodParser"
    'line_number': data.get('line_number')  # None (not sent from frontend)
}
```

### 3. Call GATR Engine:
```python
# web_server.py
repair_result = gatr_engine.repair_test(
    broken_test,      # Dict above
    error_message,    # The error string
    project_name=project_name  # "default_project"
)
```

---

## GATR Engine Processing (gatr_engine.py)

### Step 1: Raw Context Ingestion
```python
# src/gatr/gatr_engine.py - _ingest_raw_context()

# USES FROM broken_test:
test_name = broken_test.get('test_name', '')    # ✓ USED - for query building
test_code = broken_test.get('test_code', '')    # ✓ USED - extract imports, patterns
test_file = broken_test.get('test_file', '')    # ✗ NOT USED in this step
test_class = broken_test.get('test_class', '')  # ✗ NOT USED in this step

# What happens:
1. Parse error_message to extract:
   - Class name (e.g., "FoodParser" from "FoodParser has no attribute 'text'")
   - Wrong method name (e.g., "text" from "no attribute 'text'")
   
2. Extract imports from test_code:
   - "from food.parser import FoodParser"
   
3. Build semantic search query:
   query = "FoodParser text food.parser FoodParser testParseFood"
   
4. Search Knowledge Graph:
   - Get entities (functions, methods, classes) from graph
   - Score by keyword overlap with error
   - Keep top 120 entities
   
5. Search Vector Database:
   - Semantic search with query
   - Get top 50 similar code snippets
   
6. Return raw_context:
   {
     'entities': [...],           # From KG
     'semantic_hits': [...],      # From vectors
     'snippets': [],
     'usage_examples': [],
     'graph_paths': [],
     'conventions': {}
   }
```

### Step 2: Context Compression
```python
# src/gatr/gatr_engine.py - _compress_context()

# USES FROM broken_test:
test_file = broken_test.get('test_file', '')    # ✓ USED - for file_path in focused context
test_class = broken_test.get('test_class', '')  # ✗ NOT USED directly

# What happens:
1. Hybrid scoring (KGCompass + Semantic):
   - Combine relevance scores from KG and vectors
   - Weight: 70% KGCompass, 30% Semantic
   
2. Deduplicate entities:
   - Remove duplicates by entity_id
   
3. Build focused context:
   - Add broken test itself as entity with file_path from test_file
   - If test_file is empty, file_path will be ''
   
4. Return compressed_context with top entities
```

### Step 3: Context Aggregation
```python
# src/gatr/gatr_engine.py - _aggregate_context()

# USES FROM broken_test:
test_file = broken_test.get('test_file', '')    # ✓ USED - for language detection
test_code = broken_test.get('test_code', '')    # ✓ USED - for language detection

# What happens:
1. Detect language:
   if test_file.endswith('.py') or 'def test_' in test_code:
       language = 'python'
   elif test_file.endswith('.java') or '@Test' in test_code:
       language = 'java'
   else:
       language = 'unknown'
   
   # If test_file is empty, falls back to code pattern detection
   
2. Select repair strategy based on context quality
3. Build augmented_context with language info
```

### Step 4: LLM Repair
```python
# src/gatr/gatr_engine.py - _generate_llm_repair()

# USES FROM broken_test:
test_file = broken_test.get('test_file', '')    # ✓ USED - in prompt
test_code = broken_test.get('test_code', '')    # ✓ USED - in prompt

# What happens:
1. Build LLM prompt with:
   - Test name
   - Test file (if provided, shows in prompt)
   - Language
   - Error message
   - Retrieved context (entities, code snippets)
   - Original test code
   
2. Send to LLM (LM Studio / Ollama)
3. Parse LLM response to extract repaired code
```

### Step 5: Save Results
```python
# src/gatr/gatr_engine.py - _save_repair_result()

# USES FROM broken_test:
test_name = broken_test.get('test_name', '')    # ✓ USED - for filename
test_file = broken_test.get('test_file', '')    # ✓ USED - for diff generation
test_code = broken_test.get('test_code', '')    # ✓ USED - original code

# What happens:
1. Generate unified diff:
   from_file = f"a/{test_file}" if test_file else f"a/{test_name}"
   to_file = f"b/{test_file}" if test_file else f"b/{test_name}"
   
   # If test_file is empty, uses test_name as filename
   
2. Save to workspace/fix/{project_name}/{test_name}_{timestamp}_report.json
3. Save diff to workspace/fix/{project_name}/{test_name}_{timestamp}.patch
```

---

## Backend Response

### Success Response:
```python
{
    'success': True,
    'repair_id': 'repair_1_1234567890',
    'test_name': 'testParseFood',
    'project_name': 'default_project',
    'repaired_code': '... fixed test code ...',
    'repair_strategy': 'graphrag_llm_repair',
    'llm_used': True,
    'repair_method': 'graphrag_llm_repair',
    'confidence': 0.85,
    'processing_time': 45.2,
    'context_summary': {...},
    'diff_file_path': 'workspace/fix/default_project/testParseFood_20260405_011155.patch',
    'diff_content': '... unified diff ...'
}
```

### Error Response:
```python
{
    'success': False,
    'error': 'LLM failed to generate repair',
    'repair_id': 'repair_1_1234567890',
    ...
}
```

---

## Frontend Display

### Success:
```typescript
// GATRPanel.tsx shows:
- Repaired code in diff viewer
- Repair strategy used
- Confidence score
- Processing time
- Download diff button
```

### Error:
```typescript
// Shows error message:
- "Repair failed: {error message}"
- Or timeout: "Request timeout - LLM is taking longer than expected"
```

---

## Summary: Impact of Removed Fields

### test_file (optional):
**When PROVIDED:**
- ✓ Better language detection (Python vs Java)
- ✓ Proper file paths in diff headers
- ✓ Shows in LLM prompt for context
- ✓ Better organized saved files

**When EMPTY:**
- ✗ Language detected from code patterns only
- ✗ Diff uses test_name as filename
- ✗ No file path shown in prompt
- ✗ Still works, just less context

### test_class (optional):
**When PROVIDED:**
- ✓ Could help infer production class (TestFoo → Foo)
- ✓ Better entity matching in some cases

**When EMPTY:**
- ✗ No production class inference
- ✗ Relies purely on semantic search
- ✗ Still works fine for most cases

### Conclusion:
The system works WITHOUT these fields, but they provide:
- Better context for the LLM
- More accurate file organization
- Slightly better entity retrieval

They are truly optional - the core repair logic doesn't depend on them.
