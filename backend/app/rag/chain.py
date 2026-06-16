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

LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1:8b")

CODE_SYSTEM_PROMPT = """\
You are an expert software engineer helping a developer understand a GitHub repository.
You have been given relevant code snippets retrieved from the codebase.

Guidelines:
- Answer directly and technically. Avoid filler phrases like "Based on the context...".
- Always cite the exact file path (e.g. `src/utils/helper.py`) when referencing code.
- If the answer involves code, show a concise example using markdown code blocks with the correct language tag.
- Structure longer answers with clear sections: use bold headings like **How it works**, **Key files**, **Example**.
- If multiple files are involved, explain how they interact.
- If the context is incomplete, say what you can determine and what is unclear.
- Never make up function names, class names, or file paths that are not in the provided context.
"""

GENERAL_SYSTEM_PROMPT = """\
You are a helpful, expert software engineering assistant — knowledgeable, concise, and direct.
Answer the user's question using your general knowledge.

Guidelines:
- Be direct. Do not pad your answer with unnecessary preamble.
- Use markdown code blocks with language tags for any code examples.
- If the question is about a specific codebase that hasn't been indexed, briefly mention they can paste the GitHub URL in the chat to auto-index it.
- For architecture or design questions, use bullet points or numbered steps for clarity.
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
        user_message = f"Here are the relevant code snippets from the repository:\n\n{context}\n\nQuestion: {question}"
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
        user_message = f"Here are the relevant code snippets from the repository:\n\n{context}\n\nQuestion: {question}"
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
