"""
Retrieval eval tests — run in CI after re-indexing.

Metrics checked:
    Hit Rate  >= HIT_RATE_THRESHOLD  (correct file in top-k results)
    MRR       >= MRR_THRESHOLD       (mean reciprocal rank of correct file)

These tests require ChromaDB and Ollama to be running (via docker-compose or CI services).
"""
import json
import os
import pytest
from pathlib import Path

from app.rag.retriever import retrieve

GOLDEN_QA_PATH = Path(__file__).parent / "golden_qa.json"
HIT_RATE_THRESHOLD = float(os.getenv("HIT_RATE_THRESHOLD", "0.80"))
MRR_THRESHOLD = float(os.getenv("MRR_THRESHOLD", "0.60"))
TOP_K = 5


def load_golden_qa():
    with open(GOLDEN_QA_PATH) as f:
        return json.load(f)


def _hit_rank(chunks: list[dict], expected_file: str) -> int | None:
    """Return 1-based rank of first chunk from expected_file, or None if not found."""
    for i, chunk in enumerate(chunks, 1):
        if expected_file in chunk["file_path"]:
            return i
    return None


# ── Individual Q&A tests ──────────────────────────────────────────────────────

@pytest.mark.parametrize("qa", load_golden_qa())
def test_retrieval_hit(qa):
    """Each golden question should retrieve the expected file in top-k."""
    chunks = retrieve(qa["question"], top_k=TOP_K)
    rank = _hit_rank(chunks, qa["expected_file"])
    assert rank is not None, (
        f"Expected file '{qa['expected_file']}' not found in top-{TOP_K} results "
        f"for question: '{qa['question']}'"
    )


@pytest.mark.parametrize("qa", load_golden_qa())
def test_retrieval_keywords(qa):
    """Top chunk should contain at least one expected keyword."""
    chunks = retrieve(qa["question"], top_k=TOP_K)
    all_text = " ".join(c["text"] for c in chunks).lower()
    matched = [kw for kw in qa.get("keywords", []) if kw.lower() in all_text]
    assert matched, (
        f"None of the keywords {qa['keywords']} found in top-{TOP_K} chunks "
        f"for question: '{qa['question']}'"
    )


# ── Aggregate metric tests ────────────────────────────────────────────────────

def test_hit_rate_above_threshold():
    """Overall hit rate across all golden Q&A pairs must exceed threshold."""
    qa_pairs = load_golden_qa()
    hits = 0
    for qa in qa_pairs:
        chunks = retrieve(qa["question"], top_k=TOP_K)
        if _hit_rank(chunks, qa["expected_file"]) is not None:
            hits += 1
    hit_rate = hits / len(qa_pairs)
    print(f"\nHit rate: {hit_rate:.2%} ({hits}/{len(qa_pairs)})")
    assert hit_rate >= HIT_RATE_THRESHOLD, (
        f"Hit rate {hit_rate:.2%} below threshold {HIT_RATE_THRESHOLD:.2%}"
    )


def test_mrr_above_threshold():
    """Mean Reciprocal Rank across all golden Q&A pairs must exceed threshold."""
    qa_pairs = load_golden_qa()
    reciprocal_ranks = []
    for qa in qa_pairs:
        chunks = retrieve(qa["question"], top_k=TOP_K)
        rank = _hit_rank(chunks, qa["expected_file"])
        reciprocal_ranks.append(1 / rank if rank else 0)
    mrr = sum(reciprocal_ranks) / len(reciprocal_ranks)
    print(f"\nMRR: {mrr:.4f}")
    assert mrr >= MRR_THRESHOLD, (
        f"MRR {mrr:.4f} below threshold {MRR_THRESHOLD:.4f}"
    )
