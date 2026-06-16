"""
Embedding abstraction.

- If OLLAMA_HOST is set (local dev)  → use Ollama (nomic-embed-text)
- Otherwise (production / Render)    → use sentence-transformers (all-MiniLM-L6-v2, runs in-process)

Both return a list of float vectors, one per input text.
"""
import os

OLLAMA_HOST  = os.getenv("OLLAMA_HOST", "")           # empty string = not available
EMBED_MODEL  = os.getenv("EMBED_MODEL", "nomic-embed-text")
ST_MODEL     = os.getenv("ST_MODEL", "all-MiniLM-L6-v2")  # 22 MB, 384-dim

_st_model = None  # lazy-loaded sentence-transformers model


def _load_st():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer(ST_MODEL)
    return _st_model


def embed(texts: list[str]) -> list[list[float]]:
    """Return embeddings for a list of texts."""
    if OLLAMA_HOST:
        import ollama
        response = ollama.embed(model=EMBED_MODEL, input=texts)
        return response["embeddings"]
    else:
        model = _load_st()
        vecs  = model.encode(texts, normalize_embeddings=True)
        return [v.tolist() for v in vecs]
