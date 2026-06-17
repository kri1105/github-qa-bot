"use client";

import { useState, useEffect, useRef } from "react";

interface RepoCard {
  name: string;
  description?: string;
  tag?: string;
  tagColor?: string;
}

async function fetchRepos(): Promise<string[]> {
  try {
    const res = await fetch("/api/repos");
    if (!res.ok) return [];
    return (await res.json()).repos ?? [];
  } catch { return []; }
}

async function startIndexing(url: string) {
  const res = await fetch("/api/index", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": "dev-secret" },
    body: JSON.stringify({ repo_url: url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "Failed to start indexing");
  return data;
}

async function pollUntilDone(collection: string): Promise<void> {
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res  = await fetch("/api/index/status");
      const data = await res.json();
      const job  = Object.values(data.jobs ?? {}).find((j: any) => j.collection === collection) as any;
      if (!job) continue;
      if (job.status === "done")  return;
      if (job.status === "error") throw new Error(job.error ?? "Indexing failed");
    } catch (e) { if ((e as Error).message === "Indexing failed") throw e; }
  }
}

function tagFromName(name: string): { tag: string; color: string } {
  const n = name.toLowerCase();
  if (n.includes("fastapi") || n.includes("django") || n.includes("flask") || n.includes("py"))
    return { tag: "Python", color: "#3b82f6" };
  if (n.includes("next") || n.includes("react") || n.includes("vue") || n.includes("svelte"))
    return { tag: "Next.js", color: "#10b981" };
  if (n.includes("ollama") || n.includes("llm") || n.includes("rag"))
    return { tag: "AI/ML", color: "#8b5cf6" };
  return { tag: "Code", color: "#f59e0b" };
}

interface RepoHomeProps {
  onRepoSelect: (col: string) => void;
}

export default function RepoHome({ onRepoSelect }: RepoHomeProps) {
  const [repos, setRepos]       = useState<string[]>([]);
  const [url, setUrl]           = useState("");
  const [indexing, setIndexing] = useState<string | null>(null);
  const [status, setStatus]     = useState("");
  const [error, setError]       = useState("");
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchRepos().then(setRepos); }, []);

  async function handleIndex() {
    const trimmed = url.trim();
    if (!trimmed || indexing) return;
    setError(""); setStatus("Starting…");
    try {
      const { collection } = await startIndexing(trimmed);
      setIndexing(collection);
      setStatus(`Cloning & indexing ${collection}…`);
      setUrl("");
      await pollUntilDone(collection);
      setStatus("");
      setIndexing(null);
      const updated = await fetchRepos();
      setRepos(updated);
      onRepoSelect(collection);
    } catch (e: any) {
      setError(e.message ?? "Failed");
      setIndexing(null);
      setStatus("");
    }
  }

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: "var(--bg-base)", overflowY: "auto",
    }}>
      {/* Hero */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 24px 40px", animation: "fadeUp 0.4s ease",
      }}>
        <h1 style={{
          fontSize: 36, fontWeight: 800, color: "var(--text-primary)",
          textAlign: "center", lineHeight: 1.25, marginBottom: 36,
          letterSpacing: "-0.5px",
        }}>
          know your repository<br />before you deploy
        </h1>

        {/* URL input */}
        <div style={{
          display: "flex", gap: 0, width: "100%", maxWidth: 640,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 10, overflow: "hidden",
        }}>
          <span style={{ padding: "0 14px", display: "flex", alignItems: "center", color: "var(--text-muted)", fontSize: 16 }}>
            🔗
          </span>
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleIndex()}
            placeholder="Enter GitHub URL"
            disabled={!!indexing}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 14, padding: "14px 0",
              fontFamily: "monospace",
            }}
          />
          <button onClick={handleIndex} disabled={!url.trim() || !!indexing} style={{
            padding: "0 20px", background: "var(--accent)", border: "none",
            color: "white", fontSize: 13, fontWeight: 600, cursor: !url.trim() || indexing ? "not-allowed" : "pointer",
            opacity: !url.trim() || indexing ? 0.6 : 1, whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {indexing ? (
              <>
                <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Indexing…
              </>
            ) : "⚡ Index Repo"}
          </button>
        </div>

        {status && <p style={{ marginTop: 12, fontSize: 13, color: "#818cf8", animation: "pulse 1.5s infinite" }}>{status}</p>}
        {error  && <p style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>⚠ {error}</p>}
      </div>

      {/* Recently Analyzed */}
      {repos.length > 0 && (
        <div style={{ padding: "0 32px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Recently Analyzed
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {repos.map(r => {
              const { tag, color } = tagFromName(r);
              const displayName = r.replace(/_/g, "/");
              return (
                <button key={r} onClick={() => onRepoSelect(r)} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "18px", textAlign: "left", cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.background  = "var(--bg-hover)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.background  = "var(--bg-card)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: `${color}22`, border: `1px solid ${color}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18,
                    }}>📁</div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
                      background: `${color}22`, color: color, border: `1px solid ${color}44`,
                    }}>{tag}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, fontFamily: "monospace" }}>
                    {displayName.split("/").pop()}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {displayName}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
