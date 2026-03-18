"""
Preprocess TaRBench repositories into per-project evaluation stores.

For each project (owner/repo):
1. Clone repository into a deterministic local path.
2. Build a repository-specific Kuzu knowledge graph.
3. Build a repository-specific LanceDB vector store.
4. Save a manifest mapping project keys to store paths.

Usage:
    python -m evaluation.preprocess_repo_stores --max-projects 10
    python -m evaluation.preprocess_repo_stores --projects Alluxio/alluxio apache/commons-lang
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import subprocess
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from evaluation.fair_eval_config import (
    EVAL_REPO_STORE_MANIFEST,
    EVAL_REPOS_DIR,
    EVAL_STORES_DIR,
)
from evaluation.repo_store_manager import (
    sanitize_project_key,
    save_repo_store_manifest,
)
from evaluation.tarbench_bridge import load_all_project_datasets

from src.extractors.entity_extractor import EntityExtractor
from src.knowledge_graph.kg_manager import KnowledgeGraphManager
from src.parsers.code_parser import ProjectParser
from src.relevance.step5_relevance_scoring import Step5RelevanceScoring
from src.vector_storage.step6_vector_storage import Step6VectorStorage


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("evaluation.preprocess")


def _run_git(args: List[str], cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=str(cwd) if cwd else None,
        check=False,
        capture_output=True,
        text=True,
    )


def _ensure_repo_cloned(project_key: str, repos_root: Path) -> Path:
    owner, repo = project_key.split("/", 1)
    repo_path = repos_root / f"{owner}_{repo}"
    url = f"https://github.com/{project_key}.git"

    repos_root.mkdir(parents=True, exist_ok=True)

    if (repo_path / ".git").exists():
        logger.info("Repo exists, fetching updates: %s", project_key)
        _run_git(["fetch", "--all", "--tags"], cwd=repo_path)
        return repo_path

    if repo_path.exists() and not (repo_path / ".git").exists():
        shutil.rmtree(repo_path, ignore_errors=True)

    logger.info("Cloning %s", url)
    result = _run_git(["clone", "--depth", "1", url, str(repo_path)])
    if result.returncode != 0:
        raise RuntimeError(f"git clone failed for {project_key}: {result.stderr.strip()}")
    return repo_path


def _select_representative_commit(cases: List[dict]) -> str:
    commits = [c.get("bCommit") for c in cases if c.get("bCommit")]
    if not commits:
        return ""
    return Counter(commits).most_common(1)[0][0]


def _try_checkout_commit(repo_path: Path, commit: str) -> bool:
    if not commit:
        return False
    # Skip checkout if the commit is not present locally after fetch.
    rev_parse = _run_git(["rev-parse", "--verify", commit], cwd=repo_path)
    if rev_parse.returncode != 0:
        logger.warning("Commit %s not found locally for %s", commit, repo_path.name)
        return False
    checkout = _run_git(["checkout", commit], cwd=repo_path)
    if checkout.returncode != 0:
        logger.warning("Failed to checkout %s in %s: %s", commit, repo_path.name, checkout.stderr.strip())
        return False
    return True


def _build_kg_and_vectors(project_key: str, repo_path: Path, store_root: Path) -> Dict:
    kuzu_db_path = store_root / "kuzu_db"
    lancedb_path = store_root / "lancedb"

    parser = ProjectParser()
    extractor = EntityExtractor()

    logger.info("Parsing project files: %s", project_key)
    parsed = parser.parse_project(str(repo_path))
    extracted = extractor.extract_entities(parsed)

    entities = extracted.get("entities", [])
    relationships = extracted.get("relationships", [])

    logger.info("Building Kuzu KG (%d entities, %d relationships)", len(entities), len(relationships))
    kg_manager = KnowledgeGraphManager(kuzu_db_path=str(kuzu_db_path), auto_load=False)
    kg_manager.clear()
    kg_manager.add_entities(entities)
    kg_manager.add_relationships(relationships)

    logger.info("Building LanceDB embeddings")
    vector_storage = Step6VectorStorage(db_path=str(lancedb_path), workspace_dir=str(store_root))
    # Build embeddings for all KG entities and sync into LanceDB.
    scorer = Step5RelevanceScoring(workspace_dir=str(store_root), auto_store_vectors=False)
    sync_result = vector_storage.embedding_sync.sync_from_knowledge_graph(
        kg_manager=kg_manager,
        relevance_scorer=scorer,
        clear_existing=True,
    )

    db_stats = vector_storage.get_database_stats()
    kg_stats = kg_manager.get_statistics()

    return {
        "kuzu_db_path": str(kuzu_db_path),
        "lancedb_path": str(lancedb_path),
        "kg_stats": kg_stats,
        "vector_sync": sync_result,
        "vector_db_stats": db_stats,
    }


def preprocess_projects(project_keys: List[str], force_rebuild: bool = False) -> Dict:
    repos_root = EVAL_REPOS_DIR
    stores_root = EVAL_STORES_DIR

    manifest = {
        "generated_at": datetime.now().isoformat(),
        "stores_root": str(stores_root),
        "repos_root": str(repos_root),
        "projects": {},
    }

    datasets = load_all_project_datasets()

    for idx, project_key in enumerate(project_keys, start=1):
        logger.info("[%d/%d] Preprocessing %s", idx, len(project_keys), project_key)

        if project_key not in datasets:
            logger.warning("Project not found in TaRBench datasets: %s", project_key)
            continue

        safe_name = sanitize_project_key(project_key)
        store_root = stores_root / safe_name
        store_root.mkdir(parents=True, exist_ok=True)

        if force_rebuild and store_root.exists():
            shutil.rmtree(store_root, ignore_errors=True)
            store_root.mkdir(parents=True, exist_ok=True)

        repo_path = _ensure_repo_cloned(project_key, repos_root)

        representative_commit = _select_representative_commit(datasets[project_key])
        checked_out = _try_checkout_commit(repo_path, representative_commit)

        build_result = _build_kg_and_vectors(project_key, repo_path, store_root)

        manifest["projects"][project_key] = {
            "repo_path": str(repo_path),
            "store_root": str(store_root),
            "kuzu_db_path": build_result["kuzu_db_path"],
            "lancedb_path": build_result["lancedb_path"],
            "representative_bCommit": representative_commit,
            "representative_commit_checked_out": checked_out,
            "kg_stats": build_result["kg_stats"],
            "vector_sync": build_result["vector_sync"],
            "vector_db_stats": build_result["vector_db_stats"],
            "updated_at": datetime.now().isoformat(),
        }

    save_repo_store_manifest(EVAL_REPO_STORE_MANIFEST, manifest)
    logger.info("Saved repo-store manifest to %s", EVAL_REPO_STORE_MANIFEST)
    return manifest


def _select_projects(all_projects: List[str], args: argparse.Namespace) -> List[str]:
    if args.projects:
        return [p for p in args.projects if p in all_projects]

    selected = sorted(all_projects)
    if args.max_projects is not None:
        selected = selected[: args.max_projects]
    return selected


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Preprocess TaRBench repositories into per-project Kuzu and LanceDB stores"
    )
    parser.add_argument(
        "--projects",
        nargs="*",
        help="Explicit project keys to process (format: owner/repo)",
    )
    parser.add_argument(
        "--max-projects",
        type=int,
        default=None,
        help="Limit number of projects processed (default: all)",
    )
    parser.add_argument(
        "--force-rebuild",
        action="store_true",
        help="Delete existing per-project stores before rebuilding",
    )
    args = parser.parse_args()

    datasets = load_all_project_datasets()
    all_projects = sorted(datasets.keys())
    selected_projects = _select_projects(all_projects, args)

    logger.info("Selected %d projects for preprocessing", len(selected_projects))
    manifest = preprocess_projects(selected_projects, force_rebuild=args.force_rebuild)

    print(json.dumps({
        "processed_projects": len(manifest.get("projects", {})),
        "manifest": str(EVAL_REPO_STORE_MANIFEST),
    }, indent=2))


if __name__ == "__main__":
    main()
