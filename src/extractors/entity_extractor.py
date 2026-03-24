"""
Entity Extractor Module
Processes parsed code to extract and normalize entities
"""

import logging
import os
from typing import Dict, List, Set, Optional
from pathlib import Path
import re

logger = logging.getLogger('gater.extractor')
CAMEL_PARTS_RE = re.compile(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)')

class Entity:
    """Represents a code entity (class, function, import, etc.)"""
    
    def __init__(self, id: str, name: str, entity_type: str, file_path: str, **kwargs):
        self.id = id
        self.name = name
        self.type = entity_type
        self.file_path = file_path
        self.properties = kwargs
        
    def to_dict(self) -> Dict:
        """Convert entity to dictionary representation"""
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'file_path': self.file_path,
            **self.properties
        }

class Relationship:
    """Represents a relationship between entities"""
    
    def __init__(self, source_id: str, target_id: str, rel_type: str, **kwargs):
        self.source_id = source_id
        self.target_id = target_id
        self.type = rel_type
        self.properties = kwargs
        
    def to_dict(self) -> Dict:
        """Convert relationship to dictionary representation"""
        return {
            'source': self.source_id,
            'target': self.target_id,
            'type': self.type,
            **self.properties
        }

class EntityExtractor:
    """
    Extracts and normalizes entities and relationships from parsed code
    """
    
    def __init__(self):
        self.entities = {}
        self.relationships = []
        self.file_to_entities = {}
        self.name_index: Dict[str, List[str]] = {}
        self.name_type_index: Dict[tuple, List[str]] = {}
        self.type_index: Dict[str, Set[str]] = {}
        self.file_name_index: Dict[str, Dict[str, str]] = {}
        self.file_callable_entities: Dict[str, List[str]] = {}
        self.package_index: Dict[str, Set[str]] = {}
        self.suffix_index: Dict[str, List[str]] = {}

    def _reset_state(self):
        """Reset extraction state and all lookup indexes."""
        self.entities.clear()
        self.relationships.clear()
        self.file_to_entities.clear()
        self.name_index.clear()
        self.name_type_index.clear()
        self.type_index.clear()
        self.file_name_index.clear()
        self.file_callable_entities.clear()
        self.package_index.clear()
        self.suffix_index.clear()

    def _register_entity(self, entity: Entity, file_path: Optional[str] = None):
        """Register an entity and update all relevant indexes."""
        self.entities[entity.id] = entity

        self.name_index.setdefault(entity.name, []).append(entity.id)
        self.name_type_index.setdefault((entity.name, entity.type), []).append(entity.id)
        self.type_index.setdefault(entity.type, set()).add(entity.id)

        suffix = entity.name.rsplit('.', 1)[-1] if entity.name else ''
        if suffix:
            self.suffix_index.setdefault(suffix, []).append(entity.id)

        effective_file = file_path if file_path is not None else entity.file_path
        if effective_file:
            self.file_to_entities.setdefault(effective_file, [])
            self.file_name_index.setdefault(effective_file, {})
            self.file_callable_entities.setdefault(effective_file, [])

            if file_path is not None and entity.id not in self.file_to_entities[effective_file]:
                self.file_to_entities[effective_file].append(entity.id)
                # Preserve the first hit for a given name in file-local lookups.
                self.file_name_index[effective_file].setdefault(entity.name, entity.id)

                if entity.type in {'function', 'method', 'test'}:
                    self.file_callable_entities[effective_file].append(entity.id)

            package_key = Path(effective_file).parent.as_posix()
            self.package_index.setdefault(package_key, set()).add(entity.id)

    def _candidate_ids_by_name(self, name: str, allowed_types: Optional[Set[str]] = None) -> List[str]:
        """Fast lookup for entity IDs by name with optional type filtering."""
        ids = self.name_index.get(name, [])
        if not allowed_types:
            return ids
        return [eid for eid in ids if self.entities[eid].type in allowed_types]

    def _find_global_entity_by_name(self, name: str, allowed_types: Optional[Set[str]] = None) -> Optional[str]:
        """Return the first global entity ID matching name and optional types."""
        ids = self._candidate_ids_by_name(name, allowed_types)
        return ids[0] if ids else None
        
    def extract_entities(self, parsed_data: Dict) -> Dict:
        """Extract entities and relationships from parsed project data"""
        logger.info("Starting entity extraction")
        
        # Clear previous data
        self._reset_state()
        
        project_path = parsed_data.get('project_path', '')
        files_data = parsed_data.get('files', {})
        
        # First pass: extract all entities
        for file_path, file_data in files_data.items():
            self._extract_file_entities(file_path, file_data, project_path)
        
        # Second pass: extract relationships
        for file_path, file_data in files_data.items():
            self._extract_file_relationships(file_path, file_data)
        
        logger.info(f"Extracted {len(self.entities)} entities and {len(self.relationships)} relationships")
        
        return {
            'entities': [entity.to_dict() for entity in self.entities.values()],
            'relationships': [rel.to_dict() for rel in self.relationships]
        }
    
    def extract_github_entities(self, github_data: Dict) -> Dict:
        """Extract entities from GitHub artifacts"""
        logger.info("Extracting GitHub entities")
        
        entities = []
        relationships = []
        
        # Extract repository entity
        repo_info = github_data.get('repository', {})
        if repo_info and 'full_name' in repo_info:
            repo_entity = Entity(
                id=f"repo_{repo_info['full_name']}",
                name=repo_info.get('name', 'Unknown'),
                entity_type='repository',
                file_path='',
                owner=repo_info.get('owner', 'Unknown'),
                description=repo_info.get('description', ''),
                language=repo_info.get('language', ''),
                stars=repo_info.get('stars', 0),
                forks=repo_info.get('forks', 0)
            )
            entities.append(repo_entity.to_dict())
        elif repo_info and 'error' not in repo_info:
            # Fallback for incomplete repository info
            repo_name = f"{repo_info.get('owner', 'unknown')}/{repo_info.get('name', 'unknown')}"
            repo_entity = Entity(
                id=f"repo_{repo_name}",
                name=repo_info.get('name', 'Unknown Repository'),
                entity_type='repository',
                file_path='',
                owner=repo_info.get('owner', 'Unknown'),
                description=repo_info.get('description', ''),
                language=repo_info.get('language', ''),
                stars=repo_info.get('stars', 0),
                forks=repo_info.get('forks', 0)
            )
            entities.append(repo_entity.to_dict())
        
        # Extract pull requests
        for pr in github_data.get('pulls', []):
            pr_entity = Entity(
                id=f"pr_{pr['number']}",
                name=f"PR #{pr['number']}: {pr['title']}",
                entity_type='pull_request',
                file_path='',
                number=pr['number'],
                title=pr['title'],
                body=pr['body'],
                state=pr['state'],
                author=pr['author'],
                created_at=pr['created_at'],
                merged_at=pr['merged_at'],
                files_changed=pr.get('files_changed', [])
            )
            entities.append(pr_entity.to_dict())
            
            # Create relationships to modified files
            for file_path in pr.get('files_changed', []):
                if file_path.endswith('.py'):
                    file_id = self._generate_file_id(file_path)
                    rel = Relationship(
                        source_id=pr_entity.id,
                        target_id=file_id,
                        rel_type='MODIFIES'
                    )
                    relationships.append(rel.to_dict())
        
        # Extract issues
        for issue in github_data.get('issues', []):
            issue_entity = Entity(
                id=f"issue_{issue['number']}",
                name=f"Issue #{issue['number']}: {issue['title']}",
                entity_type='issue',
                file_path='',
                number=issue['number'],
                title=issue['title'],
                body=issue['body'],
                state=issue['state'],
                author=issue['author'],
                created_at=issue['created_at'],
                labels=issue.get('labels', [])
            )
            entities.append(issue_entity.to_dict())
        
        # Extract commits
        for commit in github_data.get('commits', []):
            commit_entity = Entity(
                id=f"commit_{commit['sha'][:8]}",
                name=f"Commit {commit['sha'][:8]}: {commit['message'][:50]}...",
                entity_type='commit',
                file_path='',
                sha=commit['sha'],
                message=commit['message'],
                author=commit['author'],
                date=commit['date'],
                files_changed=commit.get('files_changed', [])
            )
            entities.append(commit_entity.to_dict())
            
            # Create relationships to modified files
            for file_path in commit.get('files_changed', []):
                ext = os.path.splitext(file_path)[1].lower()
                if ext in ('.py', '.java', '.kt', '.js', '.ts', '.c', '.cpp', '.go', '.rs'):
                    file_id = self._generate_file_id(file_path)
                    rel = Relationship(
                        source_id=commit_entity.id,
                        target_id=file_id,
                        rel_type='MODIFIES'
                    )
                    relationships.append(rel.to_dict())
        
        logger.info(f"Extracted {len(entities)} GitHub entities and {len(relationships)} relationships")
        
        return {
            'entities': entities,
            'relationships': relationships
        }
    
    def _extract_file_entities(self, file_path: str, file_data: Dict, project_path: str):
        """Extract entities from a single file"""
        file_id = self._generate_file_id(file_path)
        
        # Create file entity
        file_entity = Entity(
            id=file_id,
            name=Path(file_path).name,
            entity_type='file',
            file_path=file_path,
            full_path=file_path
        )
        self._register_entity(file_entity)
        self.file_to_entities[file_path] = []
        self.file_name_index[file_path] = {}
        self.file_callable_entities[file_path] = []
        
        # Extract classes
        for class_data in file_data.get('classes', []):
            class_id = self._generate_entity_id(file_path, 'class', class_data['name'])
            class_entity = Entity(
                id=class_id,
                name=class_data['name'],
                entity_type='class',
                file_path=file_path,
                line_start=class_data.get('line_start'),
                line_end=class_data.get('line_end'),
                methods=class_data.get('methods', []),
                base_classes=class_data.get('base_classes', [])
            )
            self._register_entity(class_entity, file_path=file_path)
            
            # Create BELONGS_TO relationship
            rel = Relationship(class_id, file_id, 'BELONGS_TO')
            self.relationships.append(rel)
        
        # Extract functions
        for func_data in file_data.get('functions', []):
            func_id = self._generate_entity_id(file_path, 'function', func_data['name'])
            func_entity = Entity(
                id=func_id,
                name=func_data['name'],
                entity_type='function',
                file_path=file_path,
                line_start=func_data.get('line_start'),
                line_end=func_data.get('line_end'),
                parameters=func_data.get('parameters', []),
                is_test=func_data.get('is_test', False)
            )
            self._register_entity(func_entity, file_path=file_path)
            
            # Create BELONGS_TO relationship
            rel = Relationship(func_id, file_id, 'BELONGS_TO')
            self.relationships.append(rel)
        
        # Extract test functions
        for test_data in file_data.get('tests', []):
            test_id = self._generate_entity_id(file_path, 'test', test_data['name'])
            test_entity = Entity(
                id=test_id,
                name=test_data['name'],
                entity_type='test',
                file_path=file_path,
                line_start=test_data.get('line_start'),
                line_end=test_data.get('line_end'),
                parameters=test_data.get('parameters', []),
                is_test=True
            )
            self._register_entity(test_entity, file_path=file_path)
            
            # Create BELONGS_TO relationship
            rel = Relationship(test_id, file_id, 'BELONGS_TO')
            self.relationships.append(rel)
        
        # Extract imports
        for import_data in file_data.get('imports', []):
            for module in import_data.get('modules', []):
                import_id = self._generate_entity_id(file_path, 'import', module)
                import_entity = Entity(
                    id=import_id,
                    name=module,
                    entity_type='import',
                    file_path=file_path,
                    import_type=import_data['type'],
                    from_module=import_data.get('from_module'),
                    line=import_data.get('line')
                )
                self._register_entity(import_entity, file_path=file_path)
                
                # Create BELONGS_TO relationship
                rel = Relationship(import_id, file_id, 'BELONGS_TO')
                self.relationships.append(rel)
    
    def _extract_file_relationships(self, file_path: str, file_data: Dict):
        """Extract relationships from a single file"""
        
        # Extract import relationships
        for import_data in file_data.get('imports', []):
            for module in import_data.get('modules', []):
                import_id = self._generate_entity_id(file_path, 'import', module)
                
                # Try to find the imported module/entity
                target_entity = self._find_imported_entity(module, import_data.get('from_module'))
                if target_entity:
                    rel = Relationship(import_id, target_entity, 'IMPORTS')
                    self.relationships.append(rel)
        
        # Extract function call relationships
        for call_data in file_data.get('calls', []):
            func_name = call_data.get('function')
            if func_name:
                # Find the calling entity (function/method containing this call)
                calling_entity = self._find_entity_at_line(file_path, call_data.get('line'))
                
                # Find the called entity
                called_entity = self._find_called_entity(func_name, file_path)
                
                if calling_entity and called_entity:
                    rel = Relationship(calling_entity, called_entity, 'CALLS')
                    self.relationships.append(rel)
        
        # Extract CREATES relationships
        for creates_data in file_data.get('creates', []):
            creator_context = creates_data.get('creator_context')
            created_object = creates_data.get('created_object')
            
            if creator_context and created_object:
                # Find the creator entity (function/method)
                creator_entity = self._find_entity_by_name(file_path, creator_context)
                
                # Find or create the created entity
                created_entity = self._find_or_create_entity(created_object, file_path, 'class')
                
                if creator_entity and created_entity:
                    rel = Relationship(
                        creator_entity, 
                        created_entity, 
                        'CREATES',
                        line=creates_data.get('line'),
                        call_text=creates_data.get('call_text')
                    )
                    self.relationships.append(rel)
        
        # Extract USES relationships
        for uses_data in file_data.get('uses', []):
            user_context = uses_data.get('user_context')
            used_resource = uses_data.get('used_resource')
            
            if user_context and used_resource:
                # Find the user entity (function/method)
                user_entity = self._find_entity_by_name(file_path, user_context)
                
                # Find or create the used resource entity
                used_entity = self._find_or_create_entity(used_resource, file_path, 'resource')
                
                if user_entity and used_entity:
                    rel = Relationship(
                        user_entity, 
                        used_entity, 
                        'USES',
                        line=uses_data.get('line'),
                        call_text=uses_data.get('call_text')
                    )
                    self.relationships.append(rel)
        
        # Extract test relationships
        for test_data in file_data.get('tests', []):
            test_id = self._generate_entity_id(file_path, 'test', test_data['name'])
            
            # Infer what this test is testing based on naming patterns
            tested_entity = self._infer_tested_entity(test_data['name'], file_path)
            if tested_entity:
                rel = Relationship(test_id, tested_entity, 'TESTS')
                self.relationships.append(rel)
    
    def _find_entity_by_name(self, file_path: str, entity_name: str) -> Optional[str]:
        """Find an entity by name within a specific file"""
        return self.file_name_index.get(file_path, {}).get(entity_name)
    
    def _find_or_create_entity(self, entity_name: str, file_path: str, entity_type: str) -> str:
        """Find an existing entity or create a new placeholder entity"""
        # First, try to find an existing entity with this name
        existing = self._find_global_entity_by_name(entity_name, {'class', 'function', 'resource'})
        if existing:
            return existing
        
        # If not found, create a placeholder entity
        placeholder_id = self._generate_entity_id(file_path, f"placeholder_{entity_type}", entity_name)
        placeholder_entity = Entity(
            id=placeholder_id,
            name=entity_name,
            entity_type=entity_type,
            file_path=file_path,
            is_placeholder=True
        )
        self._register_entity(placeholder_entity, file_path=file_path)
        
        return placeholder_id
    
    def _generate_entity_id(self, file_path: str, entity_type: str, name: str) -> str:
        """Generate unique entity ID"""
        clean_path = file_path.replace('/', '_').replace('\\', '_').replace('.', '_')
        return f"{clean_path}_{entity_type}_{name}"
    
    def _generate_file_id(self, file_path: str) -> str:
        """Generate file entity ID"""
        clean_path = file_path.replace('/', '_').replace('\\', '_').replace('.', '_')
        return f"file_{clean_path}"
    
    def _find_imported_entity(self, module: str, from_module: Optional[str]) -> Optional[str]:
        """Find the entity being imported"""
        # Fast exact-name lookup first.
        direct = self._find_global_entity_by_name(module)
        if direct:
            return direct

        # Then suffix lookup for dotted names (e.g. pkg.mod.Class -> Class).
        for entity_id in self.suffix_index.get(module, []):
            return entity_id
        
        # If not found, create a placeholder external module entity
        if from_module:
            module_name = f"{from_module}.{module}"
        else:
            module_name = module
            
        external_id = f"external_module_{module_name.replace('.', '_')}"
        if external_id not in self.entities:
            external_entity = Entity(
                id=external_id,
                name=module_name,
                entity_type='external_module',
                file_path='',
                is_external=True
            )
            self._register_entity(external_entity)
        
        return external_id
    
    def _find_entity_at_line(self, file_path: str, line: int) -> Optional[str]:
        """Find the entity (function/method) containing the given line"""
        for entity_id in self.file_callable_entities.get(file_path, []):
            entity = self.entities[entity_id]
            line_start = entity.properties.get('line_start', 0)
            line_end = entity.properties.get('line_end', 0)
            if line_start <= line <= line_end:
                return entity_id
        return None
    
    def _find_called_entity(self, func_name: str, calling_file: str) -> Optional[str]:
        """Find the entity being called"""
        # First, look in the same file
        local = self.file_name_index.get(calling_file, {}).get(func_name)
        if local:
            return local
        
        # Then, look in other files
        global_match = self._find_global_entity_by_name(func_name, {'function', 'method', 'class'})
        if global_match:
            return global_match
        
        # If not found, create a placeholder
        placeholder_id = f"unknown_function_{func_name}"
        if placeholder_id not in self.entities:
            placeholder_entity = Entity(
                id=placeholder_id,
                name=func_name,
                entity_type='unknown_function',
                file_path='',
                is_placeholder=True
            )
            self._register_entity(placeholder_entity)
        
        return placeholder_id
    
    def _infer_tested_entity(self, test_name: str, file_path: str) -> Optional[str]:
        """Infer what entity a test is testing based on naming patterns"""
        # Enhanced Java test detection patterns
        tested_name = test_name
        base_function_patterns = []
        
        # Java JUnit patterns
        if tested_name.startswith('test'):
            # testMethodName -> methodName
            if tested_name.startswith('testShould'):
                # testShouldCalculateSum -> calculateSum
                tested_name = tested_name[10:]  # Remove 'testShould'
            elif tested_name.startswith('test'):
                tested_name = tested_name[4:]  # Remove 'test'
                
        # Handle camelCase conversion
        if tested_name:
            # Convert first letter to lowercase for Java method names
            tested_name = tested_name[0].lower() + tested_name[1:] if len(tested_name) > 1 else tested_name.lower()
        
        # Python patterns
        if tested_name.startswith('test_'):
            tested_name = tested_name[5:]
        elif tested_name.endswith('_test'):
            tested_name = tested_name[:-5]
        
        # Generate multiple pattern candidates
        if tested_name:
            base_function_patterns.append(tested_name)
            
            # Handle compound test names
            if '_' in tested_name:
                parts = tested_name.split('_')
                # Try progressively shorter combinations
                for i in range(1, len(parts) + 1):
                    base_function_patterns.append('_'.join(parts[:i]))
            
            # Handle camelCase breakdown
            camel_parts = CAMEL_PARTS_RE.findall(tested_name)
            if len(camel_parts) > 1:
                # calculateSumWithTax -> calculateSum, calculate
                for i in range(1, len(camel_parts) + 1):
                    pattern = ''.join(camel_parts[:i])
                    pattern = pattern[0].lower() + pattern[1:] if pattern else pattern
                    base_function_patterns.append(pattern)

        # Deduplicate while preserving order
        base_function_patterns = list(dict.fromkeys(base_function_patterns))
        
        # Enhanced matching with class context
        test_file_class = self._get_test_class_name(file_path)
        production_class = self._infer_production_class(test_file_class, file_path)
        same_package_entities = set(self._find_same_package_entities(file_path))
        
        # Look for matching function/method/class with priority order
        for pattern in base_function_patterns:
            # 1. Look in corresponding production class first
            if production_class:
                for entity_id in self.name_type_index.get((production_class, 'class'), []):
                    cls_entity = self.entities[entity_id]
                    if 'test' in cls_entity.file_path.lower():
                        continue
                    cls_pkg = Path(cls_entity.file_path).parent.as_posix()
                    for candidate_id in self._candidate_ids_by_name(pattern, {'function', 'method'}):
                        candidate = self.entities[candidate_id]
                        if Path(candidate.file_path).parent.as_posix() == cls_pkg:
                            return candidate_id
            
            # 2. Look in same package/directory
            for entity_id in same_package_entities:
                entity = self.entities[entity_id]
                if (entity.name == pattern and 
                    entity.type in ['function', 'method', 'class']):
                    return entity_id
            
            # 3. Look in same file
            local = self.file_name_index.get(file_path, {}).get(pattern)
            if local and self.entities[local].type in ['function', 'method', 'class']:
                return local
            
            # 4. Global search as fallback
            global_candidate = self._find_global_entity_by_name(pattern, {'function', 'method', 'class'})
            if global_candidate:
                return global_candidate
        
        # Special case: for web/API tests, look for functions that might handle the tested functionality
        # e.g., test_predict_* tests might test predict() function
        if 'predict' in tested_name.lower():
            predict_candidate = self._find_global_entity_by_name('predict', {'function', 'method'})
            if predict_candidate:
                return predict_candidate
        
        # Try common test patterns
        pattern_mappings = {
            'login': ['login', 'authenticate', 'auth'],
            'save': ['save', 'store', 'persist'],
            'load': ['load', 'read', 'fetch'],
            'create': ['create', 'add', 'new'],
            'update': ['update', 'modify', 'edit'],
            'delete': ['delete', 'remove', 'destroy']
        }
        
        for key, candidates in pattern_mappings.items():
            if key in tested_name.lower():
                for candidate in candidates:
                    entity_id = self._find_global_entity_by_name(candidate, {'function', 'method', 'class'})
                    if entity_id:
                        return entity_id
        
        return None
    
    def _get_test_class_name(self, file_path: str) -> Optional[str]:
        """Extract the test class name from file path"""
        try:
            # Extract class name from file path
            # e.g., src/test/java/org/jsoup/parser/XmlTreeBuilderTest.java -> XmlTreeBuilderTest
            file_name = Path(file_path).stem
            return file_name
        except:
            return None
    
    def _infer_production_class(self, test_class_name: str, test_file_path: str) -> Optional[str]:
        """Infer the production class name from test class name"""
        if not test_class_name:
            return None
            
        # Common Java test naming patterns
        production_class_candidates = []
        
        if test_class_name.endswith('Test'):
            # XmlTreeBuilderTest -> XmlTreeBuilder
            production_class_candidates.append(test_class_name[:-4])
        elif test_class_name.endswith('Tests'):
            # XmlTreeBuilderTests -> XmlTreeBuilder
            production_class_candidates.append(test_class_name[:-5])
        elif test_class_name.startswith('Test'):
            # TestXmlTreeBuilder -> XmlTreeBuilder
            production_class_candidates.append(test_class_name[4:])
        
        # Also try the full name in case it's not following standard patterns
        production_class_candidates.append(test_class_name)
        
        # Look for matching production classes
        for candidate in production_class_candidates:
            for entity_id in self.name_type_index.get((candidate, 'class'), []):
                entity = self.entities[entity_id]
                if 'test' not in entity.file_path.lower():
                    return candidate
        
        return None
    
    def _find_same_package_entities(self, file_path: str) -> List[str]:
        """Find entities in the same package/directory structure"""
        try:
            # Convert test path to production path
            # src/test/java/org/jsoup/parser/ -> src/main/java/org/jsoup/parser/
            norm_path = Path(file_path).as_posix()
            path_parts = Path(norm_path).parts
            
            if 'test' in path_parts:
                # Create production path pattern
                production_parts = []
                for part in path_parts:
                    if part == 'test':
                        production_parts.append('main')
                    else:
                        production_parts.append(part)
                
                production_path_pattern = '/'.join(production_parts[:-1])  # Remove filename
                
                # Find entities in similar path structure
                same_package_entities: List[str] = []

                # Exact package match fast path.
                exact_ids = self.package_index.get(production_path_pattern, set())
                for entity_id in exact_ids:
                    entity = self.entities[entity_id]
                    if entity.type in ['function', 'method', 'class']:
                        same_package_entities.append(entity_id)

                if same_package_entities:
                    return same_package_entities

                # Prefix-based fallback for nested package structures.
                for pkg, ids in self.package_index.items():
                    if production_path_pattern in pkg:
                        for entity_id in ids:
                            entity = self.entities[entity_id]
                            if entity.type in ['function', 'method', 'class']:
                                same_package_entities.append(entity_id)

                return same_package_entities
        except:
            pass
        
        return []