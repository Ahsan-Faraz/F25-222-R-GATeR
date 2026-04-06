"""
AST-Based Query Builder for GATR
Extracts method calls, literals, and types from broken code lines
to formulate precise LanceDB queries instead of error-symptom queries
"""

import re
import logging
from typing import Dict, List, Tuple, Optional
from tree_sitter import Language, Parser, Node

logger = logging.getLogger(__name__)


class ASTQueryBuilder:
    """
    Builds semantic queries based on AST analysis of broken code
    instead of error message symptoms
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._parser = None
        self._language = None
    
    def extract_broken_line_ast(self, test_code: str, error_message: str, language: str = 'java', test_start_line: int = None) -> Dict:
        """
        Extract AST components from the broken line
        
        Args:
            test_code: The test method code (may be just method body, not full file)
            error_message: Stack trace with line number
            language: Programming language (java, python, etc.)
            test_start_line: Line number where test method starts in full file (for offset calculation)
        
        Returns:
            {
                'line_number': int,
                'broken_line': str,
                'method_calls': List[str],
                'literals': List[str],
                'variables': List[str],
                'types': List[str],
                'chain_pattern': str
            }
        """
        # Extract line number from error (this is the line in the FULL FILE)
        stack_trace_line = self._extract_line_number(error_message)
        
        # Get the broken line with offset correction
        broken_line = self._get_line_from_code(test_code, stack_trace_line, test_start_line)
        
        if not broken_line:
            self.logger.warning(f"Could not extract broken line from code (stack trace line: {stack_trace_line}, test start: {test_start_line})")
            return self._empty_ast_result()
        
        self.logger.info(f"[AST_QUERY] Analyzing broken line {stack_trace_line}: {broken_line[:100]}")
        
        # Extract AST components based on language
        if language.lower() == 'java':
            return self._extract_java_ast(broken_line, stack_trace_line)
        elif language.lower() == 'python':
            return self._extract_python_ast(broken_line, stack_trace_line)
        else:
            return self._extract_generic_ast(broken_line, stack_trace_line)
    
    def _extract_line_number(self, error_message: str) -> Optional[int]:
        """Extract line number from stack trace"""
        # Java pattern: at ClassName.methodName(FileName.java:123)
        java_match = re.search(r'\.java:(\d+)\)', error_message)
        if java_match:
            return int(java_match.group(1))
        
        # Python pattern: File "file.py", line 123
        python_match = re.search(r'line (\d+)', error_message)
        if python_match:
            return int(python_match.group(1))
        
        return None
    
    def _get_line_from_code(self, code: str, stack_trace_line: Optional[int], test_start_line: Optional[int] = None) -> Optional[str]:
        """
        Extract specific line from code with offset correction and text-based safety fallback.
        
        Strategy:
        1. Attempt offset math (absolute line → payload line)
        2. Safety check: Verify we didn't land on import/annotation
        3. Text-based fallback: Search for actual executable code
        """
        if not stack_trace_line:
            return None
        
        lines = code.split('\n')
        extracted = None
        
        # 1. Attempt Offset Math
        if test_start_line is not None:
            payload_line = stack_trace_line - test_start_line + 1
            self.logger.debug(
                f"[LINE_EXTRACTION] Offset math: {stack_trace_line} - {test_start_line} + 1 = {payload_line}"
            )
            if 1 <= payload_line <= len(lines):
                extracted = lines[payload_line - 1].strip()
                self.logger.debug(f"[LINE_EXTRACTION] Extracted via offset: '{extracted[:80]}'")
        else:
            # No offset available, use line number directly
            if 1 <= stack_trace_line <= len(lines):
                extracted = lines[stack_trace_line - 1].strip()
                self.logger.debug(f"[LINE_EXTRACTION] Extracted directly: '{extracted[:80]}'")
        
        # 2. CRITICAL SAFETY CHECK: Did we hit an import or annotation?
        if extracted and (
            extracted.startswith("import ") or 
            extracted.startswith("package ") or 
            extracted.startswith("@") or
            extracted.startswith("from ") or  # Python imports
            extracted.startswith("//") or     # Comments
            extracted.startswith("#") or      # Python comments
            extracted.startswith("/*")        # Block comments
        ):
            self.logger.warning(
                f"[LINE_EXTRACTION] OFFSET BUG DETECTED! Landed on: '{extracted[:80]}'"
            )
            self.logger.warning("[LINE_EXTRACTION] Triggering text-based fallback.")
            extracted = None  # Invalidate the bad extraction
        
        # 3. TEXT-BASED FALLBACK: If math failed or hit an import, search by method name
        if not extracted:
            self.logger.info("[LINE_EXTRACTION] Using text-based fallback search.")
            
            # We want the first line that actually looks like a method call/operation
            for line in lines:
                stripped = line.strip()
                
                # Skip comments, imports, annotations, and empty lines
                if not stripped or stripped.startswith(('/', '*', 'import ', 'package ', '@', '#', 'from ')):
                    continue
                
                # Skip class/method declarations (these are signatures, not the broken line)
                if stripped.startswith(('public ', 'private ', 'protected ', 'class ', 'interface ', 'enum ')):
                    # But check if it's a one-liner with actual code
                    if '{' not in stripped or stripped.count('{') != stripped.count('}'):
                        continue
                
                # Skip method signatures (void, def, etc.) - these end with : or { without body
                if re.match(r'^(public|private|protected)?\s*(static\s+)?(void|def|\w+)\s+\w+\s*\([^)]*\)\s*[:{]?\s*$', stripped):
                    continue
                
                # Skip Python function definitions (def name():)
                if stripped.startswith('def ') and stripped.endswith(':'):
                    continue
                
                # If it contains an assignment or method call, it's a valid candidate
                if '(' in stripped and ')' in stripped and not stripped.endswith((':',  '{')):
                    extracted = stripped
                    self.logger.info(f"[LINE_EXTRACTION] Fallback found actionable line: '{extracted[:80]}'")
                    break
                
                # Also accept lines with assignments (even without method calls)
                if '=' in stripped and not stripped.startswith(('=', '==')):
                    extracted = stripped
                    self.logger.info(f"[LINE_EXTRACTION] Fallback found assignment: '{extracted[:80]}'")
                    break
        
        if extracted:
            self.logger.info(f"[LINE_EXTRACTION] Final extracted line: '{extracted[:80]}'")
        else:
            self.logger.error("[LINE_EXTRACTION] Failed to extract any valid line")
        
        return extracted
    
    def _extract_java_ast(self, broken_line: str, line_number: int) -> Dict:
        """
        Extract AST components from Java code
        
        Example: items.select("active").first()
        Returns:
            method_calls: ['select', 'first']
            literals: ['active']
            chain_pattern: 'select().first()'
        """
        result = {
            'line_number': line_number,
            'broken_line': broken_line,
            'method_calls': [],
            'literals': [],
            'variables': [],
            'types': [],
            'chain_pattern': ''
        }
        
        # Extract method calls (method names followed by parentheses)
        method_pattern = r'\.(\w+)\s*\('
        method_calls = re.findall(method_pattern, broken_line)
        result['method_calls'] = method_calls
        
        # Extract string literals
        string_pattern = r'"([^"]+)"'
        literals = re.findall(string_pattern, broken_line)
        result['literals'] = literals
        
        # Extract variables (identifiers before dots)
        var_pattern = r'\b([a-z]\w*)\.'
        variables = re.findall(var_pattern, broken_line)
        result['variables'] = list(set(variables))
        
        # Extract types (capitalized identifiers)
        type_pattern = r'\b([A-Z]\w+)\b'
        types = re.findall(type_pattern, broken_line)
        result['types'] = list(set(types))
        
        # Build chain pattern
        if method_calls:
            result['chain_pattern'] = '.'.join([f"{m}()" for m in method_calls])
        
        self.logger.info(f"[AST_QUERY] Extracted: methods={method_calls}, literals={literals}, types={types}")
        
        return result
    
    def _extract_python_ast(self, broken_line: str, line_number: int) -> Dict:
        """Extract AST components from Python code"""
        result = {
            'line_number': line_number,
            'broken_line': broken_line,
            'method_calls': [],
            'literals': [],
            'variables': [],
            'types': [],
            'chain_pattern': ''
        }
        
        # Extract method calls
        method_pattern = r'\.(\w+)\s*\('
        method_calls = re.findall(method_pattern, broken_line)
        result['method_calls'] = method_calls
        
        # Extract string literals (both single and double quotes)
        string_pattern = r'["\']([^"\']+)["\']'
        literals = re.findall(string_pattern, broken_line)
        result['literals'] = literals
        
        # Extract variables
        var_pattern = r'\b([a-z_]\w*)\.'
        variables = re.findall(var_pattern, broken_line)
        result['variables'] = list(set(variables))
        
        # Build chain pattern
        if method_calls:
            result['chain_pattern'] = '.'.join([f"{m}()" for m in method_calls])
        
        return result
    
    def _extract_generic_ast(self, broken_line: str, line_number: int) -> Dict:
        """Fallback generic extraction"""
        return self._extract_java_ast(broken_line, line_number)
    
    def _empty_ast_result(self) -> Dict:
        """Return empty AST result"""
        return {
            'line_number': None,
            'broken_line': '',
            'method_calls': [],
            'literals': [],
            'variables': [],
            'types': [],
            'chain_pattern': ''
        }
    
    def build_semantic_query(self, ast_components: Dict, error_message: str) -> str:
        """
        Build a semantic query based on AST components
        instead of error symptoms
        
        Priority:
        1. Method calls + literals (most specific)
        2. Method calls + types
        3. Method calls only
        4. Fallback to error message
        """
        method_calls = ast_components.get('method_calls', [])
        literals = ast_components.get('literals', [])
        types = ast_components.get('types', [])
        chain_pattern = ast_components.get('chain_pattern', '')
        
        # Strategy 1: Method + Literal (most precise)
        if method_calls and literals:
            primary_method = method_calls[0]
            primary_literal = literals[0]
            query = f"API documentation for {primary_method} method with argument '{primary_literal}' usage examples"
            self.logger.info(f"[AST_QUERY] Strategy 1 (Method+Literal): {query}")
            return query
        
        # Strategy 2: Method + Type
        if method_calls and types:
            primary_method = method_calls[0]
            primary_type = types[0]
            query = f"{primary_type} class {primary_method} method documentation and examples"
            self.logger.info(f"[AST_QUERY] Strategy 2 (Method+Type): {query}")
            return query
        
        # Strategy 3: Method chain pattern
        if chain_pattern:
            query = f"method chaining pattern {chain_pattern} usage examples"
            self.logger.info(f"[AST_QUERY] Strategy 3 (Chain): {query}")
            return query
        
        # Strategy 4: Method only
        if method_calls:
            primary_method = method_calls[0]
            query = f"{primary_method} method documentation usage examples"
            self.logger.info(f"[AST_QUERY] Strategy 4 (Method): {query}")
            return query
        
        # Fallback: Use error message (old behavior)
        self.logger.warning(f"[AST_QUERY] Fallback to error-based query")
        return error_message
    
    def extract_exact_terms(self, ast_components: Dict) -> List[str]:
        """
        Extract exact terms for FTS (Full Text Search) boosting
        
        Returns terms that should be matched literally in entity names
        """
        exact_terms = []
        
        # Add method calls (highest priority)
        exact_terms.extend(ast_components.get('method_calls', []))
        
        # Add types
        exact_terms.extend(ast_components.get('types', []))
        
        # Add variables (lower priority)
        exact_terms.extend(ast_components.get('variables', []))
        
        self.logger.info(f"[AST_QUERY] Exact terms for FTS: {exact_terms}")
        
        return exact_terms
