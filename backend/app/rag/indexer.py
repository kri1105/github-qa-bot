"""
Indexing pipeline: repo files → chunk → embed → store in ChromaDB.

Run from backend/ directory:
    python -m app.rag.indexer --repo /path/to/repo
"""
import argparse
import hashlib
import os
from pathlib import Path
from typing import Iterator

import ollama
from app.db.chroma_client import get_collection

# ── Config ────────────────────────────────────────────────────────────────────
EMBED_MODEL   = os.getenv("EMBED_MODEL", "nomic-embed-text")
CHUNK_SIZE    = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "64"))

SUPPORTED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".md", ".txt", ".yaml", ".yml", ".json",
    ".go", ".rs", ".java", ".cpp", ".c", ".h",
}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv",
    "venv", "dist", "build", ".next",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _split_text(text: str, size: int, overlap: int) -> list[dict]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append({
            "text": text[start:end],
            "start_char": start,
            "end_char": end
        })
        if end == len(text):
            break
        start += size - overlap
    return chunks


def _char_to_line(text: str, char_offset: int) -> int:
    """Convert character offset to line number."""
    return text[:char_offset].count("\n") + 1


def _iter_files(repo_path: str) -> Iterator[Path]:
    """Walk repo and yield supported files."""
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            p = Path(root) / fname
            if p.suffix in SUPPORTED_EXTENSIONS:
                yield p


# ── Main ──────────────────────────────────────────────────────────────────────

def index_repo(repo_path: str) -> int:
    """
    Index all supported files in repo_path into ChromaDB.
    Returns total chunks indexed.
    """
    collection = get_collection()
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
        batch_ids.clear()
        batch_docs.clear()
        batch_metas.clear()

    for filepath in _iter_files(repo_path):
        try:
            text = filepath.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"  Skipping {filepath}: {e}")
            continue

        rel_path = str(filepath.relative_to(repo_path))
        chunks   = _split_text(text, CHUNK_SIZE, CHUNK_OVERLAP)

        for i, chunk in enumerate(chunks):
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
    print(f"Done. Total chunks indexed: {total}")
    return total


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="Path to repo root")
    args = parser.parse_args()
    index_repo(args.repo)
