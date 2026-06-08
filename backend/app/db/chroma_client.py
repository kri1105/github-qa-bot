"""
ChromaDB client wrapper.
Provides a singleton client and a helper to get/create the repo collection.
"""
import os
import chromadb
from chromadb.config import Settings

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION", "repo_chunks")


def get_client() -> chromadb.HttpClient:
    """Return a ChromaDB HTTP client (points to the running ChromaDB server)."""
    return chromadb.HttpClient(
        host=CHROMA_HOST,
        port=CHROMA_PORT,
        settings=Settings(anonymized_telemetry=False),
    )


def get_collection(client: chromadb.HttpClient = None):
    """Get (or create) the repo collection."""
    client = client or get_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
