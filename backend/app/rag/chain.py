"""
Chain: retrieved chunks → prompt → Ollama LLM → answer + sources.

Two modes:
  - Code mode:    relevant chunks found → answer from codebase context
  - General mode: no relevant chunks   → answer from LLM general knowledge
"""
import os
import json
import ollama
from app.rag.retriever import retrieve

LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2:3b")

CODE_SYSTEM_PROMPT = """\
You are an expert code assistant helping a developer understand a GitHub repository.
Answer the question using the provided code context. Be concise and technical.
Always mention the file path when referencing specific code.
If the context doesn't contain enough information, say so clearly but still try to help based on what is available.
"""

GENERAL_SYSTEM_PROMPT = """\
You are a helpful AI assistant — knowledgeable, concise, and friendly.
Answer the user's question using your general knowledge.
If the question is about a specific codebase, let the user know you don't have indexed context for it
and suggest they load the repo using the "+ Load Repo" button.
"""


def _build_context(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        header = f"[{i}] {chunk['file_path']} (lines {chunk['start_line']}-{chunk['end_line']})"
        parts.append(f"{header}\n```\n{chunk['text']}\n```")
    return "\n\n".join(parts)


def ask(question: str, top_k: int = 5, collection_name: str = None) -> dict:
    """Blocking RAG pipeline."""
    chunks = retrieve(question, top_k=top_k, collection_name=collection_name)

    if chunks:
        context      = _build_context(chunks)
        user_message = f"Code context:\n{context}\n\nQuestion: {question}\nAnswer:"
        system       = CODE_SYSTEM_PROMPT
    else:
        user_message = question
        system       = GENERAL_SYSTEM_PROMPT

    response = ollama.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_message},
        ],
    )

    sources = [
        {"file_path": c["file_path"], "start_line": c["start_line"], "end_line": c["end_line"]}
        for c in chunks
    ]
    return {"answer": response["message"]["content"].strip(), "sources": sources}


def ask_stream(question: str, top_k: int = 5, collection_name: str = None):
    """
    Streaming RAG pipeline. Yields SSE strings.
    Falls back to general knowledge when no relevant code chunks are found.
    """
    chunks = retrieve(question, top_k=top_k, collection_name=collection_name)

    sources = [
        {"file_path": c["file_path"], "start_line": c["start_line"], "end_line": c["end_line"]}
        for c in chunks
    ]
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    if chunks:
        context      = _build_context(chunks)
        user_message = f"Code context:\n{context}\n\nQuestion: {question}\nAnswer:"
        system       = CODE_SYSTEM_PROMPT
    else:
        user_message = question
        system       = GENERAL_SYSTEM_PROMPT

    stream = ollama.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_message},
        ],
        stream=True,
    )

    for chunk in stream:
        token = chunk["message"]["content"]
        if token:
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
