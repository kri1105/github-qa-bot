"""
FastAPI application.

Endpoints:
    GET  /healthz            - liveness check
    GET  /api/repos          - list all indexed repos
    GET  /api/index/status   - status of ongoing/completed index jobs
    POST /api/query          - ask a question against a specific repo
    POST /api/index          - async index a local path or GitHub URL
"""
import os
import uuid
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.rag.chain import ask
from app.rag.indexer import index_repo, index_repo_from_url
from app.db.chroma_client import list_collections, collection_name_from_url, get_collection, get_client

app = FastAPI(title="GitHub Repo Q&A Bot", version="2.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

INDEX_API_KEY = os.getenv("INDEX_API_KEY", "dev-secret")

# In-memory job tracker  {job_id: {status, collection, chunks, error}}
_jobs: dict[str, dict] = {}


# ── Schemas ───────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    repo: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]

class IndexRequest(BaseModel):
    repo_path: Optional[str] = None
    repo_url:  Optional[str] = None


# ── Background task ───────────────────────────────────────────────────────────

def _run_index(job_id: str, repo_url: str | None, repo_path: str | None):
    try:
        if repo_url:
            total, col_name = index_repo_from_url(repo_url)
        else:
            col_name = collection_name_from_url(repo_path)
            total    = index_repo(repo_path, collection_name=col_name)
        _jobs[job_id] = {"status": "done", "collection": col_name, "chunks": total}
    except Exception as e:
        _jobs[job_id] = {"status": "error", "error": str(e)}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/api/repos")
def get_repos():
    try:
        names = list_collections()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"repos": names}


@app.get("/api/index/status")
def index_status():
    """Return all job statuses so the frontend can poll."""
    return {"jobs": _jobs}


@app.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty")
    try:
        # Check the collection exists and has data before querying
        if req.repo:
            existing = list_collections()
            if req.repo not in existing:
                raise HTTPException(status_code=404, detail=f"Repo '{req.repo}' not indexed yet.")
        result = ask(req.question, top_k=req.top_k, collection_name=req.repo)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result


@app.post("/api/index")
def trigger_index(
    req: IndexRequest,
    background_tasks: BackgroundTasks,
    x_api_key: str = Header(default=""),
):
    if x_api_key != INDEX_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if not req.repo_url and not req.repo_path:
        raise HTTPException(status_code=400, detail="Provide repo_url or repo_path")

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "indexing", "collection": None}

    # Derive collection name upfront so the frontend knows what to expect
    col_name = collection_name_from_url(req.repo_url or req.repo_path)
    _jobs[job_id]["collection"] = col_name

    background_tasks.add_task(_run_index, job_id, req.repo_url, req.repo_path)

    return {"status": "indexing", "job_id": job_id, "collection": col_name}
