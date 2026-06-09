"""
FastAPI application.

Endpoints:
    GET  /healthz       - check if server is running
    POST /api/query     - ask a question, get answer + sources
    POST /api/index     - trigger re-indexing (protected by API key)
"""
import os
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.rag.chain import ask
from app.rag.indexer import index_repo

app = FastAPI(title="GitHub Repo Q&A Bot", version="1.0.0")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

INDEX_API_KEY = os.getenv("INDEX_API_KEY", "dev-secret")
REPO_PATH     = os.getenv("REPO_PATH", "..")


# ── Schemas ───────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    top_k: int = 5

class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]

class IndexRequest(BaseModel):
    repo_path: str = REPO_PATH


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty")
    try:
        result = ask(req.question, top_k=req.top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result


@app.post("/api/index")
def trigger_index(req: IndexRequest, x_api_key: str = Header(default="")):
    if x_api_key != INDEX_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    try:
        total = index_repo(req.repo_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok", "chunks_indexed": total}