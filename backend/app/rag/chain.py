"""
Chain: retrieved chunks → prompt → LLM → answer + sources.

Two modes:
  - Code mode:    relevant chunks found → answer from codebase context
  - General mode: no relevant chunks   → answer from LLM general knowledge

LLM backend:
  - If GROQ_API_KEY is set → uses Groq API (production)
  - Otherwise              → uses local Ollama (development)
"""
import os
import json
from app.rag.retriever import retrieve

LLM_MODEL  = os.getenv("LLM_MODEL", "llama3.1:8b")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")  # Groq's hosted version
_GROQ_KEY  = os.getenv("GROQ_API_KEY", "")

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


def _build_messages(question: str, chunks: list[dict]) -> tuple[str, list[dict]]:
    """Return (system_prompt, messages) for either LLM backend."""
    if chunks:
        context      = _build_context(chunks)
        user_message = f"Here are the relevant code snippets from the repository:\n\n{context}\n\nQuestion: {question}"
        system       = CODE_SYSTEM_PROMPT
    else:
        user_message = question
        system       = GENERAL_SYSTEM_PROMPT
    return system, [
        {"role": "system", "content": system},
        {"role": "user",   "content": user_message},
    ]


# ── Groq ─────────────────────────────────────────────────────────────────────

def _groq_stream(messages: list[dict]):
    """Yield tokens from Groq streaming API."""
    from groq import Groq
    client = Groq(api_key=_GROQ_KEY)
    stream = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,  # type: ignore[arg-type]
        stream=True,
        temperature=0.2,
        max_tokens=2048,
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        if token:
            yield token


def _groq_ask(messages: list[dict]) -> str:
    """Blocking call to Groq."""
    from groq import Groq
    client   = Groq(api_key=_GROQ_KEY)
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,  # type: ignore[arg-type]
        temperature=0.2,
        max_tokens=2048,
    )
    return response.choices[0].message.content or ""


# ── Ollama ───────────────────────────────────────────────────────────────────

def _ollama_stream(messages: list[dict]):
    """Yield tokens from local Ollama."""
    import ollama
    stream = ollama.chat(model=LLM_MODEL, messages=messages, stream=True)
    for chunk in stream:
        token = chunk["message"]["content"]
        if token:
            yield token


def _ollama_ask(messages: list[dict]) -> str:
    import ollama
    response = ollama.chat(model=LLM_MODEL, messages=messages)
    return response["message"]["content"].strip()


# ── Public API ────────────────────────────────────────────────────────────────

def ask(question: str, top_k: int = 8, collection_name: str = None) -> dict:
    """Blocking RAG pipeline."""
    chunks = retrieve(question, top_k=top_k, collection_name=collection_name)
    _, messages = _build_messages(question, chunks)

    answer = _groq_ask(messages) if _GROQ_KEY else _ollama_ask(messages)

    sources = [
        {"file_path": c["file_path"], "start_line": c["start_line"], "end_line": c["end_line"]}
        for c in chunks
    ]
    return {"answer": answer, "sources": sources}


def ask_stream(question: str, top_k: int = 8, collection_name: str = None):
    """
    Streaming RAG pipeline. Yields SSE strings.
    Auto-selects Groq (if GROQ_API_KEY set) or local Ollama.
    """
    chunks = retrieve(question, top_k=top_k, collection_name=collection_name)

    sources = [
        {"file_path": c["file_path"], "start_line": c["start_line"], "end_line": c["end_line"]}
        for c in chunks
    ]
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    _, messages = _build_messages(question, chunks)

    token_gen = _groq_stream(messages) if _GROQ_KEY else _ollama_stream(messages)
    for token in token_gen:
        yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
