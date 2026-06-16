"""
Retriever: embed a question → fetch top-k relevant chunks from ChromaDB.
"""
import os
from app.rag.embedder import embed as get_embeddings
from app.db.chroma_client import get_collection

TOP_K              = int(os.getenv("RETRIEVAL_TOP_K", "8"))
DISTANCE_THRESHOLD = float(os.getenv("DISTANCE_THRESHOLD", "0.85"))


def retrieve(query: str, top_k: int = TOP_K, collection_name: str = None) -> list[dict]:
    """
    Embed the query and return top-k most relevant chunks from the given collection.
    Chunks with cosine distance >= DISTANCE_THRESHOLD are filtered out as irrelevant.
    Returns an empty list if the collection has no relevant content for the query.
    """
    query_embedding = get_embeddings([query])[0]

    collection = get_collection(name=collection_name)

    # Request more than top_k so we have room to filter by distance
    n_results = min(top_k * 2, collection.count())
    if n_results == 0:
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        if dist >= DISTANCE_THRESHOLD:
            continue   # not relevant enough
        chunks.append({
            "text":       doc,
            "file_path":  meta.get("file_path", "unknown"),
            "start_line": meta.get("start_line", 0),
            "end_line":   meta.get("end_line", 0),
            "distance":   round(dist, 4),
        })

    # Return only the best top_k after filtering
    return chunks[:top_k]
