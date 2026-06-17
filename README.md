# 🤖 GitHub Repo Q&A Bot

Ask natural language questions about any GitHub repository. Paste a URL, wait for indexing, then chat with the codebase.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)
![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5-orange)
![Groq](https://img.shields.io/badge/Groq-llama--3.1--8b-purple)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Index any GitHub repo by URL** — clones, chunks, and embeds the codebase automatically
- **Streaming answers** — responses stream token-by-token as they're generated
- **File tree panel** — browse all indexed files in a collapsible sidebar
- **Per-repo isolation** — each repo gets its own ChromaDB collection; switch between repos instantly
- **Groq LLM** — uses `llama-3.1-8b-instant` via Groq API, falls back to local Ollama if unavailable
- **Source citations** — every answer links to the exact files it drew from

---

## 🧠 Architecture

```
User ──► Next.js Frontend (port 3000)
              │  proxy /api/* routes
              ▼
         FastAPI Backend (port 8080)
         ┌───────────────────────────────────────┐
         │  POST /api/index      clone → chunk   │──► ChromaDB collection
         │  POST /api/query/stream  embed → RAG  │──► Groq (llama-3.1-8b)
         │  GET  /api/repos      list collections│        + Ollama fallback
         │  GET  /api/files/{c}  list repo files │
         └───────────────────────────────────────┘
              │
              ▼
         ChromaDB (HTTP, port 8000)   ←── docker-compose
```

**Indexing pipeline:**
```
git clone → walk files → 512-char chunks (64 overlap) → nomic-embed-text → ChromaDB
```

**Query pipeline:**
```
question → embed → top-5 chunks → llama-3.1-8b → streamed answer + sources
```

---

## 🛠 Installation

**Prerequisites**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 18+
- Python 3.11+
- [Groq API key](https://console.groq.com/) (free)
- [Ollama](https://ollama.com/) (optional — used as LLM fallback)

```bash
# 1. Clone the repo
git clone https://github.com/kri1105/github-qa-bot.git
cd github-qa-bot

# 2. Start ChromaDB
docker-compose up -d

# 3. Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env and add your Groq key
echo "GROQ_API_KEY=your_key_here" > .env

# 4. Start the backend
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# 5. Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🚀 Usage

1. Paste any public GitHub URL into the input box (e.g. `https://github.com/tiangolo/fastapi`)
2. Click **⚡ Index Repo** — the repo is cloned and indexed (takes 30s–2min depending on size)
3. Once done, the file tree loads on the left and the chat opens
4. Ask anything: *"How does authentication work?"*, *"What does the indexer do?"*, etc.

Previously indexed repos appear in **Recently Analyzed** and can be re-opened instantly.

---

## 📁 Project Structure

```
github-qa-bot/
├── docker-compose.yml           # ChromaDB service
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI — all endpoints
│       ├── db/
│       │   └── chroma_client.py # ChromaDB HTTP client + collection helpers
│       └── rag/
│           ├── indexer.py       # git clone → chunk → embed → upsert
│           ├── retriever.py     # embed question → cosine search
│           └── chain.py         # context builder → Groq → streaming
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx         # Root — repo state, layout switching
        │   ├── globals.css      # Dark theme CSS variables
        │   └── api/             # Next.js proxy routes → backend
        └── components/
            ├── Sidebar.tsx      # Repo list + nav
            ├── RepoHome.tsx     # Landing screen + URL indexer
            ├── FileTree.tsx     # Collapsible file browser
            └── ChatInterface.tsx # Streaming chat UI
```

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/healthz` | — | Liveness check |
| GET | `/api/repos` | — | List all indexed repo collections |
| GET | `/api/files/{collection}` | — | List files for a collection |
| GET | `/api/index/status` | — | Polling status of active index jobs |
| POST | `/api/index` | `X-Api-Key` | Start indexing a GitHub URL |
| POST | `/api/query` | — | Ask a question (blocking) |
| POST | `/api/query/stream` | — | Ask a question (SSE stream) |

`X-Api-Key` defaults to `dev-secret`. Set `INDEX_API_KEY` env var to change it.

---

## 🔮 Roadmap

- [x] Local RAG pipeline (index + retrieve + generate)
- [x] FastAPI backend with streaming
- [x] Index any GitHub repo by URL
- [x] Per-repo ChromaDB collection isolation
- [x] Next.js dark UI with file tree + chat
- [x] Groq LLM with Ollama fallback
- [ ] Deploy frontend to Vercel, backend to cloud
- [ ] GitHub Actions CI/CD

---

## 📄 License

MIT — free for personal and commercial use.

---

## 🙏 Acknowledgments

- [Groq](https://groq.com/) — for fast LLM inference
- [ChromaDB](https://www.trychroma.com/) — for the vector store
- [Ollama](https://ollama.com/) — for local model fallback
- [FastAPI](https://fastapi.tiangolo.com/) — for the backend framework
- [Next.js](https://nextjs.org/) — for the frontend

> ⚠️ **Disclaimer:** Always verify AI-generated answers against the actual source code before acting on them.

---

Built with ☕ and code.
