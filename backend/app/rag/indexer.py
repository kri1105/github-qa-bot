"""
Indexing pipeline: repo files → chunk → embed → store in ChromaDB.

Run from backend/ directory:
    python -m app.rag.indexer --repo /path/to/local/repo
    python -m app.rag.indexer --repo-url https://github.com/owner/repo
"""
import argparse
import hashlib
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Iterator

import ollama
from app.db.chroma_client import get_collection, collection_name_from_url

# ── Config ────────────────────────────────────────────────────────────────────
EMBED_MODEL   = os.getenv("EMBED_MODEL", "nomic-embed-text")
CHUNK_SIZE    = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "64"))

SUPPORTED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".md", ".txt", ".yaml", ".yml", ".json",
    ".go", ".rs", ".java", ".cpp", ".c", ".h", ".toml",
}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv",
    "venv", "dist", "build", ".next",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _split_text(text: str, size: int, overlap: int) -> list[dict]:
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
            if p.suffix in SUPPORTED_EXTENSIONS:
                yield p


def _clone_repo(url: str, dest: str) -> None:
    """Shallow-clone a GitHub repo into dest directory."""
    print(f"Cloning {url} ...")
    result = subprocess.run(
        ["git", "clone", "--depth=1", url, dest],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"git clone failed:\n{result.stderr}")
    print("Clone complete.")


# ── Main ──────────────────────────────────────────────────────────────────────

def index_repo(repo_path: str, collection_name: str = None) -> int:
    """
    Index all supported files in repo_path into ChromaDB.
    collection_name defaults to one derived from the path.
    Returns total chunks indexed.
    """
    col_name   = collection_name or collection_name_from_url(repo_path)
    collection = get_collection(name=col_name)
    repo_path  = str(Path(repo_path).resolve())
    total      = 0

    batch_ids, batch_docs, batch_metas = [], [], []
    BATCH_SIZE = 50

    def flush():
        if not batch_docs:
            return
        response   = ollama.embed(model=EMBED_MODEL, input=batch_docs)
        embeddings = response["embeddings"]
        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_metas,
            embeddings=embeddings,
        )
        batch_ids.clear(); batch_docs.clear(); batch_metas.clear()

    for filepath in _iter_files(repo_path):
        try:
            text = filepath.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"  Skipping {filepath}: {e}")
            continue

        rel_path = str(filepath.relative_to(repo_path))
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
                print(f"  Indexed {total} chunks...")

    flush()
    print(f"Done. Collection: '{col_name}' — {total} chunks indexed.")
    return total


def index_repo_from_url(url: str) -> tuple[int, str]:
    """
    Clone a GitHub repo by URL, index it, clean up the clone.
    Returns (total_chunks, collection_name).
    """
    col_name = collection_name_from_url(url)
    tmp_dir  = tempfile.mkdtemp(prefix="qa_bot_")
    try:
        _clone_repo(url, tmp_dir)
        total = index_repo(tmp_dir, collection_name=col_name)
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
