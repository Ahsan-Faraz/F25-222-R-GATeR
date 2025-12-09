# Step 6: Store Vectors in LanceDB - Implementation Specification

## Overview

**Step 6** is a critical component of GATeR's Iteration 2, bridging the semantic relevance scoring from Step 5 with the context retrieval capabilities of Step 7. This step focuses on **persistent vector storage** and **high-performance semantic search** using LanceDB, an open-source vector database optimized for AI applications.

## Purpose & Strategic Value

### Why Vector Storage is Essential

After Step 5 generates semantic embeddings and relevance scores, we need:

1. **Persistent Storage**: Embeddings are computationally expensive to generate. Storing them prevents redundant computation.
2. **Fast Similarity Search**: Approximate Nearest Neighbor (ANN) search for quick semantic retrieval.
3. **Scalability**: Efficient handling of large codebases (100K+ entities).
4. **Integration Bridge**: Connect relevance scoring (Step 5) with context retrieval (Step 7).
5. **Query Optimization**: Enable sub-second semantic searches across entire repositories.

### LanceDB vs Other Vector Databases

**Why LanceDB for GATeR:**

| Feature | LanceDB | Alternatives (Pinecone, Weaviate, Chroma) |
|---------|---------|------------------------------------------|
| **Deployment** | Embedded (no server) | Client-server or cloud-based |
| **Storage Format** | Apache Arrow (columnar) | Proprietary or custom formats |
| **Performance** | Disk-optimized with caching | Memory-intensive or network-dependent |
| **Cost** | Free, open-source | Paid tiers or resource-intensive |
| **Integration** | Python-native, simple API | Complex setup, external dependencies |
| **Versioning** | Built-in dataset versioning | Limited or no versioning |
| **Scalability** | Billions of vectors | Varies by tier/plan |

**LanceDB aligns with GATeR's architecture:**
- ✅ Embedded database matches KUZU's embedded approach
- ✅ No external services needed (self-contained system)
- ✅ Apache Arrow format integrates well with Python/PyArrow
- ✅ Disk-based storage for large-scale repositories
- ✅ Fast enough for research use cases (<100ms queries)

---

## Technical Architecture

### System Integration

```
┌─────────────────────────────────────────────────────────────┐
│                     GATeR Pipeline Flow                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1-4: Repository → Parse → Graph → KUZU                │
│           (Structural data storage)                          │
│                          ↓                                   │
│  Step 5: KGCompass Relevance Scoring                        │
│          - Generate embeddings (sentence-transformers)       │
│          - Calculate semantic similarity                     │
│          - Produce relevance scores                          │
│                          ↓                                   │
│  Step 6: LanceDB Vector Storage ← YOU ARE HERE              │
│          - Store entity embeddings                           │
│          - Index for fast ANN search                         │
│          - Enable semantic queries                           │
│                          ↓                                   │
│  Step 7: Context Retrieval                                  │
│          - Query vectors for similar entities                │
│          - Traverse graph for related code                   │
│          - Collect repair context                            │
│                          ↓                                   │
│  Step 8-9: GraphRAG → LLM Test Repair                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```python
# Input from Step 5
{
    "entity_id": "func_print_MatAdd",
    "entity_name": "print_MatAdd",
    "entity_type": "function",
    "embedding": [0.123, -0.456, 0.789, ...],  # 768-dim vector from jina-embeddings
    "metadata": {
        "file_path": "sympy/printing/latex.py",
        "line_start": 145,
        "line_end": 167,
        "relevance_score": 0.8734,
        "code_snippet": "def print_MatAdd(self, expr):\n    ..."
    }
}

# Storage in LanceDB (Step 6)
LanceDB Table: "code_entity_embeddings"
- Vector index on "embedding" field (IVF-PQ for ANN)
- Metadata stored alongside vectors
- Versioned snapshots for repository updates

# Output for Step 7
# Fast semantic search: "Find functions similar to matrix printing"
# Returns: Top-k entities with cosine similarity > threshold
```

---

## Implementation Specification

### Module Structure

```
src/vector_storage/
├── __init__.py                    # Module exports
├── step6_vector_storage.py       # Main LanceDB integration interface
├── lance_manager.py              # LanceDB operations wrapper
├── vector_indexer.py             # Indexing and search optimization
└── embedding_sync.py             # Sync between Step 5 and LanceDB
```

### Core Components

#### 1. LanceManager (lance_manager.py)

**Purpose**: Low-level LanceDB operations wrapper

**Key Responsibilities:**
- Initialize LanceDB database connection
- Create and manage vector tables
- Handle table schema and versioning
- Execute CRUD operations on vectors
- Manage database cleanup and optimization

**Key Methods:**
```python
class LanceManager:
    def __init__(self, db_path: str)
    def create_table(self, table_name: str, schema: Schema)
    def add_vectors(self, table_name: str, vectors: List[Dict])
    def search_vectors(self, table_name: str, query_vector: np.ndarray, top_k: int)
    def update_vectors(self, table_name: str, entity_ids: List[str], vectors: List[Dict])
    def delete_vectors(self, table_name: str, entity_ids: List[str])
    def get_table_stats(self, table_name: str) -> Dict
    def compact_table(self, table_name: str)
    def version_table(self, table_name: str) -> str
```

**Database Schema:**
```python
import pyarrow as pa

code_entity_schema = pa.schema([
    # Primary identifier
    pa.field("entity_id", pa.string()),
    
    # Vector data (768-dim for jina-embeddings-v2-base-code)
    pa.field("embedding", pa.list_(pa.float32(), 768)),
    
    # Entity metadata
    pa.field("entity_name", pa.string()),
    pa.field("entity_type", pa.string()),
    pa.field("file_path", pa.string()),
    pa.field("line_start", pa.int32()),
    pa.field("line_end", pa.int32()),
    
    # Code content
    pa.field("code_snippet", pa.string()),
    pa.field("docstring", pa.string()),
    
    # Relevance metadata (from Step 5)
    pa.field("relevance_score", pa.float32()),
    pa.field("semantic_similarity", pa.float32()),
    pa.field("textual_similarity", pa.float32()),
    
    # Graph metadata
    pa.field("node_degree", pa.int32()),
    pa.field("connected_tests", pa.list_(pa.string())),
    
    # Timestamps
    pa.field("created_at", pa.timestamp('ms')),
    pa.field("updated_at", pa.timestamp('ms')),
    
    # Version tracking
    pa.field("repository_commit", pa.string()),
    pa.field("entity_hash", pa.string()),
])
```

#### 2. VectorIndexer (vector_indexer.py)

**Purpose**: Advanced indexing and search optimization

**Key Responsibilities:**
- Configure ANN (Approximate Nearest Neighbor) indexes
- Optimize search parameters (IVF, PQ, HNSW)
- Implement hybrid search (vector + metadata filters)
- Benchmark and tune search performance
- Handle index rebuilding for updates

**Indexing Strategies:**

1. **IVF (Inverted File Index)**
   - Best for: Large datasets (100K+ vectors)
   - Speed: Fast search with slight accuracy trade-off
   - Memory: Low memory footprint
   - Configuration: `nlist=100`, `nprobe=10`

2. **PQ (Product Quantization)**
   - Best for: Compression of high-dimensional vectors
   - Speed: Fast search with compressed data
   - Memory: Significant memory savings
   - Configuration: `m=64`, `nbits=8`

3. **HNSW (Hierarchical Navigable Small World)**
   - Best for: High accuracy requirements
   - Speed: Very fast but memory-intensive
   - Memory: Higher memory usage
   - Configuration: `M=16`, `efConstruction=200`

**Key Methods:**
```python
class VectorIndexer:
    def create_index(self, table, index_type: str, metric: str = "cosine")
    def optimize_index(self, table, sample_queries: List[np.ndarray])
    def search_with_filters(self, table, query_vector: np.ndarray, 
                           filters: Dict, top_k: int)
    def hybrid_search(self, table, query_vector: np.ndarray, 
                     text_query: str, top_k: int)
    def benchmark_search(self, table, test_queries: List[np.ndarray])
    def rebuild_index(self, table, force: bool = False)
```

**Search Optimization Techniques:**

```python
# 1. Metadata Pre-filtering
# Filter by file type before vector search
results = table.search(query_vector) \
    .where("entity_type IN ('function', 'method')") \
    .where("file_path LIKE '%.py'") \
    .limit(top_k) \
    .to_pandas()

# 2. Relevance Score Boosting
# Combine vector similarity with relevance scores
# final_score = alpha * vector_similarity + (1-alpha) * relevance_score

# 3. Multi-vector Search
# Search across multiple embedding types
embeddings = ["code_embedding", "docstring_embedding", "signature_embedding"]
results = multi_vector_search(table, query_vectors, embeddings, weights=[0.5, 0.3, 0.2])

# 4. Approximate Search with Reranking
# Fast approximate search → precise reranking
candidates = table.search(query_vector).limit(top_k * 10).to_list()
reranked = precise_cosine_similarity(query_vector, candidates)[:top_k]
```

#### 3. EmbeddingSync (embedding_sync.py)

**Purpose**: Synchronization between Step 5 embeddings and LanceDB

**Key Responsibilities:**
- Sync embeddings from Step 5 cache to LanceDB
- Handle incremental updates (new/modified entities)
- Detect and remove stale embeddings
- Maintain consistency between NetworkX/KUZU and LanceDB
- Batch processing for efficient syncing

**Sync Strategies:**

1. **Full Sync** (Initial repository analysis)
   - Extract all embeddings from Step 5
   - Bulk insert into LanceDB
   - Create indexes
   - Verify data integrity

2. **Incremental Sync** (Repository updates)
   - Detect changed entities (file snapshots)
   - Regenerate embeddings for changed entities only
   - Update/insert changed vectors
   - Delete removed entity vectors

3. **Consistency Checks**
   - Compare entity counts (KUZU vs LanceDB)
   - Verify embedding dimensions
   - Check for missing entities
   - Validate metadata accuracy

**Key Methods:**
```python
class EmbeddingSync:
    def full_sync(self, kg_manager, relevance_scorer, lance_manager)
    def incremental_sync(self, changed_entities: List[str])
    def sync_from_step5_cache(self, cache_path: str)
    def verify_consistency(self) -> Dict[str, Any]
    def cleanup_stale_vectors(self, active_entities: Set[str])
    def batch_sync(self, entities: List[Dict], batch_size: int = 1000)
    def get_sync_stats(self) -> Dict
```

#### 4. Step6VectorStorage (step6_vector_storage.py)

**Purpose**: Main interface for Step 6 integration with GATeR pipeline

**Key Responsibilities:**
- Orchestrate vector storage operations
- Integrate with Steps 5 and 7
- Provide high-level API for vector operations
- Handle error recovery and logging
- Manage workspace and configuration

**Key Methods:**
```python
class Step6VectorStorage:
    def __init__(self, workspace_dir: str, db_path: str)
    
    # Core operations
    def store_embeddings(self, kg_manager, relevance_scorer) -> Dict
    def search_similar_entities(self, query: str, top_k: int) -> List[Dict]
    def update_entity_embeddings(self, entity_ids: List[str]) -> Dict
    
    # Integration methods
    def sync_with_step5(self, relevance_scorer) -> Dict
    def prepare_for_step7(self) -> bool
    
    # Management
    def get_database_stats(self) -> Dict
    def optimize_database(self) -> Dict
    def export_vectors(self, output_path: str) -> Dict
    def import_vectors(self, input_path: str) -> Dict
    
    # Query interface
    def query_by_problem_description(self, problem: str, top_k: int)
    def query_by_entity_type(self, entity_type: str, filters: Dict)
    def query_by_file_path(self, file_pattern: str)
```

---

## Semantic Search Implementation

### Core Semantic Search Workflow

```python
# WORKFLOW: Semantic Search in Step 6

# 1. Problem Description Input
problem = """
There is a bug in matrix addition printing where special 
characters cause formatting errors in LaTeX output.
"""

# 2. Generate Query Embedding (using Step 5's EmbeddingGenerator)
query_embedding = embedding_generator.generate_embedding(problem)
# Result: 768-dimensional vector

# 3. LanceDB Vector Search
results = lance_manager.search_vectors(
    table_name="code_entity_embeddings",
    query_vector=query_embedding,
    top_k=20
)

# 4. LanceDB returns similar entities
[
    {
        "entity_id": "func_print_MatAdd",
        "entity_name": "print_MatAdd", 
        "similarity_score": 0.9234,
        "embedding": [...],
        "metadata": {...}
    },
    {
        "entity_id": "func__print_MatAdd",
        "entity_name": "_print_MatAdd",
        "similarity_score": 0.8891,
        "embedding": [...],
        "metadata": {...}
    },
    ...
]

# 5. Post-processing and Ranking
# Combine vector similarity with relevance scores from Step 5
final_scores = []
for result in results:
    vector_sim = result['similarity_score']
    relevance = result['metadata']['relevance_score']
    
    # Hybrid scoring
    final_score = 0.7 * vector_sim + 0.3 * relevance
    
    result['final_score'] = final_score
    final_scores.append(result)

# Sort by final score
final_scores.sort(key=lambda x: x['final_score'], reverse=True)

# 6. Output for Step 7 (Context Retrieval)
top_candidates = final_scores[:10]
```

### Advanced Search Patterns

#### 1. Multi-Modal Search

```python
# Search using multiple query types simultaneously

def multi_modal_search(problem_desc: str, code_snippet: str, error_message: str):
    """
    Combine different query types for comprehensive search
    """
    # Generate embeddings for each modality
    desc_embedding = generate_embedding(problem_desc)
    code_embedding = generate_embedding(code_snippet)
    error_embedding = generate_embedding(error_message)
    
    # Weighted search
    weights = [0.5, 0.3, 0.2]  # Description, code, error
    
    # Search and aggregate
    results_desc = search(desc_embedding, top_k=50)
    results_code = search(code_embedding, top_k=50)
    results_error = search(error_embedding, top_k=50)
    
    # Aggregate with weights
    aggregated = weighted_aggregate([results_desc, results_code, results_error], weights)
    
    return aggregated[:20]
```

#### 2. Filtered Semantic Search

```python
# Search with metadata constraints

def filtered_search(query: str, filters: Dict):
    """
    Semantic search with metadata filtering
    """
    query_embedding = generate_embedding(query)
    
    # Build filter expression
    filter_expr = []
    if 'entity_type' in filters:
        filter_expr.append(f"entity_type = '{filters['entity_type']}'")
    if 'file_path_pattern' in filters:
        filter_expr.append(f"file_path LIKE '{filters['file_path_pattern']}'")
    if 'min_relevance' in filters:
        filter_expr.append(f"relevance_score >= {filters['min_relevance']}")
    
    # Search with filters
    results = lance_table.search(query_embedding) \
        .where(" AND ".join(filter_expr)) \
        .limit(top_k) \
        .to_pandas()
    
    return results
```

#### 3. Temporal Search

```python
# Search entities modified in specific time ranges

def temporal_search(query: str, time_range: tuple):
    """
    Find semantically similar entities within time constraints
    """
    start_time, end_time = time_range
    
    query_embedding = generate_embedding(query)
    
    results = lance_table.search(query_embedding) \
        .where(f"updated_at >= '{start_time}' AND updated_at <= '{end_time}'") \
        .limit(top_k) \
        .to_pandas()
    
    return results
```

#### 4. Graph-Aware Search

```python
# Combine vector search with graph relationships

def graph_aware_search(query: str, kg_manager):
    """
    Semantic search enhanced with graph connectivity
    """
    # Initial vector search
    candidates = semantic_search(query, top_k=50)
    
    # Expand with graph neighbors
    expanded = []
    for candidate in candidates:
        entity_id = candidate['entity_id']
        
        # Get graph neighbors
        neighbors = kg_manager.get_entity_neighbors(entity_id)
        
        # Score based on connectivity
        connectivity_score = len(neighbors) / 100  # Normalize
        
        # Boost score for well-connected entities
        candidate['final_score'] = (
            0.8 * candidate['similarity_score'] + 
            0.2 * connectivity_score
        )
        expanded.append(candidate)
    
    # Re-rank
    expanded.sort(key=lambda x: x['final_score'], reverse=True)
    return expanded[:20]
```

---

## Performance Optimization

### Indexing Strategies

#### Choosing the Right Index

```python
# Decision tree for index selection

if num_vectors < 10_000:
    # No index needed - brute force is fast enough
    index_type = "FLAT"
    
elif num_vectors < 100_000:
    # IVF index - good balance
    index_type = "IVF"
    params = {"nlist": 100, "nprobe": 10}
    
elif num_vectors < 1_000_000:
    # IVF-PQ - compressed for memory efficiency
    index_type = "IVF_PQ"
    params = {"nlist": 1024, "nprobe": 16, "m": 64, "nbits": 8}
    
else:
    # HNSW - for very large scales
    index_type = "HNSW"
    params = {"M": 16, "efConstruction": 200, "efSearch": 50}
```

#### Index Configuration

```python
# Create optimized index for GATeR use case

def create_optimized_index(table, num_vectors: int):
    """
    Create index optimized for code entity search
    """
    if num_vectors < 10_000:
        # Small repository - no index
        return None
    
    elif num_vectors < 100_000:
        # Medium repository - IVF
        table.create_index(
            metric="cosine",
            index_type="IVF",
            num_partitions=100,
            num_sub_vectors=64
        )
    
    else:
        # Large repository - IVF-PQ with compression
        table.create_index(
            metric="cosine", 
            index_type="IVF_PQ",
            num_partitions=1024,
            num_sub_vectors=64,
            num_bits=8
        )
    
    # Optimize for search
    table.optimize()
```

### Caching Strategy

```python
# Multi-level caching for performance

class VectorCacheManager:
    """
    Three-tier caching:
    1. In-memory cache (LRU) - hot queries
    2. Disk cache - recent queries
    3. LanceDB - persistent storage
    """
    
    def __init__(self):
        self.memory_cache = LRUCache(maxsize=1000)  # 1000 most recent queries
        self.disk_cache_path = "workspace/vector_cache"
        
    def get_similar_entities(self, query_embedding: np.ndarray, top_k: int):
        # Check memory cache first
        cache_key = self._compute_cache_key(query_embedding)
        
        if cache_key in self.memory_cache:
            return self.memory_cache[cache_key]
        
        # Check disk cache
        disk_result = self._check_disk_cache(cache_key)
        if disk_result:
            self.memory_cache[cache_key] = disk_result
            return disk_result
        
        # Query LanceDB
        results = self._query_lancedb(query_embedding, top_k)
        
        # Update caches
        self._save_to_disk_cache(cache_key, results)
        self.memory_cache[cache_key] = results
        
        return results
```

### Batch Processing

```python
# Efficient batch operations

def batch_vector_insertion(entities: List[Dict], batch_size: int = 1000):
    """
    Insert vectors in optimized batches
    """
    total = len(entities)
    
    for i in range(0, total, batch_size):
        batch = entities[i:i+batch_size]
        
        # Prepare batch data
        batch_data = {
            "entity_id": [e['entity_id'] for e in batch],
            "embedding": [e['embedding'] for e in batch],
            "entity_name": [e['entity_name'] for e in batch],
            # ... other fields
        }
        
        # Single batch insert (much faster than individual inserts)
        lance_table.add(batch_data)
        
        # Progress tracking
        progress = (i + batch_size) / total * 100
        logger.info(f"Inserted {min(i+batch_size, total)}/{total} vectors ({progress:.1f}%)")
```

---

## Integration with GATeR Pipeline

### Step 5 → Step 6 Integration

```python
# Automatic syncing from Step 5 to Step 6

class Step5ToStep6Bridge:
    """
    Seamless integration between relevance scoring and vector storage
    """
    
    def sync_after_step5(self, relevance_results: Dict):
        """
        Called automatically after Step 5 completion
        """
        # Extract embeddings from Step 5 results
        embeddings = []
        
        for candidate in relevance_results['top_candidates']:
            entity_data = {
                'entity_id': candidate['entity_id'],
                'entity_name': candidate['entity_name'],
                'entity_type': candidate['entity_type'],
                'embedding': candidate['embedding'],
                'relevance_score': candidate['total_score'],
                'semantic_similarity': candidate['semantic_similarity'],
                'file_path': candidate['file_path'],
                # ... metadata
            }
            embeddings.append(entity_data)
        
        # Store in LanceDB
        self.vector_storage.store_embeddings(embeddings)
        
        logger.info(f"Synced {len(embeddings)} embeddings to LanceDB")
```

### Step 6 → Step 7 Integration

```python
# Prepare data for Step 7 context retrieval

class Step6ToStep7Bridge:
    """
    Provide fast entity retrieval for context collection
    """
    
    def get_relevant_entities_for_context(self, problem: str, top_k: int = 50):
        """
        Fast semantic search for Step 7 context retrieval
        """
        # Generate query embedding
        query_embedding = self.embedding_generator.generate_embedding(problem)
        
        # Search LanceDB
        results = self.lance_manager.search_vectors(
            table_name="code_entity_embeddings",
            query_vector=query_embedding,
            top_k=top_k
        )
        
        # Format for Step 7
        context_candidates = []
        for result in results:
            context_candidates.append({
                'entity_id': result['entity_id'],
                'entity_name': result['entity_name'],
                'similarity_score': result['_distance'],  # LanceDB distance
                'file_path': result['file_path'],
                'code_snippet': result['code_snippet'],
                'connected_entities': result['connected_tests']
            })
        
        return context_candidates
```

---

## Incremental Update Strategy

### Handling Repository Changes

```python
# Efficient incremental updates when repository changes

class IncrementalVectorUpdate:
    """
    Update vectors only for changed entities
    """
    
    def update_from_incremental_analysis(self, changed_files: List[str]):
        """
        Update vectors after incremental repository analysis
        """
        # 1. Identify affected entities
        affected_entities = self._get_entities_from_files(changed_files)
        
        # 2. Regenerate embeddings for affected entities
        new_embeddings = []
        for entity_id in affected_entities:
            entity_data = self.kg_manager.get_entity(entity_id)
            
            # Generate new embedding
            embedding = self.embedding_generator.generate_embedding(
                entity_data['code_snippet']
            )
            
            new_embeddings.append({
                'entity_id': entity_id,
                'embedding': embedding,
                'updated_at': datetime.now(),
                'entity_hash': self._compute_entity_hash(entity_data)
            })
        
        # 3. Update LanceDB (upsert operation)
        self.lance_manager.upsert_vectors(
            table_name="code_entity_embeddings",
            vectors=new_embeddings,
            key="entity_id"
        )
        
        # 4. Rebuild index if needed (threshold: >10% changes)
        change_ratio = len(affected_entities) / self.total_entities
        if change_ratio > 0.1:
            self.vector_indexer.rebuild_index(self.lance_table)
        
        logger.info(f"Updated {len(affected_entities)} vectors in LanceDB")
```

### Version Management

```python
# Track vector versions aligned with repository commits

class VectorVersionManager:
    """
    Version control for embeddings
    """
    
    def create_snapshot(self, commit_sha: str):
        """
        Create versioned snapshot of embeddings
        """
        # Export current table to versioned path
        snapshot_path = f"workspace/vector_snapshots/{commit_sha}.lance"
        
        self.lance_table.to_lance(snapshot_path)
        
        # Save metadata
        metadata = {
            'commit_sha': commit_sha,
            'timestamp': datetime.now().isoformat(),
            'num_vectors': self.lance_table.count_rows(),
            'schema_version': '1.0'
        }
        
        with open(f"{snapshot_path}/metadata.json", 'w') as f:
            json.dump(metadata, f)
    
    def restore_snapshot(self, commit_sha: str):
        """
        Restore embeddings from specific commit
        """
        snapshot_path = f"workspace/vector_snapshots/{commit_sha}.lance"
        
        if not os.path.exists(snapshot_path):
            raise ValueError(f"No snapshot found for commit {commit_sha}")
        
        # Load snapshot
        self.lance_table = lance.dataset(snapshot_path)
        
        logger.info(f"Restored vectors from commit {commit_sha}")
```

---

## Configuration & Environment

### Environment Variables

```bash
# Add to .env file

# LanceDB Configuration
LANCEDB_PATH=workspace/lancedb
LANCEDB_TABLE_NAME=code_entity_embeddings

# Vector Dimensions (must match embedding model)
VECTOR_DIMENSIONS=768  # jina-embeddings-v2-base-code

# Index Configuration
LANCE_INDEX_TYPE=IVF  # Options: FLAT, IVF, IVF_PQ, HNSW
LANCE_METRIC=cosine   # Options: cosine, l2, ip (inner product)
LANCE_NUM_PARTITIONS=100
LANCE_NUM_SUB_VECTORS=64

# Search Configuration
LANCE_DEFAULT_TOP_K=20
LANCE_SIMILARITY_THRESHOLD=0.7

# Performance Tuning
LANCE_BATCH_SIZE=1000
LANCE_CACHE_SIZE=1000
LANCE_NUM_THREADS=4

# Storage Management
LANCE_AUTO_COMPACT=true
LANCE_COMPACT_THRESHOLD=0.2  # Compact when 20% fragmentation
LANCE_MAX_VERSIONS=5         # Keep last 5 versions
```

### Dependencies

```python
# Add to requirements.txt

# Step 6: Vector Storage Dependencies
lancedb>=0.3.0           # Vector database
pyarrow>=10.0.0          # Arrow format for LanceDB
pandas>=1.5.0            # Data manipulation
numpy>=1.21.0            # Array operations

# Optional: Advanced indexing
faiss-cpu>=1.7.4         # Alternative ANN library (if needed)
hnswlib>=0.7.0           # HNSW implementation (if needed)
```

---

## Error Handling & Reliability

### Graceful Degradation

```python
# Fallback mechanisms when LanceDB unavailable

class VectorStorageWithFallback:
    """
    Graceful degradation to in-memory storage
    """
    
    def __init__(self):
        self.use_lancedb = True
        self.fallback_storage = {}  # In-memory dict
        
        try:
            self.lance_manager = LanceManager(db_path=LANCEDB_PATH)
        except Exception as e:
            logger.warning(f"LanceDB unavailable: {e}. Using in-memory fallback.")
            self.use_lancedb = False
    
    def search_vectors(self, query_vector: np.ndarray, top_k: int):
        if self.use_lancedb:
            try:
                return self._search_lancedb(query_vector, top_k)
            except Exception as e:
                logger.error(f"LanceDB search failed: {e}. Falling back to in-memory.")
                self.use_lancedb = False
        
        # Fallback: brute force search in memory
        return self._search_in_memory(query_vector, top_k)
```

### Data Integrity Checks

```python
# Verify data consistency

def verify_vector_storage_integrity():
    """
    Check consistency between different storage layers
    """
    checks = {
        'embedding_dimensions': False,
        'entity_count_match': False,
        'no_null_embeddings': False,
        'schema_valid': False
    }
    
    # Check 1: Embedding dimensions
    sample = lance_table.head(1)
    if len(sample['embedding'][0]) == VECTOR_DIMENSIONS:
        checks['embedding_dimensions'] = True
    
    # Check 2: Entity counts
    kuzu_count = kg_manager.get_entity_count()
    lance_count = lance_table.count_rows()
    if abs(kuzu_count - lance_count) < 10:  # Allow small discrepancy
        checks['entity_count_match'] = True
    
    # Check 3: Null embeddings
    null_count = lance_table.filter("embedding IS NULL").count_rows()
    if null_count == 0:
        checks['no_null_embeddings'] = True
    
    # Check 4: Schema validation
    if lance_table.schema == expected_schema:
        checks['schema_valid'] = True
    
    return checks
```

---

## Performance Benchmarks

### Expected Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| **Initial Storage** | <2 min per 10K entities | Bulk insert with batch processing |
| **Vector Search** | <100ms for top-20 | With proper indexing (IVF/HNSW) |
| **Incremental Update** | <5 sec per 100 entities | Upsert with index maintenance |
| **Index Creation** | <1 min per 100K vectors | One-time operation |
| **Memory Usage** | <2GB for 100K entities | Compressed storage with PQ |
| **Disk Usage** | ~500MB per 100K entities | Arrow columnar format |

### Benchmark Suite

```python
# Performance testing framework

class VectorStorageBenchmark:
    """
    Comprehensive performance testing
    """
    
    def benchmark_insertion(self, num_vectors: int):
        """Test bulk insertion performance"""
        vectors = self._generate_random_vectors(num_vectors)
        
        start = time.time()
        self.lance_manager.add_vectors("test_table", vectors)
        duration = time.time() - start
        
        throughput = num_vectors / duration
        logger.info(f"Insertion: {throughput:.0f} vectors/sec")
        
    def benchmark_search(self, num_queries: int):
        """Test search performance"""
        queries = self._generate_random_queries(num_queries)
        
        latencies = []
        for query in queries:
            start = time.time()
            results = self.lance_manager.search_vectors("test_table", query, top_k=20)
            latency = (time.time() - start) * 1000  # ms
            latencies.append(latency)
        
        avg_latency = np.mean(latencies)
        p95_latency = np.percentile(latencies, 95)
        
        logger.info(f"Search - Avg: {avg_latency:.1f}ms, P95: {p95_latency:.1f}ms")
```

---

## Testing Strategy

### Unit Tests

```python
# Test coverage for Step 6 components

class TestStep6VectorStorage(unittest.TestCase):
    
    def test_lance_manager_initialization(self):
        """Test LanceDB connection and table creation"""
        manager = LanceManager(db_path="test_db")
        self.assertTrue(manager.is_connected())
    
    def test_vector_insertion(self):
        """Test adding vectors to LanceDB"""
        vectors = [
            {"entity_id": "test1", "embedding": np.random.rand(768)},
            {"entity_id": "test2", "embedding": np.random.rand(768)}
        ]
        result = self.manager.add_vectors("test_table", vectors)
        self.assertEqual(result['inserted'], 2)
    
    def test_semantic_search(self):
        """Test vector similarity search"""
        query = np.random.rand(768)
        results = self.manager.search_vectors("test_table", query, top_k=5)
        self.assertEqual(len(results), 5)
        self.assertTrue(all('similarity_score' in r for r in results))
    
    def test_incremental_update(self):
        """Test updating existing vectors"""
        updated = {"entity_id": "test1", "embedding": np.random.rand(768)}
        result = self.manager.update_vectors("test_table", ["test1"], [updated])
        self.assertTrue(result['success'])
```

### Integration Tests

```python
# End-to-end testing

class TestStep5ToStep6Integration(unittest.TestCase):
    
    def test_full_pipeline_step5_to_step6(self):
        """Test complete flow from relevance scoring to vector storage"""
        # Step 5: Generate relevance scores
        problem = "Matrix printing error with special characters"
        step5_results = self.gater.calculate_relevance_scores(problem)
        
        # Step 6: Store vectors
        step6_results = self.gater.store_vectors_in_lancedb()
        
        # Verify
        self.assertTrue(step6_results['success'])
        self.assertEqual(
            len(step5_results['top_candidates']),
            step6_results['vectors_stored']
        )
        
        # Test search
        search_results = self.gater.search_similar_entities(problem, top_k=10)
        self.assertEqual(len(search_results), 10)
```

---

## Monitoring & Observability

### Logging Strategy

```python
# Comprehensive logging for Step 6

logger = logging.getLogger('gater.step6')

# Log levels and events:
# INFO: Normal operations (insertions, searches)
# DEBUG: Detailed operation traces (query vectors, results)
# WARNING: Performance issues (slow searches, cache misses)
# ERROR: Failures (connection errors, schema mismatches)

# Example logs:
logger.info("Step 6: Storing 1,234 vectors in LanceDB")
logger.debug(f"Query vector: {query_vector[:5]}... (truncated)")
logger.warning("Search took 250ms (threshold: 100ms)")
logger.error("Failed to connect to LanceDB: Connection timeout")
```

### Metrics Collection

```python
# Track key performance metrics

class Step6Metrics:
    """
    Collect and report Step 6 metrics
    """
    
    def __init__(self):
        self.metrics = {
            'total_vectors': 0,
            'total_searches': 0,
            'avg_search_latency_ms': 0,
            'cache_hit_rate': 0,
            'index_size_mb': 0,
            'last_sync_time': None
        }
    
    def record_search(self, latency_ms: float, cache_hit: bool):
        """Record search operation metrics"""
        self.metrics['total_searches'] += 1
        
        # Update average latency (exponential moving average)
        alpha = 0.1
        self.metrics['avg_search_latency_ms'] = (
            alpha * latency_ms + 
            (1 - alpha) * self.metrics['avg_search_latency_ms']
        )
        
        # Update cache hit rate
        if cache_hit:
            self.metrics['cache_hit_rate'] = (
                (self.metrics['cache_hit_rate'] * (self.metrics['total_searches'] - 1) + 1) /
                self.metrics['total_searches']
            )
    
    def get_metrics_report(self) -> Dict:
        """Generate metrics report"""
        return {
            'total_vectors': self.metrics['total_vectors'],
            'total_searches': self.metrics['total_searches'],
            'avg_search_latency_ms': round(self.metrics['avg_search_latency_ms'], 2),
            'cache_hit_rate': round(self.metrics['cache_hit_rate'] * 100, 2),
            'index_size_mb': round(self.metrics['index_size_mb'], 2)
        }
```

---

## Web Interface Integration

### API Endpoints for Step 6

```python
# Flask routes for vector storage operations

@app.route('/vectors/store', methods=['POST'])
def store_vectors():
    """
    Store embeddings in LanceDB
    POST /vectors/store
    Body: { "sync_all": true/false }
    """
    try:
        data = request.get_json()
        sync_all = data.get('sync_all', False)
        
        if sync_all:
            results = gater.vector_storage.full_sync()
        else:
            results = gater.vector_storage.incremental_sync()
        
        return jsonify({
            'success': True,
            'vectors_stored': results['vectors_stored'],
            'processing_time': results['processing_time']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vectors/search', methods=['POST'])
def search_vectors():
    """
    Semantic search in vector database
    POST /vectors/search
    Body: { "query": "problem description", "top_k": 20 }
    """
    try:
        data = request.get_json()
        query = data.get('query', '')
        top_k = data.get('top_k', 20)
        
        results = gater.vector_storage.search_similar_entities(query, top_k)
        
        return jsonify({
            'success': True,
            'results': results,
            'total_found': len(results)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vectors/stats')
def vector_stats():
    """
    Get vector database statistics
    GET /vectors/stats
    """
    try:
        stats = gater.vector_storage.get_database_stats()
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### Dashboard Integration

```javascript
// Frontend JavaScript for Step 6 controls

async function storeVectors(syncAll = false) {
    const response = await fetch('/vectors/store', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sync_all: syncAll})
    });
    
    const result = await response.json();
    
    if (result.success) {
        showNotification(`Stored ${result.vectors_stored} vectors in ${result.processing_time}s`);
        updateVectorStats();
    }
}

async function searchVectors() {
    const query = document.getElementById('search-query').value;
    const topK = document.getElementById('top-k').value;
    
    const response = await fetch('/vectors/search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: query, top_k: topK})
    });
    
    const result = await response.json();
    
    if (result.success) {
        displaySearchResults(result.results);
    }
}

async function updateVectorStats() {
    const response = await fetch('/vectors/stats');
    const result = await response.json();
    
    if (result.success) {
        document.getElementById('total-vectors').innerText = result.stats.total_vectors;
        document.getElementById('index-size').innerText = result.stats.index_size_mb + ' MB';
        document.getElementById('avg-search-latency').innerText = result.stats.avg_search_latency_ms + ' ms';
    }
}
```

---

## Success Criteria

### Functional Requirements

✅ **FR1**: Store embeddings from Step 5 in LanceDB  
✅ **FR2**: Enable semantic search with <100ms latency  
✅ **FR3**: Support incremental updates without full rebuild  
✅ **FR4**: Integrate with Steps 5 and 7 seamlessly  
✅ **FR5**: Handle 100K+ entities efficiently  
✅ **FR6**: Provide web interface for vector operations  

### Non-Functional Requirements

✅ **NFR1**: **Performance**: Top-20 search in <100ms  
✅ **NFR2**: **Scalability**: Support up to 1M vectors  
✅ **NFR3**: **Reliability**: 99.9% uptime with graceful degradation  
✅ **NFR4**: **Storage**: <1GB per 100K entities  
✅ **NFR5**: **Memory**: <2GB RAM usage during operation  
✅ **NFR6**: **Accuracy**: >95% recall@20 for semantic search  

### Acceptance Criteria

✅ **AC1**: All unit tests pass with >90% coverage  
✅ **AC2**: Integration tests demonstrate Step 5→6→7 flow  
✅ **AC3**: Performance benchmarks meet targets  
✅ **AC4**: Documentation complete and accurate  
✅ **AC5**: Web interface functional for all operations  
✅ **AC6**: Incremental updates work correctly  

---

## Risks & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **LanceDB compatibility issues** | High | Low | Test thoroughly, maintain fallback to in-memory |
| **Search latency exceeds target** | Medium | Medium | Optimize indexing, implement caching layers |
| **Memory overflow with large repos** | High | Low | Implement streaming, batch processing |
| **Index corruption** | Medium | Low | Regular backups, versioning, integrity checks |
| **Embedding dimension mismatch** | High | Low | Strict schema validation, migration tools |

### Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Disk space exhaustion** | Medium | Medium | Monitoring, auto-cleanup, compression |
| **Sync failures between systems** | High | Medium | Transaction support, rollback capability |
| **Performance degradation over time** | Medium | High | Regular optimization, compaction, reindexing |

---

## Future Enhancements (Post-Iteration 2)

### Short-term (Iteration 3)

1. **GPU Acceleration**: Use CUDA for faster embedding and search
2. **Multi-Index Support**: Multiple indexes for different query patterns
3. **Query Optimization**: Query plan analysis and optimization
4. **Advanced Filtering**: Complex metadata filters with boolean logic

### Long-term (Future Iterations)

1. **Distributed Storage**: Sharding for very large repositories (10M+ entities)
2. **Real-time Updates**: Stream processing for continuous synchronization
3. **Federated Search**: Search across multiple repositories simultaneously
4. **ML-Enhanced Ranking**: Learn optimal ranking from user feedback
5. **Cross-Modal Search**: Image, text, and code unified search

---

## Conclusion

**Step 6: Store Vectors in LanceDB** is a critical bridge in the GATeR pipeline, enabling:

✅ **Fast semantic search** for relevant code entities  
✅ **Efficient storage** of expensive-to-compute embeddings  
✅ **Scalable architecture** supporting large repositories  
✅ **Seamless integration** with Steps 5 and 7  
✅ **Production-ready** performance and reliability  

By implementing this step, GATeR gains **high-performance semantic search capabilities** essential for intelligent test repair. The combination of Step 5's relevance scoring and Step 6's vector storage creates a powerful foundation for Step 7's context retrieval and ultimately successful test repair generation.

**Implementation Priority**: **HIGH** - Critical for Iteration 2 completion

**Estimated Effort**: 2-3 weeks for complete implementation, testing, and integration

**Dependencies**: Step 5 (Complete ✅), LanceDB library, sentence-transformers

**Enables**: Step 7 (Context Retrieval), Step 8 (GraphRAG), Step 9 (LLM Test Repair)

---

*Document Version: 1.0*  
*Last Updated: November 14, 2025*  
*Status: Specification Complete - Ready for Implementation*
