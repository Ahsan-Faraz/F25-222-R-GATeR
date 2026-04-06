# GATR Architecture Review

**Last Updated**: 2026-04-07  
**Purpose**: High-level system architecture, component interactions, and data flow

---

## System Overview

GATR (Graph-Aware Test Repair) is an automated test repair system that combines:
- **Knowledge Graphs** (Kuzu) for relationship modeling
- **Vector Embeddings** (LanceDB) for semantic search
- **AST Analysis** (Tree-sitter) for code understanding
- **LLM Generation** (Qwen 2.5 Coder) for repair synthesis

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GATR SYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │   GitHub     │────────▶│  Repository  │                     │
│  │   API        │         │   Parser     │                     │
│  └──────────────┘         └──────┬───────┘                     │
│                                   │                              │
│                                   ▼                              │
│                          ┌────────────────┐                     │
│                          │  Tree-sitter   │                     │
│                          │  AST Analysis  │                     │
│                          └────────┬───────┘                     │
│                                   │                              │
│                    ┌──────────────┴──────────────┐             │
│                    ▼                              ▼             │
│           ┌─────────────────┐          ┌──────────────────┐   │
│           │  Entity         │          │  Relationship    │   │
│           │  Extraction     │          │  Extraction      │   │
│           └────────┬────────┘          └────────┬─────────┘   │
│                    │                             │              │
│                    ▼                             ▼              │
│           ┌─────────────────┐          ┌──────────────────┐   │
│           │  KGCompass      │          │  Kuzu Graph DB   │   │
│           │  Scoring        │          │  (Relationships) │   │
│           └────────┬────────┘          └────────┬─────────┘   │
│                    │                             │              │
│                    ▼                             │              │
│           ┌─────────────────┐                   │              │
│           │  Code Snippet   │                   │              │
│           │  Extraction     │                   │              │
│           └────────┬────────┘                   │              │
│                    │                             │              │
│                    ▼                             │              │
│           ┌─────────────────┐                   │              │
│           │  LanceDB        │                   │              │
│           │  (Code+Vectors) │                   │              │
│           └────────┬────────┘                   │              │
│                    │                             │              │
│                    └──────────┬──────────────────┘             │
│                               │                                 │
│                               ▼                                 │
│                    ┌──────────────────────┐                    │
│                    │  Test Repair Engine  │                    │
│                    └──────────┬───────────┘                    │
│                               │                                 │
│              ┌────────────────┼────────────────┐              │
│              ▼                ▼                ▼              │
│     ┌────────────────┐ ┌────────────┐ ┌────────────────┐    │
│     │  Vector Search │ │  Graph     │ │  Line          │    │
│     │  (Flow A)      │ │  Traversal │ │  Extraction    │    │
│     │                │ │  (Flow B)  │ │  (AST-based)   │    │
│     └────────┬───────┘ └─────┬──────┘ └────────┬───────┘    │
│              │                │                 │              │
│              └────────────────┼─────────────────┘             │
│                               ▼                                 │
│                    ┌──────────────────────┐                    │
│                    │  Context Compression │                    │
│                    │  & Aggregation       │                    │
│                    └──────────┬───────────┘                    │
│                               │                                 │
│                               ▼                                 │
│                    ┌──────────────────────┐                    │
│                    │  Pipeline Merge      │                    │
│                    └──────────┬───────────┘                    │
│                               │                                 │
│                               ▼                                 │
│                    ┌──────────────────────┐                    │
│                    │  Prompt Generation   │                    │
│                    └──────────┬───────────┘                    │
│                               │                                 │
│                               ▼                                 │
│                    ┌──────────────────────┐                    │
│                    │  LM Studio API       │                    │
│                    │  (Qwen 2.5 Coder)    │                    │
│                    └──────────┬───────────┘                    │
│                               │                                 │
│                               ▼                                 │
│                    ┌──────────────────────┐                    │
│                    │  Repaired Code       │                    │
│                    └──────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Data Layer

#### 1.1 Kuzu Graph Database
```
Purpose: Store entity relationships
Schema:
  - Nodes: Function, Class, Method, Test, Field
  - Edges: CALLS, MODIFIES, TESTS, USES, RETURNS, THROWS, BELONGS_TO
Storage: Columnar format, optimized for graph traversal
Query: Cypher-like query language
Performance: Sub-second multi-hop queries
```

#### 1.2 LanceDB Vector Store
```
Purpose: Store code snippets with embeddings
Schema:
  - entity_id: Unique identifier
  - entity_name: Name of entity
  - entity_type: Type (function, class, etc.)
  - code_snippet: Actual source code
  - embedding: 384-dim vector
  - metadata: file_path, line_start, line_end, etc.
Storage: Columnar format with vector index
Query: Cosine similarity search
Performance: <100ms for top-20 search
```

#### 1.3 File System
```
Purpose: Fallback source for code extraction
Structure:
  - workspace/repos/<project>/: Cloned repositories
  - workspace/data/: Extracted entities and graphs
  - workspace/kuzu_db/: Kuzu database files
  - workspace/lancedb/: LanceDB table files
Access: Direct file I/O for snippet extraction
```

### 2. Ingestion Layer

#### 2.1 Repository Parser
```
Technology: GitPython + PyGithub
Responsibilities:
  - Clone repositories from GitHub
  - Track repository state (commits, branches)
  - Detect changes for incremental updates
  - Extract Git metadata (commits, PRs, issues)
```

#### 2.2 AST Parser
```
Technology: Tree-sitter
Supported Languages: Java, Python, JavaScript, C++
Responsibilities:
  - Parse source files into AST
  - Extract entities (classes, methods, functions)
  - Extract relationships (calls, imports, modifies)
  - Capture location info (file, line numbers)
```

#### 2.3 Entity Extractor
```
Input: AST from Tree-sitter
Output: Structured entities
Extraction:
  - Classes: name, fields, methods, superclass
  - Methods: name, parameters, return type, body
  - Functions: name, parameters, body
  - Tests: test methods, assertions
  - Fields: name, type, initializer
```

#### 2.4 Relationship Extractor
```
Input: AST + entities
Output: Typed relationships
Extraction:
  - CALLS: Method A calls Method B
  - MODIFIES: Commit C modifies Entity E
  - TESTS: Test T tests Entity E
  - USES: Entity A uses Entity B
  - RETURNS: Method M returns Type T
  - THROWS: Method M throws Exception E
  - BELONGS_TO: Method M belongs to Class C
```

### 3. Scoring Layer

#### 3.1 KGCompass Relevance Scorer
```
Algorithm: Hybrid scoring
Inputs:
  - Entity metadata
  - Graph structure
  - Issue/error description
Scoring:
  - Semantic similarity (embedding cosine)
  - Textual similarity (Levenshtein)
  - Path decay (graph distance)
Formula: S(f) = β^l(f) * (α*cos + (1-α)*lev)
Output: Ranked entities with scores
```

#### 3.2 Embedding Generator
```
Model: sentence-transformers/all-MiniLM-L6-v2
Input: Entity text (name + type + context)
Output: 384-dim embedding vector
Batch Size: 32 entities
Performance: ~100 entities/second
```

### 4. Retrieval Layer

#### 4.1 Vector Search Engine
```
Technology: LanceDB
Query: Semantic similarity search
Input: Error message + test code
Process:
  1. Generate query embedding
  2. Cosine similarity search
  3. Return top-k entities with code
Output: 20 entities, 100% with snippets
Performance: <100ms
```

#### 4.2 Graph Traversal Engine
```
Technology: Kuzu + NetworkX
Query: Multi-hop graph traversal
Input: Test entity ID
Process:
  1. Find test node in graph
  2. Traverse CALLS, MODIFIES, TESTS edges
  3. Collect connected entities (up to 3 hops)
  4. Score by keyword overlap
Output: 120 entities, 0% with snippets (Kuzu has no code)
Performance: <500ms
```

#### 4.3 Snippet Extraction Engine
```
Strategy: 3-tier fallback
Tier 1: LanceDB cross-reference (instant)
Tier 2: Targeted LanceDB lookup (100ms)
Tier 3: File system extraction (500ms)
Success Rate: 90-100%
Performance: Average 150ms per entity
```

### 5. Processing Layer

#### 5.1 Context Compressor
```
Input: 160 raw entities
Process:
  1. Hybrid scoring (KG + semantic)
  2. Entity filtering (score, type, connectivity)
  3. Snippet compression (max 15 lines)
  4. Pattern compression (usage examples)
  5. Path compression (graph paths)
Output: 20 compressed entities, 70-80% with snippets
Performance: <100ms
```

#### 5.2 RAG Aggregator
```
Input: Compressed context
Process:
  1. Entity clustering (by file/class)
  2. API delta extraction (old → new patterns)
  3. Canonical usage synthesis (correct patterns)
  4. Repair strategy selection
Output: Aggregated context with repair strategy
Performance: <50ms
```

#### 5.3 Pipeline Merger
```
Input: Flow A context + Flow B context
Process:
  1. Merge api_deltas and canonical_usages
  2. Merge snippet-rich entities from Flow A
  3. Merge KGCompass entities
  4. Deduplicate by entity_id
Output: Merged context, 60-70% with snippets
Performance: <50ms
```

### 6. Generation Layer

#### 6.1 Line Extractor
```
Technology: AST analysis + regex
Input: Stack trace + test code
Process:
  1. Parse stack trace for line number
  2. Apply offset correction
  3. Safety check (import/annotation?)
  4. Text-based fallback if needed
Output: Actual broken line
Accuracy: 95%
Performance: <10ms
```

#### 6.2 AST Query Builder
```
Technology: Tree-sitter + regex
Input: Broken line code
Process:
  1. Extract method calls
  2. Extract literals
  3. Extract types
  4. Build semantic query
Output: Precise API query
Performance: <10ms
```

#### 6.3 Prompt Generator
```
Input: Merged context + error info
Process:
  1. Allocate token budget
  2. Filter noise entities
  3. Sort by combined score
  4. Add entities until budget exceeded
  5. Add relationships
  6. Add usage patterns
Output: Structured prompt (2000-14000 chars)
Performance: <100ms
```

#### 6.4 LLM Interface
```
Technology: LM Studio API
Model: Qwen 2.5 Coder 7B Instruct
Input: Structured prompt
Parameters:
  - Temperature: 0.1
  - Max tokens: 4096
  - Stop sequences: ["---END---", "\n\n\n"]
Output: Repaired code
Performance: ~5 seconds
```

#### 6.5 Output Cleaner
```
Input: Raw LLM output
Process:
  1. Remove markdown fences
  2. Remove preambles
  3. Extract pure code
  4. Validate syntax
Output: Clean repaired code
Performance: <10ms
```

### 7. Presentation Layer

#### 7.1 Web Server
```
Technology: Flask
Endpoints:
  - POST /api/gatr/repair: Submit repair request
  - GET /api/gatr/status: Check repair status
  - GET /api/gatr/context: Get test context
  - GET /api/repos: List repositories
  - POST /api/repos/analyze: Analyze repository
Authentication: GitHub OAuth2
Performance: <100ms (excluding LLM)
```

#### 7.2 Frontend
```
Technology: Next.js + React + TypeScript
Components:
  - GATRPanel: Main repair interface
  - DiffViewer: Unified diff display
  - ContextViewer: Entity and relation display
  - ProgressTracker: Pipeline progress
Styling: Tailwind CSS + Material Design
Performance: <50ms render time
```

---

## Data Flow

### Ingestion Flow
```
GitHub Repo
    ↓ [Clone]
Local Files
    ↓ [Parse with Tree-sitter]
AST
    ↓ [Extract Entities]
Entity List
    ↓ [Extract Relationships]
Entity List + Relationship List
    ↓ [Calculate Relevance]
Scored Entity List
    ↓ [Extract Code Snippets]
Entity List + Code Snippets
    ↓ [Generate Embeddings]
Entity List + Code + Embeddings
    ↓ [Store]
Kuzu (relationships) + LanceDB (code+vectors)
```

### Repair Flow
```
Broken Test + Error
    ↓ [Parse Error]
Error Info
    ↓ [Dual Retrieval]
Flow A (Vector) + Flow B (Graph)
    ↓ [Compress & Aggregate]
Compressed Context + Aggregated Context
    ↓ [Merge]
Merged Context
    ↓ [Extract Broken Line]
Broken Line + AST Components
    ↓ [Build Query]
Precise API Query
    ↓ [Hybrid Search]
Relevant Entities with Code
    ↓ [Generate Prompt]
Structured Prompt
    ↓ [LLM Generation]
Repaired Code
    ↓ [Clean Output]
Final Repaired Code
```

---

## Scalability

### Current Capacity
- **Repositories**: Tested up to 10,000 files
- **Entities**: Tested up to 100,000 entities
- **Concurrent Repairs**: 10 simultaneous requests
- **Response Time**: <10 seconds per repair

### Bottlenecks
1. **LLM Inference**: 5 seconds (70% of total time)
2. **Graph Traversal**: 500ms (7% of total time)
3. **Vector Search**: 100ms (1.5% of total time)
4. **Snippet Extraction**: 150ms per entity (2% of total time)

### Optimization Opportunities
1. **LLM**: Use quantized model (4-bit) for 2x speedup
2. **Graph**: Cache frequent traversal patterns
3. **Vector**: Use approximate nearest neighbor (ANN) index
4. **Snippets**: Pre-extract all snippets during ingestion

---

## Reliability

### Error Handling
- **LanceDB Unavailable**: Fall back to file system extraction
- **Kuzu Unavailable**: Use in-memory NetworkX graph
- **LLM Unavailable**: Return fallback repair (comment out broken line)
- **File Not Found**: Skip entity, continue with others
- **Invalid Line Numbers**: Use text-based fallback

### Monitoring
- **Snippet Coverage**: Log at each stage
- **Entity Flow**: Track entity count through pipeline
- **Token Budget**: Log budget usage and truncation
- **LLM Quality**: Track syntax errors and compilation failures

### Logging
- **Levels**: DEBUG, INFO, WARNING, ERROR
- **Markers**: [SNIPPET_COVERAGE], [ENTITY_FLOW], [TOKEN_BUDGET], [LINE_EXTRACTION]
- **Output**: Console + file (workspace/logs/)
- **Rotation**: Daily, keep 7 days

---

## Security

### Authentication
- **GitHub OAuth2**: For web interface
- **Personal Access Tokens**: For API access
- **Token Storage**: Encrypted in database
- **Rate Limiting**: 100 requests/hour per user

### Data Privacy
- **Repository Data**: Stored locally, not shared
- **Code Snippets**: Never sent to external services (except LM Studio)
- **LLM**: Runs locally, no data leaves system
- **Logs**: Sanitized to remove sensitive info

### Input Validation
- **Repository URLs**: Validated against GitHub API
- **File Paths**: Sanitized to prevent directory traversal
- **Code Input**: Validated for syntax before processing
- **LLM Output**: Validated for syntax before returning

---

## Deployment

### Development
```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with GitHub token and LM Studio URL

# Start LM Studio
# Load Qwen 2.5 Coder 7B Instruct model

# Start backend
python web_server.py

# Start frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Production
```bash
# Use production WSGI server
gunicorn -w 4 -b 0.0.0.0:5000 web_server:app

# Use production frontend build
cd frontend
npm run build
npm start

# Use reverse proxy (nginx)
# Configure SSL/TLS
# Set up monitoring (Prometheus + Grafana)
```

---

## Testing

### Unit Tests
- **Entity Extraction**: Test AST parsing for each language
- **Relationship Extraction**: Test edge detection
- **Snippet Extraction**: Test 3-tier fallback
- **Line Extraction**: Test offset correction and fallback
- **Prompt Generation**: Test token budget management

### Integration Tests
- **E2E Repair**: Test complete repair flow
- **Database Integration**: Test Kuzu + LanceDB
- **LLM Integration**: Test LM Studio API
- **Web Interface**: Test Flask endpoints

### Evaluation
- **Repair Accuracy**: % of repairs that compile
- **Repair Quality**: % of repairs that fix the test
- **Snippet Coverage**: % of entities with code in prompt
- **Response Time**: Average time per repair

---

## Future Enhancements

### Short Term (Next 3 Months)
1. **Multi-language Support**: Add JavaScript, C++, Go
2. **Batch Repair**: Repair multiple tests in one request
3. **Repair Ranking**: Generate multiple repairs, rank by confidence
4. **Caching**: Cache frequent queries and repairs

### Medium Term (6 Months)
1. **Fine-tuned LLM**: Train on repository-specific patterns
2. **Active Learning**: Learn from user feedback
3. **Incremental Updates**: Update graph as code changes
4. **Distributed Processing**: Scale to multiple machines

### Long Term (1 Year)
1. **Multi-modal Repair**: Use documentation, issues, PRs
2. **Proactive Repair**: Suggest fixes before tests break
3. **Test Generation**: Generate new tests for uncovered code
4. **Code Review**: Suggest improvements beyond repairs

---

## Conclusion

GATR's architecture combines multiple AI techniques (knowledge graphs, vector embeddings, LLM generation) with robust engineering (dual pipelines, fallback strategies, token management) to achieve reliable automated test repair. The system is modular, scalable, and production-ready.
