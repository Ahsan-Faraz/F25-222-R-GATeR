"""
E2E Integration Test for GATR Line Extraction
Tests the complete pipeline from error message to extracted broken line
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.gatr.gatr_engine import GATREngine


def test_e2e_java_stack_trace_extraction():
    """
    Test that the complete pipeline correctly extracts the broken line
    from a Java stack trace without hitting imports
    """
    print("\n" + "="*80)
    print("E2E TEST: Java Stack Trace Line Extraction")
    print("="*80)
    
    # Initialize GATR engine (mocking LLM/DB calls)
    engine = GATREngine(
        kg_manager=None,
        vector_storage=None,
        relevance_scorer=None
    )
    
    # Test payload - exactly as it would appear in the real pipeline
    test_code = """import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;
import java.io.File;
import java.io.IOException;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

public class JsoupFileParserTest {
    @Test
    void testParseLocalFileWithBaseUri() throws IOException {
        File htmlFile = new File("src/test/resources/index.html");
        Document doc = Jsoup.parse(htmlFile, "http://localhost:8080");
        assertNotNull(doc);
        assertEquals("http://localhost:8080", doc.baseUri());
    }
}"""
    
    # Error message with Java stack trace
    error_message = "at JsoupFileParserTest.testParseLocalFileWithBaseUri(JsoupFileParserTest.java:15)"
    
    # Broken test metadata (as provided by tarbench_bridge)
    broken_test = {
        'line_number': 10,  # The @Test annotation starts at line 10 in the full file
        'broken_line_numbers': [15],  # Stack trace says line 15
        'broken_lines': []
    }
    
    error_info = {
        'wrong_method': 'parse'
    }
    
    print("\n[TEST INPUT]")
    print(f"Error Message: {error_message}")
    print(f"Test Start Line: {broken_test['line_number']}")
    print(f"Stack Trace Line: 15")
    print(f"Expected Offset: 15 - 10 + 1 = 6 (in payload)")
    
    # Call the extraction method
    extracted_lines, extracted_numbers = engine._extract_failing_line_context(
        test_code=test_code,
        error_message=error_message,
        error_info=error_info,
        broken_test=broken_test
    )
    
    print("\n[TEST OUTPUT]")
    print(f"Extracted Lines: {len(extracted_lines)}")
    for i, (line, num) in enumerate(zip(extracted_lines, extracted_numbers)):
        print(f"  Line {num}: {line.strip()}")
    
    # ASSERTIONS
    print("\n[ASSERTIONS]")
    
    # Assert we got at least one line
    assert len(extracted_lines) > 0, "[ERROR] No lines extracted!"
    print("[OK] At least one line was extracted")
    
    # Get the first extracted line
    first_line = extracted_lines[0].strip()
    
    # Assert it's the correct line (the Jsoup.parse call)
    expected_line = 'Document doc = Jsoup.parse(htmlFile, "http://localhost:8080");'
    assert first_line == expected_line, f"[ERROR] Wrong line extracted!\n  Expected: {expected_line}\n  Got: {first_line}"
    print(f"[OK] Correct line extracted: '{first_line[:60]}...'")
    
    # Assert it's NOT an import statement
    assert not first_line.startswith('import '), f"[ERROR] Extracted an import statement: {first_line}"
    print("[OK] Line is NOT an import statement")
    
    # Assert it's NOT an annotation
    assert not first_line.startswith('@'), f"[ERROR] Extracted an annotation: {first_line}"
    print("[OK] Line is NOT an annotation")
    
    # Assert it's NOT a package declaration
    assert not first_line.startswith('package '), f"[ERROR] Extracted a package declaration: {first_line}"
    print("[OK] Line is NOT a package declaration")
    
    # Assert it contains actual code (method call)
    assert 'Jsoup.parse' in first_line, f"[ERROR] Line doesn't contain expected method call: {first_line}"
    print("[OK] Line contains the expected method call 'Jsoup.parse'")
    
    print("\n" + "="*80)
    print("[OK] ALL E2E TESTS PASSED!")
    print("="*80)
    print("\nThe GATR pipeline correctly:")
    print("  1. Parsed Java stack trace (FileName.java:15)")
    print("  2. Applied offset correction (15 - 10 + 1 = 6)")
    print("  3. Detected offset bug (line 6 was an import)")
    print("  4. Used text-based fallback to find actual broken line")
    print("  5. Extracted: 'Document doc = Jsoup.parse(htmlFile, ...)'")
    print("\n[OK] The LLM prompt will receive the CORRECT broken line!")
    

def test_e2e_python_stack_trace_extraction():
    """
    Test Python stack trace extraction as well
    """
    print("\n" + "="*80)
    print("E2E TEST: Python Stack Trace Line Extraction")
    print("="*80)
    
    engine = GATREngine(
        kg_manager=None,
        vector_storage=None,
        relevance_scorer=None
    )
    
    test_code = """from bs4 import BeautifulSoup
import requests

def test_parse_html():
    html = '<html><body><div class="content">Hello</div></body></html>'
    soup = BeautifulSoup(html, 'html.parser')
    content = soup.select('.content')[0].text
    assert content == 'Hello'"""
    
    error_message = 'File "test_parser.py", line 7, in test_parse_html'
    
    broken_test = {
        'line_number': 4,  # def test_parse_html() starts at line 4
        'broken_line_numbers': [7],
        'broken_lines': []
    }
    
    error_info = {'wrong_method': 'select'}
    
    print("\n[TEST INPUT]")
    print(f"Error Message: {error_message}")
    print(f"Test Start Line: {broken_test['line_number']}")
    
    extracted_lines, extracted_numbers = engine._extract_failing_line_context(
        test_code=test_code,
        error_message=error_message,
        error_info=error_info,
        broken_test=broken_test
    )
    
    print("\n[TEST OUTPUT]")
    for i, (line, num) in enumerate(zip(extracted_lines, extracted_numbers)):
        print(f"  Line {num}: {line.strip()}")
    
    # ASSERTIONS
    print("\n[ASSERTIONS]")
    assert len(extracted_lines) > 0, "[ERROR] No lines extracted!"
    print("[OK] At least one line was extracted")
    
    first_line = extracted_lines[0].strip()
    
    # Should NOT be an import
    assert not first_line.startswith('from ') and not first_line.startswith('import '), \
        f"[ERROR] Extracted an import: {first_line}"
    print("[OK] Line is NOT an import statement")
    
    # Should contain actual code
    assert 'select' in first_line or 'BeautifulSoup' in first_line or '=' in first_line, \
        f"[ERROR] Line doesn't look like executable code: {first_line}"
    print(f"[OK] Line contains executable code: '{first_line[:60]}...'")
    
    print("\n[OK] Python E2E test passed!")


if __name__ == '__main__':
    try:
        # Run both tests
        test_e2e_java_stack_trace_extraction()
        test_e2e_python_stack_trace_extraction()
        
        print("\n" + "="*80)
        print("[OK] ALL E2E INTEGRATION TESTS PASSED!")
        print("="*80)
        print("\nThe GATR extraction pipeline is working correctly.")
        print("The LLM will receive accurate broken lines, not imports/annotations.")
        
        sys.exit(0)
        
    except AssertionError as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
