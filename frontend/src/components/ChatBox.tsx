"use client";

import { useState, useRef, useEffect } from "react";
import SourceCitation from "./SourceCitation";

interface Source {
  file_path: string;
  start_line: number;
  end_line: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  loading?: boolean;
  indexing?: boolean; // special state: auto-indexing in progress
}

// ── GitHub URL detection ────────────────────────────────────────────────────

const GITHUB_URL_RE = /https?:\/\/github\.com\/[\w.\-]+\/[\w.\-]+/i;

function extractGithubUrl(text: string): string | null {
  const match = text.match(GITHUB_URL_RE);
  return match ? match[0].replace(/\/$/, "").replace(/\.git$/, "") : null;
}

function stripGithubUrl(text: string): string {
  return text.replace(GITHUB_URL_RE, "").replace(/\s{2,}/g, " ").trim();
}

// ── API helpers ─────────────────────────────────────────────────────────────

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

async function pollUntilDone(
  collection: string,
  onTick?: () => void,
): Promise<void> {
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    onTick?.();
    try {
      const res  = await fetch("/api/index/status");
      const data = await res.json();
      const jobs: Record<string, { status: string; collection: string; error?: string }> =
        data.jobs ?? {};
      const job = Object.values(jobs).find((j) => j.collection === collection);
      if (!job) continue;
      if (job.status === "done")  return;
      if (job.status === "error") throw new Error(job.error ?? "Indexing failed");
    } catch (e) {
      if (e instanceof Error && e.message !== "Indexing failed") continue; // network hiccup
      throw e;
    }
  }
}

async function queryBackendStream(
  question: string,
  repo: string | null,
  onToken: (token: string) => void,
  onSources: (sources: Source[]) => void,
): Promise<void> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, top_k: 5, repo }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail ?? `Request failed: ${res.status}`);
  }

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "token")   onToken(evt.token);
        if (evt.type === "sources") onSources(evt.sources);
      } catch { /* ignore partial */ }
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ChatBox({ activeRepo }: { activeRepo: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Append or replace the last message
  const setLast = (updater: (prev: Message) => Message) =>
    setMessages((msgs) => [...msgs.slice(0, -1), updater(msgs[msgs.length - 1])]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setLoading(true);

    // Show user message immediately
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const githubUrl = extractGithubUrl(question);
      let   repoCol   = activeRepo;          // collection name to query against
      let   cleanQ    = question;             // question sent to the LLM

      if (githubUrl) {
        cleanQ = stripGithubUrl(question) || `Explain this repository: ${githubUrl}`;

        // Check if already indexed
        const existing = await fetchRepos();

        // Derive expected collection name (mirrors backend logic)
        const slug = githubUrl
          .replace(/https?:\/\/github\.com\//i, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .toLowerCase()
          .slice(0, 63);
        const expectedCol = slug.length >= 3 ? slug : slug + "_repo";

        if (!existing.includes(expectedCol)) {
          // Need to index — show progress in chat
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Indexing **${githubUrl}** — this may take a minute…`, indexing: true },
          ]);

          const { collection } = await startIndexing(githubUrl);
          repoCol = collection;

          let dots = 0;
          await pollUntilDone(collection, () => {
            dots = (dots + 1) % 4;
            setLast((m) => ({
              ...m,
              content: `Indexing **${githubUrl}** ${"·".repeat(dots + 1)}`,
            }));
          });

          // Replace indexing message with "done" note, then add streaming reply below
          setLast((m) => ({ ...m, content: `✓ Indexed **${githubUrl}**. Answering now…`, indexing: false }));
        } else {
          repoCol = expectedCol;
        }
      }

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "", loading: true }]);

      let sources: Source[] = [];

      await queryBackendStream(
        cleanQ,
        repoCol,
        (token) => {
          setLast((m) => ({ ...m, content: m.content + token, loading: false }));
        },
        (s) => { sources = s; },
      );

      setLast((m) => ({ ...m, sources, loading: false }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const hasConversation = messages.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", display: "flex", flexDirection: "column" }}>
        {!hasConversation ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, animation: "fadeIn 0.4s ease" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30, boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
            }}>💬</div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 22, fontWeight: 700, color: "#111827" }}>Ask about any GitHub repo</h2>
              <p style={{ margin: 0, fontSize: 15, color: "#6b7280", maxWidth: 420 }}>
                Paste a GitHub URL in your message and I'll index it automatically, then answer your question.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
              {[
                "What does https://github.com/tiangolo/fastapi do?",
                "Explain the architecture of https://github.com/vercel/next.js",
                activeRepo ? `How does the indexer work?` : "How does ChromaDB connect?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  style={{
                    padding: "8px 16px", borderRadius: 20, border: "1.5px solid #e0e7ff",
                    background: "white", color: "#6366f1", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = "#f0f1ff"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = "white"; }}
                >
                  {q.length > 60 ? q.slice(0, 60) + "…" : q}
                </button>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#d1d5db" }}>
              Or select a repo above to ask without a URL
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  alignItems: "flex-start",
                  animation: "fadeIn 0.25s ease",
                }}
              >
                {msg.role === "assistant" && (
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: msg.indexing
                      ? "linear-gradient(135deg,#f59e0b,#f97316)"
                      : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 13, fontWeight: 700,
                    marginRight: 10, flexShrink: 0,
                  }}>
                    {msg.indexing ? "⏳" : "AI"}
                  </div>
                )}
                <div style={{
                  maxWidth: "72%",
                  background: msg.role === "user" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "white",
                  color: msg.role === "user" ? "white" : "#1f2937",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "12px 16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  border: msg.role === "assistant" ? "1px solid #f3f4f6" : "none",
                  fontSize: 15, lineHeight: 1.65,
                }}>
                  {msg.loading ? (
                    <div style={{ display: "flex", gap: 5, padding: "2px 0", alignItems: "center" }}>
                      {[0, 160, 320].map((delay) => (
                        <div key={delay} style={{
                          width: 7, height: 7, borderRadius: "50%", background: "#9ca3af",
                          animation: "bounce 1.2s infinite", animationDelay: `${delay}ms`,
                        }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {/* Render **bold** markdown for indexing messages */}
                        {msg.indexing || msg.content.startsWith("✓")
                          ? msg.content.replace(/\*\*(.*?)\*\*/g, "$1")
                          : msg.content}
                        {loading && i === messages.length - 1 && msg.role === "assistant" && !msg.indexing && (
                          <span style={{
                            display: "inline-block", width: 2, height: "1em",
                            background: "#6366f1", marginLeft: 2, verticalAlign: "text-bottom",
                            animation: "blink 1s step-end infinite",
                          }} />
                        )}
                      </p>
                      {msg.sources && <SourceCitation sources={msg.sources} />}
                    </>
                  )}
                </div>
                {msg.role === "user" && (
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", background: "#e0e7ff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#6366f1", fontSize: 13, fontWeight: 700, marginLeft: 10, flexShrink: 0,
                  }}>U</div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{ borderTop: "1px solid #f3f4f6", background: "white", padding: "14px 20px" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything — or paste a GitHub URL to auto-index and query"
            disabled={loading}
            style={{
              flex: 1, borderRadius: 28, border: "1.5px solid #e5e7eb",
              padding: "13px 20px", fontSize: 15, outline: "none",
              background: loading ? "#f9fafb" : "white", color: "#111827",
            }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")}
            onBlur={e  => (e.target.style.borderColor = "#e5e7eb")}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              borderRadius: 28, padding: "13px 26px",
              background: loading || !input.trim() ? "#c7d2fe" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: "white", border: "none", fontSize: 15, fontWeight: 600,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Thinking…" : "Ask →"}
          </button>
        </form>
      </div>
    </div>
  );
}
