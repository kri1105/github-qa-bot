"""
Retriever: embed a question → fetch top-k relevant chunks from ChromaDB.
"""
import os
import ollama
from app.db.chroma_client import get_collection

EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
TOP_K       = int(os.getenv("RETRIEVAL_TOP_K", "5"))


def retrieve(query: str, top_k: int = TOP_K, collection_name: str = None) -> list[dict]:
    """
    Embed the query and return top-k most relevant chunks from the given collection.
    collection_name=None uses the default collection (original behaviour).
    """
    response        = ollama.embed(model=EMBED_MODEL, input=[query])
    query_embedding = response["embeddings"][0]

    collection = get_collection(name=collection_name)
    results    = collection.query(
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
            "text":       doc,
            "file_path":  meta.get("file_path", "unknown"),
            "start_line": meta.get("start_line", 0),
            "end_line":   meta.get("end_line", 0),
            "distance":   round(dist, 4),
        })

    return chunks
