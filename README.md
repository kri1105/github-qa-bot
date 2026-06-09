# GitHub Repo Q&A Bot

A local RAG (Retrieval-Augmented Generation) powered chatbot that lets you ask natural language questions about any codebase. Built with ChromaDB, Ollama, FastAPI, and Next.js — runs entirely on your machine, no API keys required.

![Next.js](https://img.shields.io/badge/Next.js-15.3-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)
![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5-orange)
![Ollama](https://img.shields.io/badge/Ollama-local-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

Point it at a repo, ask questions, get answers with source citations.

```
"How does ChromaDB connect?"         → explains chroma_client.py with line references
"What does the indexer do?"          → walks through the chunking + embedding pipeline
"Where is the FastAPI query route?"  → finds and cites app/main.py
```

---

## Architecture

```
┌─────────────┐     POST /api/query     ┌──────────────────────────────────┐
│  Next.js UI │ ──────────────────────► │         FastAPI Backend          │
│  (port 3000)│                         │  ┌──────────┐   ┌─────────────┐ │
└─────────────┘                         │  │ Retriever│──►│    Chain    │ │
                                        │  └────┬─────┘   └──────┬──────┘ │
                                        │       │                 │        │
                                        └───────┼─────────────────┼────────┘
                                                ▼                 ▼
                                        ┌──────────────┐  ┌─────────────┐
                                        │   ChromaDB   │  │   Ollama    │
                                        │ vector store │  │  LLM + emb  │
                                        │  (port 8000) │  │ (port 11434)│
                                        └──────────────┘  └─────────────┘
```

**Indexing pipeline** — run once per repo:
`files → chunk (512 chars) → embed (nomic-embed-text) → upsert (ChromaDB)`

**Query pipeline** — runs on every question:
`question → embed → top-5 chunks → mistral:7b → answer + sources`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | FastAPI, Python 3.11+ |
| Vector DB | ChromaDB (HTTP, cosine similarity) |
| LLM | Ollama — `mistral:7b` (generation) |
| Embeddings | Ollama — `nomic-embed-text` |
| Infra | Docker + docker-compose |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com/) installed locally
- Node.js 18+
- Python 3.11+

---

## Getting Started

### 1. Clone and enter the project

```bash
git clone https://github.com/your-username/github-qa-bot.git
cd github-qa-bot
```

### 2. Start ChromaDB and Ollama

```bash
docker-compose up -d
```

### 3. Pull the required models

```bash
ollama pull mistral:7b
ollama pull nomic-embed-text
```

### 4. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Index a repo

```bash
# From the backend/ directory, with venv active
python -m app.rag.indexer --repo /path/to/any/repo

# Example: index this project itself
python -m app.rag.indexer --repo ..
```

### 6. Start the backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

### 7. Start the frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start asking questions.

---

## Project Structure

```
github-qa-bot/
├── docker-compose.yml          # ChromaDB + Ollama services
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI app — /healthz, /api/query, /api/index
│       ├── db/
│       │   └── chroma_client.py    # ChromaDB HTTP client + collection setup
│       └── rag/
│           ├── indexer.py      # File walker, chunker, embedder
│           ├── retriever.py    # Query embedding + similarity search
│           └── chain.py        # Context builder + Ollama LLM call
└── frontend/
    ├── next.config.js          # API proxy to backend
    └── src/
        ├── app/
        │   ├── page.tsx        # Root layout + header
        │   └── globals.css
        └── components/
            ├── ChatBox.tsx         # Chat UI, message state, API calls
            └── SourceCitation.tsx  # Source badge renderer
```

---

## API Reference

### `GET /healthz`
Returns `{ "status": "ok" }`. Use to confirm the backend is alive.

### `POST /api/query`
```json
{
  "question": "How does the indexer chunk files?",
  "top_k": 5
}
```
Response:
```json
{
  "answer": "The indexer splits files into 512-character chunks...",
  "sources": [
    { "file_path": "backend/app/rag/indexer.py", "start_line": 42, "end_line": 67, "distance": 0.12 }
  ]
}
```

### `POST /api/index`
Trigger re-indexing. Requires `X-Api-Key: dev-secret` header.
```json
{ "repo_path": "/absolute/path/to/repo" }
```

---

## Environment Variables

Create a `.env` file in `backend/` to override defaults:

```env
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION=repo_chunks
OLLAMA_HOST=http://localhost:11434
INDEX_API_KEY=dev-secret
```

---

## Supported File Types

The indexer processes: `.py` `.js` `.ts` `.tsx` `.jsx` `.java` `.go` `.rs` `.cpp` `.c` `.h` `.md` `.txt` `.yaml` `.yml` `.json` `.toml` `.env`

Skipped directories: `node_modules`, `.git`, `__pycache__`, `.next`, `venv`, `dist`, `build`

---

## Roadmap

- [x] Local RAG pipeline (index + retrieve + generate)
- [x] FastAPI backend with query and index endpoints
- [x] Next.js chat UI with source citations
- [ ] Index any GitHub repo by URL (clone on demand)
- [ ] Per-repo collection isolation in ChromaDB
- [ ] GitHub Actions CI/CD pipeline
- [ ] Deploy frontend to Vercel, backend to Railway

---

## License

MIT
