"""
Chain: retrieved chunks → prompt → Ollama LLM → answer + sources.
"""
import os
import ollama
from app.rag.retriever import retrieve

LLM_MODEL = os.getenv("LLM_MODEL", "mistral:7b")

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
    """
    Full RAG pipeline: retrieve → build prompt → generate answer.
    collection_name scopes the query to a specific repo's collection.
    """
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
