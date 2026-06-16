"""
Chain: retrieved chunks → prompt → Ollama LLM → answer + sources.
"""
import os
import json
import ollama
from app.rag.retriever import retrieve

# llama3.2:3b is ~3x faster than mistral:7b for RAG tasks.
# Override with LLM_MODEL env var if needed.
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2:3b")

SYSTEM_PROMPT = """\
You are a code assistant. Answer the question using ONLY the provided context.
If the answer is not in the context, say "I don't know based on the indexed code."
Always cite the exact file path for every claim you make.
Be concise and technical.
"""


def _build_context(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        header = f"[{i}] {chunk['file_path']} (lines {chunk['start_line']}-{chunk['end_line']})"
        parts.append(f"{header}\n```\n{chunk['text']}\n```")
    return "\n\n".join(parts)


def ask(question: str, top_k: int = 5, collection_name: str = None) -> dict:
    """Blocking RAG pipeline (kept for backward compat / tests)."""
    chunks  = retrieve(question, top_k=top_k, collection_name=collection_name)
    context = _build_context(chunks)

    user_message = f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"

    response = ollama.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
    )

    answer  = response["message"]["content"].strip()
    sources = [
        {"file_path": c["file_path"], "start_line": c["start_line"], "end_line": c["end_line"]}
        for c in chunks
    ]
    return {"answer": answer, "sources": sources}


def ask_stream(question: str, top_k: int = 5, collection_name: str = None):
    """
    Streaming RAG pipeline. Yields Server-Sent Event strings.

    Event types:
      {"type": "sources", "sources": [...]}   — sent first
      {"type": "token",   "token": "..."}     — one per LLM token
      {"type": "done"}                        — final sentinel
    """
    chunks  = retrieve(question, top_k=top_k, collection_name=collection_name)
    context = _build_context(chunks)

    sources = [
        {"file_path": c["file_path"], "start_line": c["start_line"], "end_line": c["end_line"]}
        for c in chunks
    ]

    # Send sources immediately so the frontend can display them
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    user_message = f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"

    stream = ollama.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        stream=True,
    )

    for chunk in stream:
        token = chunk["message"]["content"]
        if token:
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
