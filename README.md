# GATeR — Graph-Aware Test Repair

**Repository status overview** (what is implemented and how to run it). This document summarizes the research system, evaluation against the TARGET baseline, the end-to-end pipeline, and the current **Next.js** frontend.

---

## What This Project Is

**GATeR** (Graph-Aware Test Repair) is a **fully implemented** system that repairs failing tests using **repository-level knowledge graphs**, **hybrid retrieval** (graph + dense vectors), and **zero-shot LLM** generation—without supervised training on repair pairs.

The baseline **TARGET** is a supervised sequence model trained on large (input test, repaired test) corpora; GATeR tests the thesis that **rich structured context can substitute for training**.

---

## Research Positioning (Short)

| Aspect | TARGET (baseline) | GATeR (this repo) |
|--------|-------------------|-------------------|
| Paradigm | Supervised sequence learning | Graph + RAG + LLM |
| Training | ~36k repair pairs | None (zero-shot) |
| Code view | Plain text / tokens | AST + KG + embeddings |
| Context | Local / implicit | Repository-wide, hybrid |

**Fair evaluation** (aligned case IDs, TaRBench-derived setup): **1,207** test cases across **59** repositories. Primary metrics reported in project materials include BLEU, CodeBLEU, compilation success, line-level accuracy, edit similarity, near-miss rate, and plausible repair rate. Exact match is **not** treated as a primary metric where it would favor memorization for supervised baselines.

---

## End-to-End Pipeline (Implemented)

1. **Repository access** — GitHub API (PyGithub), GitPython; PRs, issues, commits, metadata.  
2. **Parsing** — Tree-sitter (Python + Java); classes, methods, tests, imports, etc.  
3. **Knowledge graph** — KGCompass-style modeling; entities + relationships (e.g., CALLS, IMPORTS, BELONGS_TO, MODIFIES, TESTS).  
4. **Storage** — Kuzu + NetworkX (dual use as documented in project docs).  
5. **Relevance** — Graph path scoring and structural weighting.  
6. **Vectors** — CodeBERT embeddings; LanceDB (or project’s Lance integration).  
7. **Retrieval** — Hybrid: graph traversal + vector similarity.  
8. **GraphRAG** — Context assembly with relevance and token limits.  
9. **Repair** — LLM via Ollama (e.g., DeepSeek), zero-shot.

---

## What Is Done — Backend / Core

- Flask API: `web_server.py` (default **http://127.0.0.1:5000**).  
- Knowledge graph build, Kuzu queries, KGCompass-style relevance, vector search, GATR repair endpoints, export.  
- Workspace layout: analyzed repos under `workspace/`; graph artifacts as documented in `docs/` and existing READMEs.

For deeper backend iteration notes, see `docs/README.md`.

---

## What Is Done — Frontend

**Status:** Complete for integration and demo; production hardening is left to deployment choices.

- **Stack:** Next.js **14.2.18** (Pages Router), React 18, TypeScript, Tailwind CSS, NextAuth.js (GitHub OAuth).  
- **Proxy:** `frontend/next.config.js` rewrites `/api/backend/*` → Flask `http://127.0.0.1:5000/*`.  
- **UI model:** Authenticated **command-center** layout: fixed **left sidebar** (8 sections), **breadcrumb** header, **⌘/Ctrl+K** command palette to jump sections, dark theme, “Connected” status indicator.  
- **Unauthenticated:** Animated **landing page** (Framer Motion, Lucide icons) with GitHub sign-in—not a bare login-only screen.  
- **Sections** (`/?section=...`): Repository → Knowledge Graph → Visualization → KGCompass → KUZU DB → Vector Search → Test Repair → Export.  
- **Features:** Repo add/analyze with **progress polling**, KG stats, **SVG/D3-style KG visualization**, Kuzu explorer, semantic vector search, KGCompass panel, GATR repair flow, export (CSV/JSON/JSONL per API), toasts and loading states.

**Docs:** Detailed UI/API notes: `README_FRONTEND_COMPLETE.md`, `FRONTEND_IMPLEMENTATION.md`, `frontend/README.md`, `frontend/TESTING_GUIDE.md`.

---

## Quick Start

### Backend

```bash
cd <repo-root>
pip install -r requirements.txt
python web_server.py
```

### Frontend

```bash
cd frontend
npm install
# Configure .env.local — see frontend/README.md (NEXTAUTH_*, GITHUB_*, NEXT_PUBLIC_FLASK_URL)
npm run dev
```

Open **http://localhost:3000** (default). If you use another port (e.g. 3004), set `NEXTAUTH_URL` accordingly.

---

## Documentation Map

| File | Purpose |
|------|---------|
| `README.md` (this file) | Project status: research framing, pipeline, frontend, run instructions |
| `README_FRONTEND_COMPLETE.md` | Frontend completion checklist, bugfix history, API field mappings |
| `FRONTEND_IMPLEMENTATION.md` | Original frontend architecture and API module reference |
| `docs/README.md` | Backend / iteration-1 system overview |
| `frontend/README.md` | Frontend install and env |
| `claude.md` | **Context file for AI assistants** (research + implementation snapshot) |

---

## License and Citation

Follow the license file in the repository if present. For papers, cite the project’s formal title and venue when available; this README does not replace the LaTeX paper sources under `docs/`.

---

*Last updated: April 2026 — aligned with repository layout and `frontend/package.json`.*
