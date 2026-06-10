"use client";

import { useState, useEffect, useRef } from "react";

interface RepoLoaderProps {
  activeRepo: string | null;
  onRepoChange: (repo: string | null) => void;
}

async function fetchRepos(): Promise<string[]> {
  try {
    const res = await fetch("/api/repos");
    if (!res.ok) return [];
    const data = await res.json();
    return data.repos ?? [];
  } catch { return []; }
}

async function startIndexing(url: string): Promise<{ job_id: string; collection: string }> {
  const res = await fetch("/api/index", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": "dev-secret" },
    body: JSON.stringify({ repo_url: url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "Failed to start indexing");
  return data;
}

async function fetchJobStatus(): Promise<Record<string, { status: string; collection: string | null; error?: string }>> {
  try {
    const res = await fetch("/api/index/status");
    if (!res.ok) return {};
    const data = await res.json();
    return data.jobs ?? {};
  } catch { return {}; }
}

export default function RepoLoader({ activeRepo, onRepoChange }: RepoLoaderProps) {
  const [repos, setRepos]           = useState<string[]>([]);
  const [url, setUrl]               = useState("");
  const [expanded, setExpanded]     = useState(false);
  const [indexingRepo, setIndexing] = useState<string | null>(null); // collection being indexed
  const [error, setError]           = useState("");
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => { fetchRepos().then(setRepos); }, []);

  // Poll while indexing
  useEffect(() => {
    if (!indexingRepo) return;
    pollRef.current = setInterval(async () => {
      const jobs = await fetchJobStatus();
      const job  = Object.values(jobs).find((j) => j.collection === indexingRepo);

      if (job?.status === "done") {
        clearInterval(pollRef.current!);
        setIndexing(null);
        const updated = await fetchRepos();
        setRepos(updated);
        onRepoChange(indexingRepo);
      } else if (job?.status === "error") {
        clearInterval(pollRef.current!);
        setIndexing(null);
        setError(job.error ?? "Indexing failed");
      }
    }, 2000);

    return () => clearInterval(pollRef.current!);
  }, [indexingRepo]);

  async function handleLoad() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError("");
    try {
      const { collection } = await startIndexing(trimmed);
      setIndexing(collection);
      setUrl("");
      setExpanded(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start indexing");
    }
  }

  const displayName = (col: string) => col.replace(/_/g, " / ");

  return (
    <div style={{ background: "white", borderBottom: "1px solid #f3f4f6", padding: "10px 20px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Repo</span>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, alignItems: "center" }}>
          {repos.length === 0 && !indexingRepo && (
            <span style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>No repos indexed yet</span>
          )}
          {repos.map((r) => (
            <button key={r} onClick={() => onRepoChange(activeRepo === r ? null : r)} style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: activeRepo === r ? "1.5px solid #6366f1" : "1.5px solid #e5e7eb",
              background: activeRepo === r ? "#eef2ff" : "white",
              color: activeRepo === r ? "#6366f1" : "#374151",
              cursor: "pointer",
            }}>
              {activeRepo === r ? "✓ " : ""}{displayName(r)}
            </button>
          ))}

          {/* Indexing in progress indicator */}
          {indexingRepo && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20, fontSize: 12,
              border: "1.5px solid #f59e0b", background: "#fffbeb", color: "#92400e",
            }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s infinite" }} />
              Indexing {displayName(indexingRepo)}…
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
            </span>
          )}
        </div>

        <button onClick={() => setExpanded((v) => !v)} disabled={!!indexingRepo} style={{
          padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: expanded ? "#eef2ff" : indexingRepo ? "#e5e7eb" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
          color: expanded ? "#6366f1" : indexingRepo ? "#9ca3af" : "white",
          border: expanded ? "1.5px solid #6366f1" : "none",
          cursor: indexingRepo ? "not-allowed" : "pointer",
        }}>
          {expanded ? "✕ Cancel" : "+ Load Repo"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text" value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="https://github.com/owner/repo"
            style={{
              flex: 1, borderRadius: 22, border: "1.5px solid #e5e7eb",
              padding: "9px 16px", fontSize: 13, outline: "none", color: "#111827",
            }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")}
            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            autoFocus
          />
          <button onClick={handleLoad} disabled={!url.trim()} style={{
            borderRadius: 22, padding: "9px 20px", fontSize: 13, fontWeight: 600,
            background: !url.trim() ? "#c7d2fe" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "white", border: "none",
            cursor: !url.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}>
            Index →
          </button>
        </div>
      )}

      {error && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>⚠ {error}</p>}
    </div>
  );
}
