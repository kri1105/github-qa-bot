"""
Retrieval helpers: embed a query and fetch top-k chunks from ChromaDB.
"""
import os
import ollama
from app.db.chroma_client import get_collection

EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "5"))


def retrieve(query: str, top_k: int = TOP_K) -> list[dict]:
    """
    Embed `query` and return top_k most relevant chunks.

    Each result dict has:
        text       - the raw chunk text
        file_path  - relative path in the repo
        start_line - first line of the chunk
        end_line   - last line of the chunk
        distance   - cosine distance (lower = more similar)
    """
    response = ollama.embed(model=EMBED_MODEL, input=[query])
    query_embedding = response["embeddings"][0]

    collection = get_collection()
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text": doc,
            "file_path": meta.get("file_path", "unknown"),
            "start_line": meta.get("start_line", 0),
            "end_line": meta.get("end_line", 0),
            "distance": round(dist, 4),
        })

    return chunks
