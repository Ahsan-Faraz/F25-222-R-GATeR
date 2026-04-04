# GATR Frontend Fixes

## Issue 1: Internal Server Error Before LLM Response
**Problem**: Frontend throws timeout error before LLM has time to respond

**Solution**: 
- Added 2-minute (120 second) timeout to `repairTest()` API call
- Uses AbortController to handle timeout gracefully
- Shows user-friendly error message: "Request timeout - LLM is taking longer than expected. Please try again."

**Files Changed**:
- `frontend/src/lib/api/gatr.ts` - Added timeout handling with AbortController

## Issue 2: Unnecessary Input Fields
**Problem**: Form shows test_file, test_class fields that can be auto-extracted

**Solution**:
- **Completely removed** test_file and test_class input fields from frontend
- Backend now **auto-extracts** these fields:
  - `test_class`: Extracted from test code using regex (`class TestFoo:` → `TestFoo`)
  - `test_file`: Retrieved from vector DB by searching for test_name
- Form now only has 3 required fields:
  1. Test Name (required)
  2. Broken Test Code (required) - with tip to include class definition
  3. Error Message / Assertion (required)

**Files Changed**:
- `frontend/src/components/gatr/GATRPanel.tsx`:
  - Removed testFile and testClass state variables
  - Removed optional fields UI section
  - Simplified form to 3 fields only
  - Added helpful tip about including class definition
  
- `web_server.py`:
  - Added auto-extraction of test_class from test_code using regex
  - Added auto-extraction of test_file from vector DB by searching for test_name
  - Logs when fields are auto-extracted

## How Auto-Extraction Works

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
1. **Simpler UX**: Users only fill 3 fields instead of 5
2. **More accurate**: Data comes from actual codebase (vector DB) not user memory
3. **Less errors**: No typos in file paths or class names
4. **Automatic**: Works without user knowing about these fields

## Testing
1. Submit test with class definition in code → test_class auto-extracted
2. Submit test with name matching vector DB → test_file auto-extracted
3. Check backend logs to see auto-extraction messages
4. Verify diff files use correct paths

