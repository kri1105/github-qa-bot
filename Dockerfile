FROM python:3.11-slim

# git is required for cloning repos at index time
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces requires a non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /home/appuser/app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ ./app/
COPY start.sh /home/appuser/start.sh
RUN chmod +x /home/appuser/start.sh

RUN mkdir -p /home/appuser/chroma && chown -R appuser:appuser /home/appuser

USER appuser

# ChromaDB runs internally on 8000; FastAPI serves on 7860
ENV CHROMA_HOST=http://localhost:8000
ENV ALLOWED_ORIGINS=*

EXPOSE 7860

CMD ["/home/appuser/start.sh"]
