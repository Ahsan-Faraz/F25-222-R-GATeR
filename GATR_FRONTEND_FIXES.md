# GATR Frontend Fixes

## Issue 1: Internal Server Error Before LLM Response
**Problem**: Frontend throws timeout error before LLM has time to respond

**Solution**: 
- Added 2-minute (120 second) timeout to `repairTest()` API call
- Uses AbortController to handle timeout gracefully
- Shows user-friendly error message: "Request timeout - LLM is taking longer than expected. Please try again."

**Files Changed**:
- `frontend/src/lib/api/gatr.ts` - Added timeout handling with AbortController

## Issue 2: Unnecessary Input Fields - Full Auto-Extraction
**Problem**: Form requires fields that can be auto-extracted from test code and vector DB

**Solution**:
- **Only 2 REQUIRED fields now**:
  1. Broken Test Code (required)
  2. Error Message / Assertion (required)
  
- **1 OPTIONAL field**:
  - Test Name (optional - auto-extracted if empty)

- Backend now **auto-extracts ALL metadata**:
  - `test_name`: Extracted from test code using regex patterns
    - Python: `def test_foo(` → `test_foo`
    - Java: `@Test public void testFoo(` → `testFoo`
    - Fallback: `unknown_test`
  - `test_class`: Extracted from test code (`class TestFoo:` → `TestFoo`)
  - `test_file`: Retrieved from vector DB by searching for test_name

**Files Changed**:
- `frontend/src/components/gatr/GATRPanel.tsx`:
  - Made test_name optional with dimmed styling
  - Changed placeholder to "Leave empty to auto-extract from code"
  - Updated tip to mention including full test method
  - Only sends test_name if user provides it
  
- `web_server.py`:
  - Removed test_name from required validation
  - Added auto-extraction of test_name from test_code using regex
    - Tries Python pattern first: `def test_\w+`
    - Falls back to Java pattern: `@Test.*public void \w+`
    - Uses 'unknown_test' as last resort
  - Auto-extraction of test_class from test_code using regex
  - Auto-extraction of test_file from vector DB by searching for test_name
  - Logs when fields are auto-extracted

## How Auto-Extraction Works

### test_name Extraction:
```python
# Python: def test_parse_food(self):
py_match = re.search(r'def\s+(test_\w+)', test_code)
# Result: "test_parse_food"

# Java: @Test public void testParseFood() {
java_match = re.search(r'@Test.*?public\s+void\s+(\w+)', test_code, re.DOTALL)
# Result: "testParseFood"
```

### test_class Extraction:
```python
# Searches test_code for: class TestFoo:
class_match = re.search(r'class\s+(\w+)', test_code)
if class_match:
    test_class = class_match.group(1)  # "TestFoo"
```

### test_file Extraction:
```python
# Searches vector DB for entity with matching test_name
# Vector DB entities have file_path field
# Example: test_name="testParseFood" → file_path="src/test/java/.../FoodTest.java"
```

## Benefits
1. **Simplest UX**: Users only fill 2 required fields (code + error)
2. **More accurate**: Data comes from actual codebase (vector DB) not user memory
3. **Less errors**: No typos in names, file paths, or class names
4. **Fully automatic**: Works without user knowing about metadata fields
5. **Still flexible**: User can override test_name if needed

## Testing
1. Submit test WITHOUT test_name → auto-extracted from code
2. Submit test WITH test_name → uses provided name
3. Check backend logs to see auto-extraction messages
4. Verify diff files use correct paths and names


