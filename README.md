---
title: GitHub QA Bot
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# 🤖 GitHub Repo Q&A Bot

A local RAG (Retrieval-Augmented Generation) system that lets you ask natural language questions about any codebase. Built with ChromaDB + Ollama for fully offline inference, served by a FastAPI backend, and wrapped in a clean Next.js chat UI with source citations.

![Next.js](https://img.shields.io/badge/Next.js-15.3-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)
![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5-orange)
![Ollama](https://img.shields.io/badge/Ollama-local-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Table of Contents
- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🌟 Overview

Reading through an unfamiliar codebase is slow. You spend more time `grep`-ing and scrolling than actually understanding. This project fixes that — index a repo once, then ask it anything in plain English.

The full pipeline:

1. **Index** — walk the repo, chunk files into 512-char overlapping segments, embed each chunk with `nomic-embed-text`, store in ChromaDB.
2. **Retrieve** — embed the user's question, pull the top-5 most similar chunks via cosine similarity.
3. **Generate** — feed those chunks as context to `mistral:7b`, which returns a grounded answer with file + line citations.

Everything runs locally — no OpenAI key, no cloud, no cost.

---

## ✨ Features

- **Fully offline** — `nomic-embed-text` for embeddings, `mistral:7b` for generation, both via Ollama.
- **Source citations** — every answer links back to the exact file and line range it came from.
- **Clean chat UI** — welcome screen with quick-prompt chips, animated loading dots, purple gradient bubbles.
- **FastAPI backend** — `/api/query`, `/api/index`, `/healthz` with Pydantic validation.
- **Docker-based infra** — ChromaDB and Ollama spin up with a single `docker-compose up`.
- **Re-index on demand** — hit `/api/index` with any repo path to refresh the vector store.

---

## 🧠 Architecture

```
┌──────────────┐    POST /api/query    ┌─────────────────────────────────┐
│  Next.js UI  │ ────────────────────► │        FastAPI Backend          │
│  (port 3000) │                       │  ┌───────────┐  ┌────────────┐  │
└──────────────┘                       │  │ Retriever │─►│   Chain    │  │
                                       │  └─────┬─────┘  └─────┬──────┘  │
                                       └────────┼───────────────┼────────┘
                                                ▼               ▼
                                       ┌──────────────┐  ┌────────────┐
                                       │   ChromaDB   │  │   Ollama   │
                                       │ vector store │  │ mistral:7b │
                                       │  (port 8000) │  │(port 11434)│
                                       └──────────────┘  └────────────┘
```

**Indexing** (run once):
```
files → chunk (512 chars, 64 overlap) → embed (nomic-embed-text) → upsert ChromaDB
```

**Query** (every message):
```
question → embed → top-5 chunks → mistral:7b → answer + sources
```

---

## 🛠 Installation

**Prerequisites**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com/)
- Node.js 18+
- Python 3.11+

```bash
# 1. Clone the repo
git clone https://github.com/your-username/github-qa-bot.git
cd github-qa-bot

# 2. Start ChromaDB + Ollama
docker-compose up -d

# 3. Pull models
ollama pull mistral:7b
ollama pull nomic-embed-text

# 4. Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. Frontend setup
cd ../frontend
npm install
```

---

## 🚀 Usage

**Step 1 — Index a repo**
```bash
# From backend/, with venv active
python -m app.rag.indexer --repo /path/to/any/repo

# Index this project itself
python -m app.rag.indexer --repo ..
```

**Step 2 — Start the backend**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

**Step 3 — Start the frontend**
```bash
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start asking questions.

---

## 📁 Project Structure

```
github-qa-bot/
├── docker-compose.yml           # ChromaDB + Ollama services
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI — /healthz, /api/query, /api/index
│       ├── db/
│       │   └── chroma_client.py # ChromaDB HTTP client + collection setup
│       └── rag/
│           ├── indexer.py       # File walker → chunker → embedder
│           ├── retriever.py     # Query embed + cosine similarity search
│           └── chain.py         # Context builder + Ollama LLM call
└── frontend/
    ├── next.config.js           # API proxy → backend
    └── src/
        ├── app/page.tsx         # Root layout + header
        └── components/
            ├── ChatBox.tsx      # Chat UI, state, API calls
            └── SourceCitation.tsx  # Source badge renderer
```

---

## 🔌 API Reference

### `GET /healthz`
```json
{ "status": "ok" }
```

### `POST /api/query`
```json
// Request
{ "question": "How does the indexer chunk files?", "top_k": 5 }

// Response
{
  "answer": "The indexer splits files into 512-character chunks with 64-char overlap...",
  "sources": [
    { "file_path": "backend/app/rag/indexer.py", "start_line": 42, "end_line": 67 }
  ]
}
```

### `POST /api/index`
Requires `X-Api-Key: dev-secret` header.
```json
{ "repo_path": "/absolute/path/to/repo" }
```

---

## 🔮 Roadmap

- [x] Local RAG pipeline (index + retrieve + generate)
- [x] FastAPI backend with query and index endpoints
- [x] Next.js chat UI with source citations
- [ ] Index any GitHub repo by URL (clone on demand)
- [ ] Per-repo collection isolation in ChromaDB
- [ ] GitHub Actions CI/CD pipeline
- [ ] Deploy frontend to Vercel, backend to Railway

---

## 📄 License

MIT — free for personal and commercial use.

---

## 🙏 Acknowledgments

- [Ollama](https://ollama.com/) — for making local LLMs effortless.
- [ChromaDB](https://www.trychroma.com/) — for the vector store.
- [FastAPI](https://fastapi.tiangolo.com/) — for the clean Python API framework.
- [Next.js](https://nextjs.org/) — for the frontend framework.

> ⚠️ **Disclaimer:** This tool is for developer productivity only. Always review AI-generated answers against the actual source code before acting on them.

---

Built with ☕ and code.