"""
Indexing pipeline: load repo files → chunk → embed → upsert into ChromaDB.

Usage (CLI):
    python -m app.rag.indexer --repo /path/to/repo

Usage (programmatic):
    from app.rag.indexer import index_repo
    index_repo("/path/to/repo")
"""
import argparse
import hashlib
import os
from pathlib import Path
from typing import Iterator

import ollama
from app.db.chroma_client import get_collection

# ── Config ────────────────────────────────────────────────────────────────────
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "512"))       # characters (approx tokens)
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "64"))

# File extensions to index
SUPPORTED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".md", ".txt", ".yaml", ".yml", ".json",
    ".go", ".rs", ".java", ".cpp", ".c", ".h",
}

# Directories to skip
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".mypy_cache",
}


# ── Chunking ──────────────────────────────────────────────────────────────────

def _split_text(text: str, size: int, overlap: int) -> list[dict]:
    """
    Naive character-level sliding window chunker.
    Returns list of {"text": ..., "start_char": ..., "end_char": ...}.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append({"text": text[start:end], "start_char": start, "end_char": end})
        if end == len(text):
            break
        start += size - overlap
    return chunks


def _char_to_line(text: str, char_offset: int) -> int:
    """Convert a character offset to a 1-based line number."""
    return text[:char_offset].count("\n") + 1


# ── File walking ──────────────────────────────────────────────────────────────

def _iter_files(repo_path: str) -> Iterator[Path]:
    for root, dirs, files in os.walk(repo_path):
        # Prune skip dirs in-place so os.walk doesn't descend into them
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            p = Path(root) / fname
            if p.suffix in SUPPORTED_EXTENSIONS:
                yield p


# ── Embedding ─────────────────────────────────────────────────────────────────

def _embed(texts: list[str]) -> list[list[float]]:
    """Batch-embed texts using Ollama."""
    response = ollama.embed(model=EMBED_MODEL, input=texts)
    return response["embeddings"]


# ── Main indexing function ────────────────────────────────────────────────────

def index_repo(repo_path: str, clear: bool = False) -> int:
    """
    Index all supported files in repo_path into ChromaDB.

    Args:
        repo_path: Absolute or relative path to the repository root.
        clear:     If True, wipe the existing collection before indexing.

    Returns:
        Total number of chunks indexed.
    """
    collection = get_collection()

    if clear:
        print("Clearing existing collection...")
        collection.delete(where={"repo_path": repo_path})

    repo_path = str(Path(repo_path).resolve())
    total = 0
    batch_ids, batch_docs, batch_metas, batch_embeds = [], [], [], []
    BATCH_SIZE = 50

    def flush():
        nonlocal batch_ids, batch_docs, batch_metas, batch_embeds
        if not batch_docs:
            return
        embeddings = _embed(batch_docs)
        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_metas,
            embeddings=embeddings,
        )
        batch_ids, batch_docs, batch_metas, batch_embeds = [], [], [], []

    for filepath in _iter_files(repo_path):
        try:
            text = filepath.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"  Skipping {filepath}: {e}")
            continue

        rel_path = str(filepath.relative_to(repo_path))
        chunks = _split_text(text, CHUNK_SIZE, CHUNK_OVERLAP)

        for i, chunk in enumerate(chunks):
            chunk_id = hashlib.md5(f"{rel_path}:{i}:{chunk['text'][:64]}".encode()).hexdigest()
            start_line = _char_to_line(text, chunk["start_char"])
            end_line = _char_to_line(text, chunk["end_char"])

            batch_ids.append(chunk_id)
            batch_docs.append(chunk["text"])
            batch_metas.append({
                "file_path": rel_path,
                "start_line": start_line,
                "end_line": end_line,
                "language": filepath.suffix.lstrip("."),
                "repo_path": repo_path,
            })
            total += 1

            if len(batch_docs) >= BATCH_SIZE:
                flush()
                print(f"  Indexed {total} chunks so far...")

    flush()
    print(f"Done. Total chunks indexed: {total}")
    return total


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Index a GitHub repo into ChromaDB")
    parser.add_argument("--repo", required=True, help="Path to the repository root")
    parser.add_argument("--clear", action="store_true", help="Clear existing index first")
    args = parser.parse_args()
    index_repo(args.repo, clear=args.clear)
