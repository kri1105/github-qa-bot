#!/bin/bash
set -e

# Start ChromaDB HTTP server in the background
chroma run --host 0.0.0.0 --port 8000 --path /home/appuser/chroma &

# Wait for ChromaDB to be ready
sleep 4

# Start FastAPI on port 7860 (required by HF Spaces)
exec uvicorn app.main:app --host 0.0.0.0 --port 7860
