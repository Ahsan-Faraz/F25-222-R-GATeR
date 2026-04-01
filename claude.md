# GATeR — Context for AI Assistants (Claude / Cursor)

Use this file to stay aligned with **what the repo actually contains**, the **research story**, and **frontend UX** without re-deriving from scratch.

---

## 1. Research Framing

### TARGET (baseline)

- Supervised **automated test repair** using transformer-style sequence models.
- Trained on **~36,639** (failing test, repaired test) pairs; evaluated on **TaRBench**-style data (**7,103** tests / **59** Java repos in baseline materials).
- Strength: strong fit to **seen** distributions; good token overlap with references.
- Limits: **memorization**, weak **out-of-distribution** generalization, **plain-sequence** code representation, **no explicit structure**.

### GATeR (this repository)

- **No supervised repair training.**  
- Builds a **repository-level knowledge graph**, runs **hybrid retrieval** (graph + CodeBERT vectors in LanceDB), assembles **GraphRAG** context, calls a **zero-shot LLM** (e.g., via Ollama).
- Core claim to defend in writing: **structured repository context can substitute for large-scale supervised repair training** for strong repair quality and better robustness.

### Reported fair comparison (project materials)

- **1,207** cases, **59** repos, **same case IDs** for TARGET vs GATeR.
- GATeR leads on BLEU, CodeBLEU, compilation success, line-level accuracy, edit similarity, near-miss > 50%; **plausible repair rate** ~matches (tiny delta).
- **Exact match** is intentionally de-emphasized: supervised baseline can memorize; LLM outputs vary in whitespace/equivalent syntax.

**Critical stance for papers:** validate plausible repair with **execution / tests** where possible; discuss **data leakage**, **LLM stochasticity**, and **metric choice** (BLEU/CodeBLEU limits for code).

---

## 2. Pipeline (All Steps Implemented in Principle)

| Phase | Step | Content |
|-------|------|---------|
| Understand | 1 | GitHub API + GitPython: PRs, issues, commits |
| | 2 | Tree-sitter: Java + Python AST entities |
| | 3 | KG: KGCompass-style relations (CALLS, IMPORTS, …) |
| | 4 | Kuzu + NetworkX |
| Retrieve | 5 | Relevance / path scoring |
| | 6 | Embeddings (CodeBERT) → LanceDB |
| | 7 | Hybrid retrieval |
| Generate | 8 | GraphRAG context packaging |
| | 9 | LLM repair (Ollama) |

Backend entry: **`web_server.py`** (Flask), default **port 5000**.

---

## 3. Frontend — What Exists and How It Looks

### Facts from the codebase (prefer over older spec-only text)

- **`frontend/package.json`:** Next **14.2.18**, React **18.3.x**, NextAuth **4.24.x** — not Next 16 / React 19 (those appear only in older draft text inside `FRONTEND_IMPLEMENTATION.md`).
- **Routing:** Main dashboard is **`pages/index.tsx`**. Content is selected by **`router.query.section`** (`repo`, `kg`, `kgvis`, `kgcompass`, `kuzu`, `vectors`, `gatr`, `export`). Default section: **repo**.
- **Auth:** `useSession` — if **loading**, skeleton; if **unauthenticated**, **`LandingPage`** (full marketing-style landing with Framer Motion + Lucide); if authenticated, dashboard sections inside **`Layout`**.
- **Layout (`Layout.tsx`):** **Black** workspace aesthetic; **240px left sidebar** with icons (Lucide): Repository, Knowledge Graph, Visualization, KGCompass, KUZU DB, Vector Search, Test Repair, Export. **⌘K / Ctrl+K** opens a **command palette** to filter-jump sections. **Breadcrumb**: Workspace → user name → current section. **Sticky** top bar with “Connected” green dot. **User block** at bottom: avatar, name, email, Sign out.
- **`Header.tsx`:** Exists in the repo but is **not** imported by `pages/_app.tsx`; navigation is **`Layout.tsx`** (sidebar + breadcrumb). `Header.tsx` looks like leftover or alternate chrome.
- **Styling:** Tailwind; design tokens in `globals.css` / Tailwind config (dark command-center, accent highlights).
- **API:** Client uses **`/api/backend/...`**; Next **rewrites** to Flask **`http://127.0.0.1:5000`**.

### Feature coverage (integrated)

GitHub OAuth, repo list/select/analyze, **analysis progress polling**, KG stats, **KG visualization** (D3-related components), **Kuzu** query UI, **vector** stats + semantic search, **KGCompass** panel, **GATR** test repair panel, **export** panel, toasts.

### Operational notes

- **Default dev URL:** **http://localhost:3000** per `frontend/README.md`. `README_FRONTEND_COMPLETE.md` mentions **3004** — that is environment-specific; align **`NEXTAUTH_URL`** with the port you use.
- Backend must be up **before** meaningful API calls; analysis must **finish** before KG/Kuzu/vectors show non-empty data.

### Where to read more

- **`README_FRONTEND_COMPLETE.md`** — fix list, API field mappings, testing checklist.  
- **`FRONTEND_IMPLEMENTATION.md`** — long-form module list and API sketches (verify against code; versions may be stale).  
- **`frontend/TESTING_GUIDE.md`** — manual test flows.

---

## 4. Repository Layout (High Level)

- **`frontend/`** — Next.js app.  
- **`src/`** (repo root) — Python backend / GATeR logic.  
- **`workspace/`** — local clones / analysis targets.  
- **`docs/`** — papers and backend-oriented README.  
- **`web_server.py`** — Flask.

---

## 5. Suggested Ablations (Research)

- Vector-only vs graph-only vs hybrid retrieval.  
- No GitHub metadata vs full KG.  
- Different LLMs / temperatures; self-consistency.  
- Chunking and token budget for GraphRAG.  
- Human or CI plausible-repair validation on a subset.

---

## 6. What to Avoid Assuming

- Do not assume **Exact match** is the headline metric.  
- Do not assume frontend package versions from **`FRONTEND_IMPLEMENTATION.md`** alone — check **`frontend/package.json`**.  
- Do not assume every architectural detail in **`docs/README.md`** (iteration-1 Flask dashboard) matches only the Next UI — the **current** primary UI is under **`frontend/`**.

---

*Maintained for context-aware assistance; update when evaluation numbers or major features change.*
