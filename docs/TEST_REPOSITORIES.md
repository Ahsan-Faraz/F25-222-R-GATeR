# Test Repositories and Test Cases

**Date**: April 7, 2026  
**Purpose**: Final testing of GATR pipeline with Smart Budgeting

---

## Repository 1: Python - Requests Library

**GitHub**: https://github.com/psf/requests  
**Language**: Python  
**Size**: ~30k LOC (similar to Jsoup)  
**Description**: HTTP library for Python

### Test Case 1.1: AttributeError in Session

**Broken Test Code**:
```python
import pytest
from requests import Session

def test_session_cookies():
    s = Session()
    s.get('https://httpbin.org/cookies/set?test=value')
    cookies = s.cookies.get_dict()
    assert cookies['test'] == 'value'
```

**Error Message**:
```
AttributeError: 'NoneType' object has no attribute 'get_dict'
    at test_session_cookies (test_sessions.py:45)
```

**Test Metadata**:
- Test Name: `test_session_cookies`
- Test File: `tests/test_sessions.py`
- Test Class: N/A
- Test Method: `test_session_cookies`
- Language: `python`
- Line Number: 45

---

### Test Case 1.2: KeyError in Response Headers

**Broken Test Code**:
```python
import pytest
import requests

def test_response_headers():
    r = requests.get('https://httpbin.org/get')
    content_type = r.headers['Content-Type']
    assert 'application/json' in content_type
```

**Error Message**:
```
KeyError: 'Content-Type'
    at test_response_headers (test_requests.py:78)
```

**Test Metadata**:
- Test Name: `test_response_headers`
- Test File: `tests/test_requests.py`
- Test Class: N/A
- Test Method: `test_response_headers`
- Language: `python`
- Line Number: 78

---

## Repository 2: Java - Apache Commons Lang

**GitHub**: https://github.com/apache/commons-lang  
**Language**: Java  
**Size**: ~40k LOC (similar to Jsoup)  
**Description**: Java utility library

### Test Case 2.1: NullPointerException in StringUtils

**Broken Test Code**:
```java
import org.junit.Test;
import static org.junit.Assert.*;
import org.apache.commons.lang3.StringUtils;

public class StringUtilsTest {
    @Test
    public void testIsEmpty() {
        String str = null;
        boolean result = StringUtils.isEmpty(str);
        assertEquals(0, str.length());
    }
}
```

**Error Message**:
```
java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
    at org.apache.commons.lang3.StringUtilsTest.testIsEmpty(StringUtilsTest.java:25)
```

**Test Metadata**:
- Test Name: `testIsEmpty`
- Test File: `src/test/java/org/apache/commons/lang3/StringUtilsTest.java`
- Test Class: `StringUtilsTest`
- Test Method: `testIsEmpty`
- Language: `java`
- Line Number: 25

---

### Test Case 2.2: IndexOutOfBoundsException in ArrayUtils

**Broken Test Code**:
```java
import org.junit.Test;
import static org.junit.Assert.*;
import org.apache.commons.lang3.ArrayUtils;

public class ArrayUtilsTest {
    @Test
    public void testGetElement() {
        String[] array = {"a", "b", "c"};
        String element = array[3];
        assertEquals("d", element);
    }
}
```

**Error Message**:
```
java.lang.ArrayIndexOutOfBoundsException: Index 3 out of bounds for length 3
    at org.apache.commons.lang3.ArrayUtilsTest.testGetElement(ArrayUtilsTest.java:42)
```

**Test Metadata**:
- Test Name: `testGetElement`
- Test File: `src/test/java/org/apache/commons/lang3/ArrayUtilsTest.java`
- Test Class: `ArrayUtilsTest`
- Test Method: `testGetElement`
- Language: `java`
- Line Number: 42

---

## How to Use These Test Cases

### For Web Server Testing

1. **Start Flask server**:
   ```bash
   python web_server.py
   ```

2. **Open frontend** and navigate to test repair page

3. **For each test case**:
   - Paste the broken test code
   - Paste the error message
   - Submit for repair

4. **Check logs** for Smart Budgeting metrics:
   ```
   [COMPRESSION] Smart snippet selection: X/Y entities, Z chars (~tokens), skipped N low-quality entities
   ```

5. **Verify repair quality**:
   - Python tests should add proper null checks or try-except
   - Java tests should add null checks or bounds checks

### Expected Smart Budgeting Behavior

**For each test case, you should see**:

1. **Quality Filtering**:
   ```
   skipped 5-15 low-quality entities
   ```

2. **Snippet Count**:
   ```
   15-20 snippets included (capped at 20)
   ```

3. **Budget Usage**:
   ```
   6000-8000 chars (~1500-2000 tokens)
   ```

4. **Attention Management**:
   - Max 20 snippets (never more)
   - Only high-relevance entities (score ≥ 0.25)

### Success Criteria

✅ **Smart Budgeting Working**:
- Snippet count ≤ 20
- Char usage ≤ 8000
- Low-quality entities filtered
- Correct repairs generated

✅ **Repair Quality**:
- Python: Proper null checks or exception handling
- Java: Null checks or bounds validation
- Code compiles and runs
- Minimal changes (focused fixes)

---

## Alternative Repositories (If Needed)

### Python Alternatives

1. **Flask** (https://github.com/pallets/flask)
   - Size: ~20k LOC
   - Type: Web framework

2. **Click** (https://github.com/pallets/click)
   - Size: ~15k LOC
   - Type: CLI framework

### Java Alternatives

1. **Gson** (https://github.com/google/gson)
   - Size: ~30k LOC
   - Type: JSON library

2. **Guava** (https://github.com/google/guava)
   - Size: ~50k LOC (slightly larger)
   - Type: Core libraries

---

## Testing Checklist

### Before Testing
- [ ] Flask server running
- [ ] Frontend accessible
- [ ] Logs visible (check `workspace/logs/web_server.log`)

### During Testing
- [ ] Test case 1.1 (Python - AttributeError)
- [ ] Test case 1.2 (Python - KeyError)
- [ ] Test case 2.1 (Java - NullPointerException)
- [ ] Test case 2.2 (Java - IndexOutOfBoundsException)

### After Each Test
- [ ] Check Smart Budgeting logs
- [ ] Verify snippet count ≤ 20
- [ ] Verify char usage ≤ 8000
- [ ] Verify low-quality filtering
- [ ] Review repair quality

### Final Verification
- [ ] All 4 tests completed
- [ ] Smart Budgeting working consistently
- [ ] Repair quality acceptable
- [ ] No context overflow errors

---

## Troubleshooting

### If Snippet Count > 20
**Problem**: Attention cap not working

**Check**:
- `MAX_SNIPPET_COUNT = 20` in `_step_final_assembly`
- Loop breaks when count reaches 20

### If Char Usage > 8000
**Problem**: Budget gate not working

**Check**:
- `MAX_SNIPPET_CHARS = 8000` in `_step_final_assembly`
- Loop breaks when budget exhausted

### If No Low-Quality Filtering
**Problem**: Quality gate not working

**Check**:
- `MIN_RELEVANCE_SCORE = 0.25` in `_step_final_assembly`
- Entities with score < 0.25 are skipped

### If Poor Repair Quality
**Problem**: Not enough context or too much noise

**Solutions**:
1. Lower `MIN_RELEVANCE_SCORE` to 0.20
2. Increase `MAX_SNIPPET_COUNT` to 25
3. Check entity scoring in logs

---

## Expected Log Output

```
[COMPRESSION] Smart snippet selection: 18/45 entities, 7234 chars (~1808 tokens), skipped 8 low-quality entities
[TOKEN_BUDGET] Entity budget: 7819 chars, 107 entities available
[TOKEN_BUDGET] Including 12/107 entities (budget: 7819 chars, used: 7550 chars)
[SNIPPET_COVERAGE] Prompt building: 12/12 entities have code_snippet (100.00%)
[TOKEN_BUDGET] Final prompt size: 7670 chars (~1917 tokens) / 14000 chars budget
```

**Key Metrics**:
- Smart snippet selection: 15-20 entities
- Char usage: 6000-8000 chars
- Token estimate: 1500-2000 tokens
- Low-quality skipped: 5-15 entities

---

**Good luck with testing! The Smart Budgeting should show consistent, quality-focused snippet selection.** 🚀
