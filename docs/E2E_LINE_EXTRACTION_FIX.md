# E2E Line Extraction Fix - Final Integration

**Date**: 2026-04-07  
**Status**: ✅ COMPLETED & TESTED

---

## Problem Summary

The `gatr_engine.py` file had legacy line extraction logic that was causing the LLM prompt to receive import statements instead of actual broken code lines. This was the final missing piece after fixing `ast_query_builder.py`.

### The Bugs

1. **Java Stack Trace Parsing Failed**: Regex `r'line\s+(\d+)'` doesn't match Java traces like `JsoupFileParserTest.java:15)`
2. **No Offset Correction**: Even when line numbers were extracted, offset math wasn't applied
3. **No Safety Checks**: No validation that extracted line wasn't an import/annotation
4. **Method Signature Detection Incomplete**: Fallback was returning method signatures instead of executable code

---

## The Fix

### 1. Added Java Stack Trace Pattern Support

**File**: `src/gatr/gatr_engine.py`  
**Method**: `_extract_failing_line_context()`

```python
# 2) Parse stack trace line number if available.
if not chosen_numbers:
    # Try Java stack trace pattern first: FileName.java:15)
    java_match = re.search(r'\.java:(\d+)\)', error_message)
    if java_match:
        ln = int(java_match.group(1))
        original_ln = ln
        
        # Apply offset correction if test_start_line is available
        if test_start_line is not None:
            payload_ln = ln - test_start_line + 1
            self.logger.debug(
                f"[LINE_EXTRACTION] Java trace: Converting absolute line {ln} to payload line {payload_ln}"
            )
            ln = payload_ln
```

### 2. Added Safety Checks for Java Traces

```python
        if 1 <= ln <= len(code_lines):
            extracted_line = code_lines[ln - 1]
            extracted_text = extracted_line.strip()
            
            # CRITICAL SAFETY CHECK: Verify we didn't land on import/annotation
            if self._is_offset_bug(extracted_text):
                self.logger.warning(
                    f"[LINE_EXTRACTION] Java trace OFFSET BUG at line {ln}: '{extracted_text[:80]}'"
                )
                
                # Fallback: Text-based search
                fallback_line, fallback_num = self._fallback_text_search(
                    code_lines, error_message, error_info, broken_test
                )
                
                if fallback_line:
                    chosen_numbers.append(fallback_num)
                    chosen_lines.append(fallback_line)
```

### 3. Improved Method Signature Detection

**File**: `src/gatr/gatr_engine.py`  
**Method**: `_is_offset_bug()`

```python
# Method signatures (not the body)
# Match: void methodName(...), public String methodName(...), etc.
# Should end with ) or ) throws or ) { but NOT have actual code after {
if re.match(r'^(public|private|protected)?\s*(static\s+)?(void|[\w<>]+)\s+\w+\s*\([^)]*\)\s*(throws\s+[\w,\s]+)?\s*\{?\s*$', line_text):
    return True

# Python function definitions (def name():)
if re.match(r'^def\s+\w+\s*\([^)]*\)\s*:\s*$', line_text):
    return True
```

---

## E2E Test Results

### Test 1: Java Stack Trace with Offset Bug ✅

**Input**:
```
Error: at JsoupFileParserTest.testParseLocalFileWithBaseUri(JsoupFileParserTest.java:15)
Test Start Line: 10
Stack Trace Line: 15
```

**Expected Behavior**:
1. Parse Java stack trace → Extract line 15
2. Apply offset: 15 - 10 + 1 = 6
3. Line 6 is `import static org.junit.jupiter.api.Assertions.assertEquals;`
4. Detect offset bug (it's an import)
5. Use fallback to find actual broken line
6. Extract: `Document doc = Jsoup.parse(htmlFile, "http://localhost:8080");`

**Result**: ✅ PASS

```
[LINE_EXTRACTION] OFFSET BUG DETECTED at line 6: 'import static org.junit.jupiter.api.Assertions.assertEquals;'
[LINE_EXTRACTION] Line is import/annotation, not actual code. Using fallback.
[FALLBACK] Found parse operation at line 13
Extracted Lines: 1
  Line 13: Document doc = Jsoup.parse(htmlFile, "http://localhost:8080");
```

### Test 2: Python Stack Trace with Function Definition ✅

**Input**:
```
Error: File "test_parser.py", line 7, in test_parse_html
Test Start Line: 4
```

**Expected Behavior**:
1. Parse Python stack trace → Extract line 7
2. Apply offset: 7 - 4 + 1 = 4
3. Line 4 is `def test_parse_html():`
4. Detect offset bug (it's a function definition)
5. Use fallback to find actual broken line
6. Extract: `content = soup.select('.content')[0].text`

**Result**: ✅ PASS

```
[LINE_EXTRACTION] OFFSET BUG DETECTED at line 4: 'def test_parse_html():'
[LINE_EXTRACTION] Line is import/annotation, not actual code. Using fallback.
[FALLBACK] Found select operation at line 7
Extracted Lines: 1
  Line 7: content = soup.select('.content')[0].text
```

---

## Complete Pipeline Flow

### Before (Broken)

```
Stack Trace: JsoupFileParserTest.java:15
    ↓
Regex: r'line\s+(\d+)' → FAILS (doesn't match Java format)
    ↓
Fallback: Search for 'equals' keyword
    ↓
Finds: import static org.junit.jupiter.api.Assertions.assertEquals;
    ↓
LLM Prompt: "Fix this line: import static org.junit..."
    ↓
❌ LLM has NO context about actual broken code
```

### After (Fixed)

```
Stack Trace: JsoupFileParserTest.java:15
    ↓
Regex: r'\.java:(\d+)\)' → Extracts 15 ✅
    ↓
Offset Math: 15 - 10 + 1 = 6
    ↓
Extract Line 6: import static org.junit.jupiter.api.Assertions.assertEquals;
    ↓
Safety Check: _is_offset_bug() → TRUE (it's an import) ✅
    ↓
Fallback: Search for .parse() operation
    ↓
Finds: Document doc = Jsoup.parse(htmlFile, "http://localhost:8080");
    ↓
LLM Prompt: "Fix this line: Document doc = Jsoup.parse(htmlFile, ...)"
    ↓
✅ LLM receives CORRECT broken line with full context
```

---

## Files Modified

```
M  src/gatr/gatr_engine.py
   - Added Java stack trace regex pattern
   - Added offset correction for Java traces
   - Added safety checks for extracted lines
   - Improved method signature detection (Java + Python)
   - Enhanced _is_offset_bug() to catch function definitions

A  scripts/test_e2e_prompt_extraction.py
   - E2E integration test for Java stack traces
   - E2E integration test for Python stack traces
   - Strict assertions for correct line extraction
   - Validates no imports/annotations are extracted

A  docs/E2E_LINE_EXTRACTION_FIX.md
   - This documentation
```

---

## Verification

Run the E2E test suite:

```bash
python scripts/test_e2e_prompt_extraction.py
```

Expected output:

```
================================================================================
[OK] ALL E2E INTEGRATION TESTS PASSED!
================================================================================

The GATR extraction pipeline is working correctly.
The LLM will receive accurate broken lines, not imports/annotations.
```

---

## Integration with Existing Fixes

This fix completes the line extraction pipeline by ensuring both components use the same robust strategy:

1. **ast_query_builder.py** (Fixed in Task 6):
   - `_get_line_from_code()` with offset correction + fallback
   - Used for AST analysis and query formulation

2. **gatr_engine.py** (Fixed in Task 8 - THIS FIX):
   - `_extract_failing_line_context()` with Java trace support + fallback
   - Used for LLM prompt generation

Both now use:
- Offset calculation (absolute → payload line numbers)
- Safety checks (detect imports/annotations/signatures)
- Text-based fallback (find actual executable code)

---

## Benefits

### Before
- ❌ Java stack traces not parsed
- ❌ Offset bugs not detected
- ❌ Import statements sent to LLM
- ❌ Method signatures treated as broken lines
- ❌ LLM receives wrong context

### After
- ✅ Java stack traces parsed correctly
- ✅ Offset bugs detected immediately
- ✅ Import statements rejected
- ✅ Method signatures rejected
- ✅ LLM receives actual broken line
- ✅ AST parser gets correct input
- ✅ Query formulation targets right APIs
- ✅ Entity retrieval is accurate

---

## Conclusion

The GATR pipeline now has end-to-end robust line extraction:

1. **Stack Trace Parsing**: Supports both Java (`.java:15)`) and Python (`line 15`) formats
2. **Offset Correction**: Converts absolute line numbers to payload line numbers
3. **Safety Checks**: Detects and rejects imports, annotations, comments, method signatures
4. **Text-Based Fallback**: Finds actual executable code when offset math fails
5. **E2E Tested**: Comprehensive integration tests verify correct behavior

The LLM prompt will now consistently receive the correct broken line, enabling accurate test repair suggestions.

---

## Next Steps

The line extraction pipeline is now complete and tested. Future work:

1. Monitor production logs for any edge cases
2. Add more E2E test cases for different languages (C++, JavaScript, etc.)
3. Consider adding support for multi-line broken code (e.g., chained method calls)
4. Integrate with evaluation framework to measure impact on repair accuracy
