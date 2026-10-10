"""Optional public-repo lookup for Code Investigations. Read-only. No tokens."""

from __future__ import annotations

import subprocess
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import System

_REPO_ROOT = Path(__file__).resolve().parents[2] / "data" / "repos"


def connect_public_repo(db: Session, system: System, repo_url: str, repo_ref: str = "main") -> System:
    url = (repo_url or "").strip()
    ref = (repo_ref or "main").strip() or "main"
    if not url.startswith("https://") or " " in url:
        system.code_status = "fetch_failed"
        system.repo_url = url or None
        system.repo_ref = ref
        raise ValueError("Only a public https git URL is supported")
    dest = _REPO_ROOT / system.id
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        subprocess.run(["git", "-C", str(dest), "fetch", "--depth", "1", "origin", ref], check=False)
        pull = subprocess.run(
            ["git", "-C", str(dest), "checkout", ref],
            capture_output=True,
            text=True,
        )
        ok = pull.returncode == 0
    else:
        clone = subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", ref, url, str(dest)],
            capture_output=True,
            text=True,
        )
        ok = clone.returncode == 0
    system.repo_url = url
    system.repo_ref = ref
    system.code_status = "connected" if ok else "fetch_failed"
    db.flush()
    if not ok:
        raise ValueError("Could not clone that public repository")
    return system


def search_citations(system_id: str, terms: list[str], *, limit: int = 5) -> list[dict]:
    root = _REPO_ROOT / system_id
    if not root.exists():
        return []
    needles = [t.strip().lower() for t in terms if t and t.strip()]
    if not needles:
        return []
    hits: list[dict] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in {".py", ".ts", ".tsx", ".js", ".md", ".json", ".yml", ".yaml"}:
            continue
        if ".git" in path.parts:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        lower = text.lower()
        if not any(n in lower for n in needles):
            continue
        line_no = 1
        for line in text.splitlines():
            if any(n in line.lower() for n in needles):
                hits.append(
                    {
                        "path": str(path.relative_to(root)),
                        "line": line_no,
                        "text": line.strip()[:240],
                        "note": "Hypothesis only. Fleetrac did not change this file.",
                    }
                )
                break
            line_no += 1
            if line_no > 400:
                break
        if len(hits) >= limit:
            break
    return hits
