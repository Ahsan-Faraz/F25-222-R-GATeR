# Context for Evaluation: GATeR vs TARGET — Full Project Understanding

> **Purpose**: This file gives complete context to any LLM or researcher so they can
> understand, reproduce, and extend the fair evaluation of GATeR vs TARGET.
> It covers both systems' architectures, the evaluation framework built, and
> critically explains **why TARGET needs no LLM at inference** while **GATeR does**.

---

## Table of Contents

1. [Research Background](#1-research-background)
2. [TARGET System — Complete Architecture](#2-target-system--complete-architecture)
3. [GATeR System — Complete Architecture](#3-gater-system--complete-architecture)
4. [Why TARGET Needs No LLM but GATeR Does](#4-why-target-needs-no-llm-but-gater-does)
5. [TaRBench Dataset — Full Details](#5-tarbench-dataset--full-details)
6. [The Evaluation Problem](#6-the-evaluation-problem)
7. [Fair Evaluation Framework — What Was Built](#7-fair-evaluation-framework--what-was-built)
8. [How TARGET Results Were Obtained (No LLM Needed)](#8-how-target-results-were-obtained-no-llm-needed)
9. [How to Run GATeR Evaluation (LLM Required)](#9-how-to-run-gater-evaluation-llm-required)
10. [Metrics Explained](#10-metrics-explained)
11. [File-by-File Project Map](#11-file-by-file-project-map)
12. [Key Code Snippets](#12-key-code-snippets)
13. [Validated Results](#13-validated-results)

---

## 1. Research Background

### The Problem Domain: Automated Test Repair

When a library/dependency updates its API, tests in downstream projects break.  
Both TARGET and GATeR attempt to **automatically repair broken Java test code**.

### The Two Papers

**TARGET** (TaRGet: Automated Test Repair using Fine-Tuned Language Models)
- Published approach using **supervised fine-tuning** on CodeT5+ model
- Trained on TaRBench — a benchmark of 45,373 real Java test repair cases
- Uses beam search to generate multiple candidate repairs
- Evaluates with BLEU, CodeBLEU, Exact Match (EM), and Plausible Repair Rate

**GATeR** (Graph-Aware Test Repair)
- Our approach using **RAG (Retrieval-Augmented Generation)** with a Knowledge Graph
- No fine-tuning — zero-shot generation via Ollama + DeepSeek Coder 6.7B LLM
- Retrieves context from a Knowledge Graph (NetworkX + Kuzu) and vector store (LanceDB)
- Uses KGCompass relevance scoring to find the most relevant code entities

---

## 2. TARGET System — Complete Architecture

### Location
```
d:\Desktop\Target\TaRGET\
├── fine-tuning/          # Main code — training, evaluation, inference
├── repair-collection/    # Data collection tools
├── reproduction/         # Reproduction scripts for paper results
└── common/               # Shared utilities (git, maven, config)
```

### How TARGET Works (Step by Step)

```
Step 1: ENCODE — Convert raw test cases into model input/output pairs
  └── abstractEncoder.py: Constructs input format:
      [<TESTCONTEXT>] broken test code with [<BREAKAGE>]...[</BREAKAGE>] markers
      [<REPAIRCONTEXT>] prioritized change hunks [<HUNK>]...[</HUNK>]
  └── Output: the repaired line(s), or "// Deleted"

Step 2: FINETUNE — Fine-tune CodeT5+ (or PLBART/CodeGen) on the training pairs
  └── train.py: Standard HuggingFace training loop with Accelerate
  └── Model: Salesforce/codet5p-220m (220M parameters)
  └── Training set: 36,639 (input, output) pairs

Step 3: TEST — Generate predictions using beam search
  └── eval.py: For each test case, generate beam_size=40 candidates
  └── Pick best prediction (exact match if found, else first beam)
  └── Compute BLEU, CodeBLEU, Exact Match

Step 4: EXECUTE — Run each candidate repair to check if it actually works
  └── test_run.py: 
      - Checkout the correct git commit
      - Apply the candidate patch to the test file
      - Compile with Maven
      - Run the specific test method
      - Record verdict: SUCCESS / compile_error / failure / timeout
  └── test_run_stats.py: Aggregate verdicts → Plausible Repair Rate
```

### TARGET's Key Insight for Evaluation

**TARGET's predictions are PRE-COMPUTED.** The file:
```
d:\Desktop\Target\TaRGET\fine-tuning\TaRGet_Results\TaRGet_Results\Best_on_TaRBench\
├── test_predictions.json   # 7,103 predictions (each with 40 beam candidates)
├── test_verdicts.json      # 284,120 execution verdicts
├── test.json               # Test split data
├── train.json              # Training split data
└── valid.json              # Validation split data
```

This means: **To evaluate TARGET, we just LOAD its pre-computed predictions and verdicts.**  
No model inference needed. No LLM needed. No GPU needed.

### TARGET Input/Output Format

**Input** (tokenized, special tokens):
```
[<TESTCONTEXT>] @Test public void testFoo ( ) { 
  [<BREAKAGE>] SomeClass . oldMethod ( x ) ; [</BREAKAGE>] 
  assertEquals ( expected , result ) ; } 
[<REPAIRCONTEXT>] [<HUNK>] - oldMethod + newMethod [</HUNK>]
```

**Output** (tokenized repair lines):
```
SomeClass . newMethod ( x ) ;
```

**Prediction format** (test_predictions.json):
```json
{
  "ID": "twilio/twilio-java:629",
  "target": "TwilioRestClient.Domains.PRICING.toString ( ) ,",
  "preds": [
    "TwilioRestClient.Domains.PRICING.toString ( ) ,",   // beam 0 (exact match!)
    "TwilioRestClient . Domains . PRICING . toString ( ) ,",  // beam 1
    ... // up to 40 beams
  ]
}
```

**Verdict format** (test_verdicts.json):
```json
{
  "ID": "apache/flink:270",
  "rank": 0,
  "verdict": {"status": "success", "error_lines": null},
  "success": 1,
  "exec_time": 0.0
}
```

### TARGET Evaluation Code (eval.py)

```python
def compute_scores(pred_df):
    """For each prediction, check if ANY beam output matches target exactly."""
    eval_size = pred_df["ID"].nunique()
    em_size = 0
    best_preds = []
    targets = []
    for _, row in pred_df.iterrows():
        beam_outputs = row["preds"]
        target = row["target"]
        best_pred = beam_outputs[0]
        for output in beam_outputs:
            if output == target:
                em_size += 1
                best_pred = output
                break
        best_preds.append(best_pred)
        targets.append(target)
    
    em = round(em_size / eval_size * 100, 2)
    bleu_score, code_bleu_score = compute_bleu_scores(targets, best_preds)
    return bleu_score, code_bleu_score, em
```

### TARGET's Published Results on Full TaRBench Test Set (7,103 cases)

| Metric | Value |
|--------|-------|
| Exact Match | 66.08% (4,694 / 7,103) |
| Plausible Repair Rate | 80.04% (5,685 / 7,103) |
| Beam size | 40 candidates per test case |

---

## 3. GATeR System — Complete Architecture

### Location
```
c:\Users\Lenovo\Desktop\F25-222-R-GATeR\
├── gater.py                    # CLI entry point
├── web_server.py               # Flask web server (1,660 lines, 25+ endpoints)
├── requirements.txt
├── src/
│   ├── gatr/
│   │   ├── gatr_engine.py      # Main engine (2,317 lines) — THE core file
│   │   ├── context_compressor.py
│   │   └── rag_aggregator.py
│   ├── knowledge_graph/
│   │   └── kg_manager.py       # NetworkX graph manager  
│   ├── parsers/
│   │   ├── repo_parser.py      # Git repository parser
│   │   └── code_parser.py      # AST-based code parser
│   ├── relevance/
│   │   ├── relevance_scorer.py         # KGCompass scoring
│   │   ├── step5_relevance_scoring.py  # Step 5 implementation
│   │   ├── embedding_generator.py
│   │   └── path_calculator.py
│   ├── vector_storage/
│   │   ├── lance_manager.py            # LanceDB manager
│   │   ├── step6_vector_storage.py     # Step 6 implementation
│   │   ├── vector_indexer.py
│   │   └── lightweight_vector_storage.py
│   ├── kuzu_manager.py         # Kuzu graph database
│   └── incremental_manager.py  # Incremental update manager
├── templates/
│   ├── index.html              # Frontend (5,826 lines — D3 graph viz, repair UI)
│   └── error.html
├── evaluation/                 # ← NEW: Fair evaluation framework
│   ├── fair_eval_config.py
│   ├── tarbench_bridge.py
│   ├── metrics.py
│   ├── run_fair_evaluation.py
│   └── README_FAIR_EVALUATION.md
└── docs/                       # Documentation
```

### How GATeR Works (Step by Step)

```
Step 1: RAW CONTEXT INGESTION
  └── Parse the broken test code and error message
  └── Query Knowledge Graph (Kuzu) for related entities
  └── Query Vector Store (LanceDB) for semantically similar code
  └── Get KGCompass relevance scores

Step 2: CONTEXT COMPRESSION (Steps 2.1–2.6)
  └── 2.1: Hybrid scoring (KGCompass 0.7 + semantic 0.3)
  └── 2.2: Entity filtering (keep top-k by combined score)
  └── 2.3: Snippet compression
  └── 2.4: Test pattern compression
  └── 2.5: Annotation context trimming
  └── 2.6: Final context assembly

Step 3: RAG AGGREGATION (Steps 3.1–3.4)
  └── 3.1: Build repair context from KG paths
  └── 3.2: Find usage examples
  └── 3.3: Detect coding conventions
  └── 3.4: Assemble augmented context

Step 4: REPAIR GENERATION (GraphRAG Steps 7–9)
  └── Step 7: Parse error → identify broken entity
  └── Step 8: Search KG for semantically similar alternatives
  └── Step 9: Generate fix via Ollama LLM (DeepSeek Coder 6.7B)
      ├── Build rich prompt with KG alternatives + code context
      ├── Call Ollama API → get repaired code
      └── If LLM fails → fallback to rule-based repair using KG
```

### GATeR's Key Dependency: Ollama + DeepSeek LLM

**GATeR REQUIRES a running LLM** for repair generation. Specifically:

```bash
# Must be running before GATeR can generate repairs:
ollama serve                      # Start Ollama server
ollama pull deepseek-coder:6.7b   # Download the model (~4GB)
```

The LLM call happens in `gatr_engine.py`:
```python
def _call_ollama(self, prompt: str, temperature: float = 0.1, max_tokens: int = 4096):
    response = requests.post(
        f"{self.ollama_url}/api/generate",
        json={
            "model": self.ollama_model,   # "deepseek-coder:6.7b"
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "stop": ["---END---", "\n\n\n"]
            }
        },
        timeout=120
    )
```

Without Ollama, GATeR falls back to a **rule-based repair** (`_graphrag_fallback_repair`) which is much weaker — it just does string matching against KG entities.

### KGCompass Relevance Scoring Formula

$$S(f) = \beta^{l(f)} \cdot \left(\alpha \cdot \cos(e_i, e_f) + (1-\alpha) \cdot \text{lev}(t_i, t_f)\right)$$

Where:
- $\alpha = 0.3$ (embedding similarity weight)
- $\beta = 0.6$ (graph distance decay factor)
- $l(f)$ = graph path length from broken test to candidate entity
- $\cos(e_i, e_f)$ = cosine similarity of embeddings
- $\text{lev}(t_i, t_f)$ = normalized Levenshtein similarity of entity names

---

## 4. Why TARGET Needs No LLM but GATeR Does

This is the fundamental architectural difference:

### TARGET: Supervised Fine-Tuning (No LLM at eval time — model is baked in)

```
TRAINING PHASE (done once, already completed):
  TaRBench training data (36,639 pairs)
       ↓
  Fine-tune CodeT5+ model
       ↓
  Save checkpoint → checkpoint-best/

INFERENCE PHASE (what we do during evaluation):
  Load saved checkpoint (a ~220M parameter model, NOT a general LLM)
       ↓
  Feed tokenized input → model.generate(beam_size=40)
       ↓
  Get 40 candidate repair outputs
       ↓
  NO external API calls, NO Ollama, NO LLM server needed
```

**For our evaluation**: We don't even run TARGET's model. We use its **pre-computed predictions**
stored in `test_predictions.json` (7,103 entries × 40 beams each) and `test_verdicts.json`
(284,120 execution results). These files contain TARGET's already-generated outputs.

### GATeR: RAG + Zero-Shot LLM (LLM needed at every inference)

```
SETUP PHASE (must be done for each project):
  Parse repository → Build Knowledge Graph → Build Vector Index
       ↓
  Store in Kuzu DB + LanceDB

INFERENCE PHASE (what happens during evaluation):
  Broken test + error message
       ↓
  Query KG + Vector Store → get context
       ↓
  Build prompt with context
       ↓
  Call Ollama API → DeepSeek Coder 6.7B generates repair  ← REQUIRES RUNNING LLM
       ↓
  Return repaired code
```

**Key difference**: TARGET's "model" is a saved checkpoint — it's a file you load.  
GATeR's "model" is an external API server (Ollama) that must be running live.

### Practical Implications for Evaluation

| Aspect | TARGET | GATeR |
|--------|--------|-------|
| **LLM needed?** | ❌ No — uses pre-computed results | ✅ Yes — needs Ollama running |
| **GPU needed?** | ❌ No (results already exist) | ✅ Recommended (DeepSeek 6.7B) |
| **Time per case** | ~0s (just load from JSON) | ~10-60s (KG query + LLM generation) |
| **500 cases time** | < 1 minute | ~2-8 hours |
| **Dependencies** | Just Python + pandas | Python + Ollama + DeepSeek + Kuzu + LanceDB |
| **Can run offline?** | ✅ Yes | ❌ No (needs Ollama server) |

---

## 5. TaRBench Dataset — Full Details

### Location
```
d:\Desktop\Target\TaRGET\fine-tuning\TaRBench\TaRBench\
├── splits.csv                    # ID → train/valid/test assignment
└── projects/                     # Per-project datasets
    ├── apache/shardingsphere/    # 13,547 cases (largest)
    │   ├── dataset.json
    │   └── codeMining/
    ├── mock-server/mockserver/   # 3,048 cases
    ├── Alluxio/alluxio/          # 2,095 cases
    └── ... (59 projects total)
```

### Split Distribution
| Split | Count |
|-------|-------|
| Train | 36,639 |
| Valid | 1,631 |
| Test | 7,103 |
| **Total** | **45,373** |

### Verdict Distribution (in test split)
| Verdict | Count | % |
|---------|-------|---|
| compile_error | 5,439 | 76.6% |
| failure | 1,664 | 23.4% |

### Data Format (one test case from dataset.json)
```json
{
  "ID": "fasseg/exp4j:33",
  "name": "net.objecthunter.exp4j.shuntingyard.ShuntingYardTest.testShuntingYard2()",
  "bCommit": "abc123...",        // Before-repair commit
  "aCommit": "def456...",        // After-repair commit  
  "bPath": "src/test/java/.../ShuntingYardTest.java",
  "aPath": "src/test/java/.../ShuntingYardTest.java",
  "bSource": {                   // BROKEN test method
    "startLine": 40,
    "code": "@Test\n    public void testShuntingYard2() {\n        ..."
  },
  "aSource": {                   // REPAIRED test method (ground truth)
    "startLine": 40,
    "code": "@Test\n    public void testShuntingYard2() {\n        ..."
  },
  "hunk": {
    "sourceChanges": [           // Lines REMOVED
      {
        "line": "new HashSet<String>(Arrays.asList(\"x\"))",
        "type": "DELETE",
        "lineNo": 43
      }
    ],
    "targetChanges": [           // Lines ADDED (= ground truth repair)
      {
        "line": "new HashSet<>(Collections.singletonList(\"x\"))",
        "type": "ADD",
        "lineNo": 43
      }
    ],
    "type": "MODIFY"
  },
  "verdict": {
    "status": "compile_error",   // or "failure"
    "error_lines": [43]
  },
  "trivial": null                // null, true, or false
}
```

### How Ground Truth Is Defined

The ground truth repair = `hunk.targetChanges[*].line` joined together.

Example:
- **Broken**: `new HashSet<String>(Arrays.asList("x"))`
- **Ground truth**: `new HashSet<>(Collections.singletonList("x"))`

TARGET's model learns to produce exactly this line. GATeR must generate it from scratch with KG context + LLM.

---

## 6. The Evaluation Problem

### Three Issues Raised by Panel

**Issue 1: Dataset Size Mismatch**
- TARGET was evaluated on 7,103 test cases (full TaRBench test split)
- GATeR was evaluated on ~300 hand-picked cases
- ❌ Not comparable — different sizes, different distributions

**Issue 2: Exact Match Doesn't Apply to RAG Systems**
- TARGET's primary metric is Exact Match (66.08%)
- EM measures: does the output string-match the ground truth?
- TARGET was TRAINED on similar (input, output) pairs → it learned to reproduce tokens
- GATeR was NEVER trained on any pairs → it generates novel repairs
- A GATeR repair could be functionally correct but syntactically different → EM = 0
- ❌ EM inherently favors supervised fine-tuned models

**Issue 3: Paradigm Difference**
- TARGET = supervised learning (train model on data → test on similar data)
- GATeR = RAG + zero-shot (build KG → retrieve context → generate with LLM)
- ❌ Standard ML metrics don't fairly compare these paradigms

---

## 7. Fair Evaluation Framework — What Was Built

### Location
```
c:\Users\Lenovo\Desktop\F25-222-R-GATeR\evaluation\
├── __init__.py
├── fair_eval_config.py        # Paths, sampling params, metric config
├── tarbench_bridge.py         # TaRBench ↔ GATeR format conversion + sampling
├── metrics.py                 # All metrics with code normalization
├── run_fair_evaluation.py     # Main CLI runner
└── README_FAIR_EVALUATION.md  # Documentation
```

### The Solution: Same Data, Fair Metrics

```
TaRBench Test Split (7,103 cases, 59 Java projects)
                    │
        stratified_sample(500, seed=42)
        ┌───────────┴───────────┐
        │                       │
   GATeR Pipeline          TARGET Pre-computed
   (needs Ollama)          (just load JSON)
        │                       │
   Generated repair        Best beam prediction
        │                       │
        └───────── Shared Metrics ──────────┘
                       │
            BLEU, CodeBLEU, EM, Plausible Rate,
            Compilation %, Edit Distance, etc.
```

### Stratified Sampling Strategy

The 500-case sample is drawn using:
1. **Verdict stratification**: proportional compile_error vs failure
2. **Trivial stratification**: balance trivial vs non-trivial repairs
3. **Project diversity**: min 10 projects, max 80 cases per project
4. **Random seed 42**: fully reproducible

Validated: TARGET on 500-case sample (EM: 62.4%, Plausible: 81.2%) closely matches full dataset (EM: 66.08%, Plausible: 80.04%).

### Code Normalization (Critical for Fair Comparison)

TARGET outputs tokenized code: `assertThat ( x ) . hasSize ( 10 ) ;`  
TaRBench ground truth is raw: `assertThat(x).hasSize(10);`

The `normalize_code()` function in metrics.py canonicalizes both:
```python
def normalize_code(code: str) -> str:
    s = " ".join(code.split())           # collapse whitespace
    s = re.sub(r"\s*\(\s*", "(", s)      # f ( x ) → f(x
    s = re.sub(r"\s*\)\s*", ") ", s)     # normalize closing parens
    s = re.sub(r"\s*\.\s*", ".", s)      # obj . method → obj.method
    s = re.sub(r"\s*,\s*", ", ", s)      # normalize commas
    s = re.sub(r"\s*;\s*", "; ", s)      # normalize semicolons
    return s.strip()
```

### Metric Categories

| Category | Metrics | Purpose |
|----------|---------|---------|
| **Fair** (primary) | BLEU, CodeBLEU, Compilation Success %, Plausible Rate | Paradigm-agnostic — measure output quality |
| **Informational** | Exact Match, Beam EM | Reported with bias caveat |
| **Analysis** | Repair Attempt Rate, Line-Level Accuracy, Avg Edit Similarity | Extra diagnostics |

---

## 8. How TARGET Results Were Obtained (No LLM Needed)

### Step-by-step: What happens when you run `--skip-gater-run`

```python
# 1. Load TaRBench splits.csv → get 7,103 test IDs
test_ids = load_tarbench_test_ids()  # reads splits.csv

# 2. Load all 59 per-project dataset.json files → match to test IDs
test_cases = load_tarbench_test_cases()  # 7,103 cases with full data

# 3. Stratified sample → 500 cases
sample = stratified_sample(test_cases, n=500, seed=42)

# 4. Load TARGET's PRE-COMPUTED predictions (no model run, just JSON read!)
#    File: TaRGet_Results/Best_on_TaRBench/test_predictions.json
#    Contains: 7,103 entries, each with target + 40 beam predictions
target_preds = load_target_predictions(ids=sample_ids)

# 5. Load TARGET's PRE-COMPUTED verdicts (no test execution, just JSON read!)  
#    File: TaRGet_Results/Best_on_TaRBench/test_verdicts.json
#    Contains: 284,120 verdict entries (7,103 × 40 beams)
#    Each verdict says: SUCCESS / compile_error / failure / timeout

# 6. For each sampled case:
#    - Ground truth = hunk.targetChanges lines (from dataset.json)
#    - TARGET prediction = best beam output (exact match if exists, else beam[0])
#    - TARGET plausible = True if any verdict for this ID is "success"

# 7. Compute metrics using normalized text comparison
#    BLEU: corpus BLEU with smoothing
#    EM: normalized string match
#    Plausible: % of IDs with at least one successful verdict
```

**Key point**: Steps 4-5 are just `json.load()`. No model, no GPU, no LLM, no compilation.  
TARGET already ran its model and tests. We just read the results.

### The Pre-computed Results Files

**test_predictions.json** (7,103 entries):
```json
[
  {
    "ID": "twilio/twilio-java:629",
    "target": "TwilioRestClient.Domains.PRICING.toString ( ) ,",
    "preds": ["pred_beam_0", "pred_beam_1", ..., "pred_beam_39"]
  },
  ...
]
```

**test_verdicts.json** (284,120 entries — 7,103 tests × ~40 beams):
```json
[
  {
    "ID": "apache/flink:270",
    "rank": 0,
    "verdict": {"status": "success", "error_lines": null},
    "success": 1,
    "exec_time": 0.0
  },
  ...
]
```

Verdict status values: `success`, `failure`, `compile_error`, `test_not_executed`, `dependency_error`, `unrelated_compile_error`, `unknown`, `timeout`

---

## 9. How to Run GATeR Evaluation (LLM Required)

### Prerequisites

```bash
# 1. Install Ollama (https://ollama.ai)
# 2. Pull the model
ollama pull deepseek-coder:6.7b

# 3. Start Ollama server (runs on localhost:11434)
ollama serve

# 4. Install Python dependencies
cd c:\Users\Lenovo\Desktop\F25-222-R-GATeR
pip install -r requirements.txt
pip install nltk
python -c "import nltk; nltk.download('punkt')"
```

### What Happens When GATeR Runs on Each Test Case

```python
def run_gater_on_record(record):
    # 1. Convert TaRBench case → GATeR input format
    broken_test = {
        "test_name": "org.example.FooTest.testBar()",
        "test_code": "<broken test method source code>",
        "test_file": "src/test/java/.../FooTest.java",
        "test_class": "FooTest",
        "test_method": "testBar",
    }
    error_message = "Java compilation error at line 43: <failing code>"
    
    # 2. Initialize GATeR engine (connects to Kuzu + LanceDB + Ollama)
    engine = GATREngine()
    
    # 3. Run full pipeline (~10-60 seconds per case):
    #    Step 1: Query KG for related entities
    #    Step 2: Compress context (hybrid scoring)
    #    Step 3: RAG aggregation (build repair context)
    #    Step 4: Call Ollama LLM → generate repair
    result = engine.repair_test(broken_test, error_message)
    
    # 4. Extract changed lines for metric comparison
    repaired_lines = extract_changed_lines(original_code, result.repaired_code)
```

### Running the Full Evaluation

```bash
# Full evaluation (500 cases, requires Ollama running):
python -m evaluation.run_fair_evaluation

# Only TARGET metrics (no Ollama needed):
python -m evaluation.run_fair_evaluation --skip-gater-run

# Custom parameters:
python -m evaluation.run_fair_evaluation --sample-size 1000 --seed 42
```

### Environment Variables (Optional)

```bash
set OLLAMA_BASE_URL=http://localhost:11434
set OLLAMA_MODEL=deepseek-coder:6.7b
set TARBENCH_ROOT=d:\Desktop\Target\TaRGET\fine-tuning\TaRBench\TaRBench
set TARGET_RESULTS_DIR=d:\Desktop\Target\TaRGET\fine-tuning\TaRGet_Results\TaRGet_Results\Best_on_TaRBench
set GATER_ROOT=c:\Users\Lenovo\Desktop\F25-222-R-GATeR
```

---

## 10. Metrics Explained

### BLEU (Bilingual Evaluation Understudy)
- Corpus-level n-gram overlap between predicted and ground-truth repair lines
- Range: 0–100 (higher = better)
- Uses smoothing to handle short sequences
- **Fair**: purely measures text similarity, no paradigm bias

### CodeBLEU
- Weighted combination: n-gram match + keyword match + syntax tree match + data flow match
- Equal weights: α=β=γ=θ=0.25
- Java-specific keywords from `CodeBLEU/keywords/java.txt`
- Currently falls back to BLEU if CodeBLEU dependencies have version conflicts
- **Fair**: code-aware similarity metric

### Exact Match (EM)
- % of predictions that exactly equal ground truth after normalization
- TARGET computes "beam EM": any of 40 candidates matches → EM=1 for that case
- **BIASED toward TARGET**: it was trained to reproduce these exact outputs

### Plausible Repair Rate
- % of test cases where at least one candidate repair compiles AND passes the test
- Requires actual Maven compilation and test execution
- **THE fairest metric**: doesn't care about syntax, only about whether the test works
- TARGET's plausible rate: 80.04% on full test set, 81.2% on our 500-case sample

### Compilation Success %
- Lightweight Java syntax validation (balanced braces/parens)
- Not a real compiler — catches obvious generation failures
- **Fair**: measures structural correctness of generated code

### Avg Edit Similarity
- Normalized Levenshtein ratio between prediction and ground truth
- Range: 0–100 (higher = more similar)
- Uses `difflib.SequenceMatcher`
- **Fair**: continuous measure of textual closeness

---

## 11. File-by-File Project Map

### GATeR Core Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/gatr/gatr_engine.py` | 2,317 | Main engine — 4-step pipeline, LLM calls, repair generation |
| `src/gatr/context_compressor.py` | ~400 | Step 2: Context compression (2.1–2.6) |
| `src/gatr/rag_aggregator.py` | ~350 | Step 3: RAG aggregation (3.1–3.4) |
| `src/knowledge_graph/kg_manager.py` | ~600 | NetworkX graph manager, entity/edge CRUD |
| `src/kuzu_manager.py` | ~400 | Kuzu graph database integration |
| `src/relevance/relevance_scorer.py` | ~300 | KGCompass scoring formula |
| `src/relevance/embedding_generator.py` | ~200 | Sentence-transformer embeddings |
| `src/relevance/path_calculator.py` | ~150 | Graph path length computation |
| `src/vector_storage/lance_manager.py` | ~350 | LanceDB vector operations |
| `src/vector_storage/step6_vector_storage.py` | ~400 | Full LanceDB integration |
| `src/parsers/repo_parser.py` | ~500 | Git repository parsing |
| `src/parsers/code_parser.py` | ~400 | AST-based code parsing (Python + Java) |
| `web_server.py` | 1,660 | Flask web server, 25+ REST endpoints |
| `templates/index.html` | 5,826 | Frontend: D3 graph viz, repair UI, KGCompass form |

### TARGET Core Files

| File | Lines | Purpose |
|------|-------|---------|
| `fine-tuning/eval.py` | ~120 | BLEU, CodeBLEU, EM computation |
| `fine-tuning/train.py` | ~200 | HuggingFace training loop |
| `fine-tuning/main.py` | ~150 | CLI entry point (encode/finetune/test) |
| `fine-tuning/dataset.py` | ~200 | PyTorch Dataset classes |
| `fine-tuning/test_run.py` | ~200 | Maven compilation + test execution |
| `fine-tuning/test_run_stats.py` | ~100 | Verdict aggregation |
| `fine-tuning/encoders/abstractEncoder.py` | ~200 | Input/output format construction |
| `fine-tuning/CodeBLEU/code_bleu.py` | ~65 | CodeBLEU metric implementation |

### Evaluation Framework Files

| File | Lines | Purpose |
|------|-------|---------|
| `evaluation/fair_eval_config.py` | ~70 | Configuration constants |
| `evaluation/tarbench_bridge.py` | ~280 | Data loading, sampling, format conversion |
| `evaluation/metrics.py` | ~340 | All metrics + normalization + comparison table |
| `evaluation/run_fair_evaluation.py` | ~310 | 5-step evaluation pipeline + CLI |

---

## 12. Key Code Snippets

### How TaRBench Cases Are Converted to GATeR Input

```python
def tarbench_to_gater_input(case: dict) -> Dict:
    b_source = case.get("bSource", {})
    test_code = b_source.get("code", "")      # Broken test method source
    test_name = case.get("name", "")            # Full qualified test name
    
    broken_test = {
        "test_name": test_name,
        "test_code": test_code,
        "test_file": case.get("bPath", ""),
        "test_class": extract_class(test_name),
        "test_method": extract_method(test_name),
    }
    
    # Synthesize error message from TaRBench metadata
    # (TaRBench doesn't store actual compiler output)
    error_message = construct_error_message(case)
    
    return {"broken_test": broken_test, "error_message": error_message}
```

### How Error Messages Are Synthesized

```python
def construct_error_message(case: dict) -> str:
    verdict = case.get("verdict", {})
    status = verdict.get("status", "unknown")       # "compile_error" or "failure"
    error_lines = verdict.get("error_lines", [])    # [43]
    source_changes = case["hunk"].get("sourceChanges", [])
    failing_code = " ; ".join(sc.get("line", "") for sc in source_changes)
    
    if status == "compile_error":
        return f"Java compilation error at line {error_lines}: {failing_code}"
    elif status == "failure":
        return f"Test failure at line {error_lines}: {failing_code}"
```

### How Ground Truth Is Extracted

```python
def extract_ground_truth(case: dict) -> Dict:
    target_changes = case["hunk"].get("targetChanges", [])
    repaired_lines = "\n".join(tc.get("line", "") for tc in target_changes)
    return {
        "repaired_lines": repaired_lines,                   # For BLEU/EM
        "repaired_full_code": case["aSource"].get("code", ""),  # Full method
    }
```

### How TARGET Predictions Are Loaded (No Model Inference)

```python
def load_target_predictions(ids=None):
    # Just read JSON files — no model needed!
    with open(TARGET_PREDICTIONS_FILE) as f:
        all_preds = json.load(f)        # 7,103 entries
    with open(TARGET_VERDICTS_FILE) as f:
        all_verdicts = json.load(f)     # 284,120 entries
    
    # Index verdicts: ID → has at least one "success"
    verdict_map = {}
    for v in all_verdicts:
        if v["verdict"]["status"] == "success":
            verdict_map[v["ID"]] = True
    
    # Build result
    result = {}
    for pred in all_preds:
        if ids and pred["ID"] not in ids:
            continue
        result[pred["ID"]] = {
            "target": pred["target"],
            "preds": pred["preds"],              # 40 beam candidates
            "best_pred": pick_best(pred),         # exact match or beam[0]
            "exact_match": any(p == pred["target"] for p in pred["preds"]),
            "plausible": verdict_map.get(pred["ID"], False),
        }
    return result
```

---

## 13. Validated Results

### TARGET on 500-Case Stratified Sample (seed=42)

| Metric | Value |
|--------|-------|
| BLEU | 62.37 |
| CodeBLEU | 62.37 (fallback to BLEU) |
| Compilation Success % | 83.80 |
| Plausible Repair Rate % | 81.20 |
| Exact Match % | 62.40 |
| Exact Match (beam) % | 63.60 |
| Repair Attempt Rate % | 100.00 |
| Avg Edit Similarity % | 87.47 |

**Sample characteristics**: 500 cases across 56 projects, stratified by verdict type and triviality.

### TARGET on Full Test Set (7,103 cases) — Reference

| Metric | Value |
|--------|-------|
| Exact Match | 66.08% |
| Plausible Rate | 80.04% |
| Beam size | 40 |

**Validation**: The 500-case sample closely matches the full dataset stats,
confirming the stratified sampling is representative.

### GATeR Results: Pending

GATeR results require running Ollama + DeepSeek Coder 6.7B on each of the 500 cases.
Use: `python -m evaluation.run_fair_evaluation` (after starting Ollama).

---

## Summary for Any LLM Reading This

1. **TARGET** is a fine-tuned CodeT5+ model. Its results are pre-computed in JSON files. To evaluate it, just load `test_predictions.json` and `test_verdicts.json`. No LLM, no GPU, no model inference needed.

2. **GATeR** is a RAG system that needs Ollama + DeepSeek Coder 6.7B running live. Each test case takes 10-60 seconds because it queries a Knowledge Graph, builds context, and calls the LLM API.

3. The **fair evaluation framework** samples 500 cases from TaRBench, runs both systems on the same cases, and compares using **paradigm-agnostic metrics** (BLEU, CodeBLEU, Plausible Rate). Exact Match is reported as informational only because it's biased toward supervised models.

4. To reproduce: `python -m evaluation.run_fair_evaluation` from `c:\Users\Lenovo\Desktop\F25-222-R-GATeR\`.
