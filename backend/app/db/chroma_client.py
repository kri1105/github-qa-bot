import os
import re
from urllib.parse import urlparse
import chromadb

_CHROMA_URL  = os.getenv("CHROMA_HOST", "http://localhost:8000")
DEFAULT_COLLECTION = os.getenv("CHROMA_COLLECTION", "repo_chunks")


def _parse_chroma_url(url: str) -> tuple[str, int, bool]:
    """Return (host, port, ssl) from a bare hostname or full URL."""
    if "://" not in url:
        url = f"http://{url}"
    parsed = urlparse(url)
    host   = parsed.hostname or "localhost"
    port   = parsed.port or (443 if parsed.scheme == "https" else 8000)
    ssl    = parsed.scheme == "https"
    return host, port, ssl


def get_client() -> chromadb.HttpClient:
    host, port, ssl = _parse_chroma_url(_CHROMA_URL)
    return chromadb.HttpClient(host=host, port=port, ssl=ssl)


def collection_name_from_url(url: str) -> str:
    """
    Derive a safe ChromaDB collection name from a GitHub URL or local path.
    e.g. https://github.com/torvalds/linux  →  torvalds_linux
         /home/user/my-project              →  my_project
    """
    # Strip trailing slashes and .git
    url = url.rstrip("/").removesuffix(".git")
    # Grab last two path segments (owner/repo) or just the last one
    parts = [p for p in url.replace("\\", "/").split("/") if p]
    slug = "_".join(parts[-2:]) if len(parts) >= 2 else parts[-1]
    # Replace any non-alphanumeric chars with underscores, lowercase
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", slug).lower()
    # ChromaDB collection names must be 3–63 chars
    slug = slug[:63] or "repo_chunks"
    return slug if len(slug) >= 3 else slug + "_repo"


def get_collection(client: chromadb.HttpClient = None, name: str = None):
    """Gets or creates a collection. Uses DEFAULT_COLLECTION when name is omitted."""
    client = client or get_client()
    return client.get_or_create_collection(
        name=name or DEFAULT_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def delete_collection(name: str, client: chromadb.HttpClient = None) -> bool:
    """Delete a collection by name. Returns True if deleted, False if it didn't exist."""
    client = client or get_client()
    try:
        client.delete_collection(name)
        return True
    except Exception:
        return False


def list_collections(client: chromadb.HttpClient = None) -> list[str]:
    """Returns names of all collections that exist in ChromaDB."""
    client = client or get_client()
    return [c.name for c in client.list_collections()]
