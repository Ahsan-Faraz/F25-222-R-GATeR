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
    
    def extract_broken_line_ast(self, test_code: str, error_message: str, language: str = 'java') -> Dict:
        """
        Extract AST components from the broken line
        
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
        # Extract line number from error
        line_number = self._extract_line_number(error_message)
        
        # Get the broken line
        broken_line = self._get_line_from_code(test_code, line_number)
        
        if not broken_line:
            self.logger.warning(f"Could not extract broken line from code")
            return self._empty_ast_result()
        
        self.logger.info(f"[AST_QUERY] Analyzing broken line {line_number}: {broken_line[:100]}")
        
        # Extract AST components based on language
        if language.lower() == 'java':
            return self._extract_java_ast(broken_line, line_number)
        elif language.lower() == 'python':
            return self._extract_python_ast(broken_line, line_number)
        else:
            return self._extract_generic_ast(broken_line, line_number)
    
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
    
    def _get_line_from_code(self, code: str, line_number: Optional[int]) -> Optional[str]:
        """Extract specific line from code"""
        if not line_number:
            return None
        
        lines = code.split('\n')
        if 1 <= line_number <= len(lines):
            return lines[line_number - 1].strip()
        
        return None
    
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
