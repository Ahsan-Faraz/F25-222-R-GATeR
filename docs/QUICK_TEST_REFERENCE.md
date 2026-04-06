# Quick Test Reference Card

**Use this for fast copy-paste testing**

---

## Python Test 1: AttributeError

**Repo**: https://github.com/psf/requests

**Code**:
```python
import pytest
from requests import Session

def test_session_cookies():
    s = Session()
    s.get('https://httpbin.org/cookies/set?test=value')
    cookies = s.cookies.get_dict()
    assert cookies['test'] == 'value'
```

**Error**:
```
AttributeError: 'NoneType' object has no attribute 'get_dict'
    at test_session_cookies (test_sessions.py:45)
```

---

## Python Test 2: KeyError

**Repo**: https://github.com/psf/requests

**Code**:
```python
import pytest
import requests

def test_response_headers():
    r = requests.get('https://httpbin.org/get')
    content_type = r.headers['Content-Type']
    assert 'application/json' in content_type
```

**Error**:
```
KeyError: 'Content-Type'
    at test_response_headers (test_requests.py:78)
```

---

## Java Test 1: NullPointerException

**Repo**: https://github.com/apache/commons-lang

**Code**:
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

**Error**:
```
java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
    at org.apache.commons.lang3.StringUtilsTest.testIsEmpty(StringUtilsTest.java:25)
```

---

## Java Test 2: IndexOutOfBoundsException

**Repo**: https://github.com/apache/commons-lang

**Code**:
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

**Error**:
```
java.lang.ArrayIndexOutOfBoundsException: Index 3 out of bounds for length 3
    at org.apache.commons.lang3.ArrayUtilsTest.testGetElement(ArrayUtilsTest.java:42)
```

---

## What to Look For in Logs

```
[COMPRESSION] Smart snippet selection: 18/45 entities, 7234 chars (~1808 tokens), skipped 8 low-quality entities
```

**Check**:
- ✅ Snippet count ≤ 20
- ✅ Char usage ≤ 8000
- ✅ Low-quality entities skipped
- ✅ Token estimate ~1500-2000

---

## Quick Commands

```bash
# Start server
python web_server.py

# Check logs
tail -f workspace/logs/web_server.log | grep COMPRESSION

# Audit LanceDB
python scripts/audit_vector_db_snippets.py

# Test smart budgeting
python scripts/test_smart_budgeting.py
```
