"""
Helpers for managing per-project repository artifacts used during evaluation.

This module maps TaRBench project keys (owner/repo) to repo-specific Kuzu and
LanceDB paths so GATeR can use isolated stores per repository.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, Optional


def sanitize_project_key(project_key: str) -> str:
    """Convert owner/repo keys into filesystem-safe names."""
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", project_key.strip())
    return cleaned.replace("/", "__")


def default_project_store_paths(project_key: str, stores_root: Path) -> Dict[str, str]:
    """Build default per-project store paths under a root directory."""
    project_dir = stores_root / sanitize_project_key(project_key)
    return {
        "project_key": project_key,
        "project_dir": str(project_dir),
        "kuzu_db_path": str(project_dir / "kuzu_db"),
        "lancedb_path": str(project_dir / "lancedb"),
    }


class RepoStoreResolver:
    """Resolve per-project repo/store paths from a manifest file."""

    def __init__(self, manifest_path: Path, stores_root: Path):
        self.manifest_path = Path(manifest_path)
        self.stores_root = Path(stores_root)
        self.manifest = self._load_manifest()

    def _load_manifest(self) -> Dict:
        if not self.manifest_path.exists():
            return {}
        try:
            return json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def get(self, project_key: str) -> Dict[str, str]:
        """
        Resolve per-project paths.

        If the project key is not present in the manifest, return deterministic
        default locations under stores_root.
        """
        projects = self.manifest.get("projects", {})
        if project_key in projects:
            entry = projects[project_key]
            return {
                "project_key": project_key,
                "project_dir": entry.get("store_root", str(self.stores_root / sanitize_project_key(project_key))),
                "kuzu_db_path": entry.get("kuzu_db_path", str(self.stores_root / sanitize_project_key(project_key) / "kuzu_db")),
                "lancedb_path": entry.get("lancedb_path", str(self.stores_root / sanitize_project_key(project_key) / "lancedb")),
                "repo_path": entry.get("repo_path", ""),
            }
        return default_project_store_paths(project_key, self.stores_root)


def load_repo_store_manifest(manifest_path: Path) -> Dict:
    """Load manifest JSON if present; otherwise return an empty dict."""
    manifest_path = Path(manifest_path)
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_repo_store_manifest(manifest_path: Path, manifest: Dict) -> None:
    """Write manifest JSON with stable formatting."""
    manifest_path = Path(manifest_path)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
