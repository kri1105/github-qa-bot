"""
Indexing pipeline: repo files → chunk → embed → store in ChromaDB.

Run from backend/ directory:
    python -m app.rag.indexer --repo /path/to/local/repo
    python -m app.rag.indexer --repo-url https://github.com/owner/repo
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Iterator

import ollama
from app.db.chroma_client import get_collection, collection_name_from_url, delete_collection

# ── Config ────────────────────────────────────────────────────────────────────
EMBED_MODEL    = os.getenv("EMBED_MODEL", "nomic-embed-text")
CHUNK_SIZE     = int(os.getenv("CHUNK_SIZE",     "1500"))   # larger = more context per chunk
CHUNK_OVERLAP  = int(os.getenv("CHUNK_OVERLAP",  "200"))
MAX_FILE_BYTES = int(os.getenv("MAX_FILE_BYTES", str(500 * 1024)))  # 500 KB

SUPPORTED_EXTENSIONS = {
    # Web / JS
    ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte",
    # Python
    ".py", ".pyx",
    # Notebooks
    ".ipynb",
    # Docs / Config
    ".md", ".txt", ".rst",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".env",
    # Systems
    ".go", ".rs", ".java", ".cpp", ".c", ".h", ".cs", ".rb", ".php",
    # Data / Query
    ".sql", ".graphql", ".proto",
    # Shell
    ".sh", ".bash", ".zsh",
}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".cache", "coverage",
    ".pytest_cache", ".mypy_cache", ".tox", "eggs",
    ".eggs", "htmlcov", "site-packages",
}

SKIP_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Gemfile.lock", "poetry.lock", "Cargo.lock",
    "composer.lock", "packages.lock.json", "bun.lockb",
    "shrinkwrap.json", "npm-shrinkwrap.json",
}

SKIP_SUFFIXES = {
    ".min.js", ".min.css", ".bundle.js", ".bundle.css", ".map", ".pyc",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _should_skip(path: Path) -> bool:
    if path.name in SKIP_FILENAMES:
        return True
    name_lower = path.name.lower()
    if any(name_lower.endswith(s) for s in SKIP_SUFFIXES):
        return True
    try:
        if path.stat().st_size > MAX_FILE_BYTES:
            return True
    except OSError:
        return True
    return False


def _read_file(filepath: Path) -> str:
    """Read file content. Extracts cell text from Jupyter notebooks."""
    if filepath.suffix == ".ipynb":
        try:
            data  = json.loads(filepath.read_text(encoding="utf-8", errors="ignore"))
            cells = data.get("cells", [])
            parts = []
            for cell in cells:
                src = "".join(cell.get("source", []))
                if src.strip():
                    ctype = cell.get("cell_type", "code")
                    parts.append(f"# [{ctype} cell]\n{src}")
            return "\n\n".join(parts)
        except Exception:
            return ""
    return filepath.read_text(encoding="utf-8", errors="ignore")


def _split_on_boundaries(text: str, size: int) -> list[tuple[int, int]] | None:
    """
    Try to split at natural code boundaries (blank line before def/class/function).
    Returns list of (start_char, end_char) pairs, or None if text fits in one chunk.
    """
    import re
    if len(text) <= size:
        return None

    # Boundaries: lines that start a new top-level definition or section
    boundary_re = re.compile(
        r"^(?:def |class |async def |function |const |export |module |impl |fn |pub fn |#+ )",
        re.MULTILINE,
    )

    boundaries = [0] + [m.start() for m in boundary_re.finditer(text)] + [len(text)]
    segments: list[tuple[int, int]] = []
    start = 0

    for i in range(1, len(boundaries)):
        seg_end = boundaries[i]
        seg_len = seg_end - start
        if seg_len >= size:
            # Segment too big — fall back to character splits within it
            pos = start
            while pos < seg_end:
                end = min(pos + size, seg_end)
                segments.append((pos, end))
                if end == seg_end:
                    break
                pos += size - CHUNK_OVERLAP
            start = seg_end
        elif i == len(boundaries) - 1 or (seg_end - start) + (boundaries[i + 1] - seg_end) > size:
            # Flush current accumulation
            segments.append((start, seg_end))
            start = seg_end

    if start < len(text):
        segments.append((start, len(text)))

    return segments if len(segments) > 1 else None


def _split_text(text: str, size: int, overlap: int) -> list[dict]:
    # Try semantic boundary splitting first
    boundary_splits = _split_on_boundaries(text, size)
    if boundary_splits:
        return [
            {"text": text[s:e], "start_char": s, "end_char": e}
            for s, e in boundary_splits
        ]

    # Fall back to sliding window character splits
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append({"text": text[start:end], "start_char": start, "end_char": end})
        if end == len(text):
            break
        start += size - overlap
    return chunks


def _char_to_line(text: str, char_offset: int) -> int:
    return text[:char_offset].count("\n") + 1


def _iter_files(repo_path: str) -> Iterator[Path]:
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            p = Path(root) / fname
            if p.suffix in SUPPORTED_EXTENSIONS and not _should_skip(p):
                yield p


def _clone_repo(url: str, dest: str) -> None:
    print(f"Cloning {url} ...")
    result = subprocess.run(
        ["git", "clone", "--depth=1", url, dest],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"git clone failed:\n{result.stderr}")
    print("Clone complete.")


def _inject_metadata_chunk(collection, url: str) -> None:
    """Store repo name/owner/URL as a searchable chunk."""
    clean = url.rstrip("/").removesuffix(".git")
    parts = [p for p in clean.replace("\\", "/").split("/") if p]
    repo_name = parts[-1] if parts else "unknown"
    owner     = parts[-2] if len(parts) >= 2 else "unknown"

    doc = (
        f"Repository Metadata\n"
        f"Name: {repo_name}\n"
        f"Owner: {owner}\n"
        f"Full name: {owner}/{repo_name}\n"
        f"GitHub URL: {clean}\n"
    )
    response  = ollama.embed(model=EMBED_MODEL, input=[doc])
    embedding = response["embeddings"][0]
    collection.upsert(
        ids=["__repo_metadata__"],
        documents=[doc],
        metadatas=[{"file_path": "REPO_METADATA", "start_line": 0, "end_line": 0, "language": ""}],
        embeddings=[embedding],
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def index_repo(repo_path: str, collection_name: str = None) -> int:
    """
    Index all supported files in repo_path into ChromaDB.
    Always deletes the existing collection first for a clean slate.
    """
    col_name   = collection_name or collection_name_from_url(repo_path)
    delete_collection(col_name)
    collection = get_collection(name=col_name)
    repo_path  = str(Path(repo_path).resolve())
    total      = 0

    batch_ids, batch_docs, batch_metas = [], [], []
    BATCH_SIZE = 32

    def flush():
        if not batch_docs:
            return
        response   = ollama.embed(model=EMBED_MODEL, input=batch_docs)
        embeddings = response["embeddings"]
        collection.upsert(
            ids=batch_ids, documents=batch_docs,
            metadatas=batch_metas, embeddings=embeddings,
        )
        batch_ids.clear(); batch_docs.clear(); batch_metas.clear()

    files = list(_iter_files(repo_path))
    print(f"Found {len(files)} files to index.")

    for filepath in files:
        text = _read_file(filepath)
        if not text.strip():
            continue

        rel_path = str(filepath.relative_to(repo_path))
        print(f"  Indexing {rel_path} ({len(text)} chars)")

        for i, chunk in enumerate(_split_text(text, CHUNK_SIZE, CHUNK_OVERLAP)):
            chunk_id   = hashlib.md5(f"{rel_path}:{i}:{chunk['text'][:64]}".encode()).hexdigest()
            start_line = _char_to_line(text, chunk["start_char"])
            end_line   = _char_to_line(text, chunk["end_char"])

            batch_ids.append(chunk_id)
            batch_docs.append(chunk["text"])
            batch_metas.append({
                "file_path":  rel_path,
                "start_line": start_line,
                "end_line":   end_line,
                "language":   filepath.suffix.lstrip("."),
            })
            total += 1

            if len(batch_docs) >= BATCH_SIZE:
                flush()
                print(f"    {total} chunks so far...")

    flush()
    print(f"Done. '{col_name}' — {total} chunks indexed.")
    return total


def index_repo_from_url(url: str) -> tuple[int, str]:
    col_name = collection_name_from_url(url)
    tmp_dir  = tempfile.mkdtemp(prefix="qa_bot_")
    try:
        _clone_repo(url, tmp_dir)
        total      = index_repo(tmp_dir, collection_name=col_name)
        collection = get_collection(name=col_name)
        _inject_metadata_chunk(collection, url)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    return total, col_name


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--repo",     help="Path to a local repo")
    group.add_argument("--repo-url", help="GitHub URL to clone and index")
    args = parser.parse_args()

    if args.repo_url:
        index_repo_from_url(args.repo_url)
    else:
        index_repo(args.repo)
