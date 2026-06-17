"use client";

import { useState, useRef, useEffect } from "react";
import type { Message, Source } from "@/types";

// ── Code block renderer ───────────────────────────────────────────────────────

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const lines = code.split("\n");
  return (
    <div style={{ borderRadius: 8, overflow: "hidden", margin: "10px 0", border: "1px solid #2a2a3e" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--bg-code-bar)", borderBottom: "1px solid #2a2a3e" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{language || "code"}</span>
        <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#10b981" : "#9ca3af", fontSize: 11, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
          {copied ? "✓ Copied" : "⧉ Copy"}
        </button>
      </div>
      <div style={{ background: "var(--bg-code)", padding: "14px 0", overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, fontFamily: "monospace", lineHeight: 1.6 }}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td style={{ padding: "0 16px", userSelect: "none", color: "#4b5563", textAlign: "right", minWidth: 40, verticalAlign: "top" }}>{i + 1}</td>
                <td style={{ padding: "0 16px 0 8px", color: "#e2e8f0", whiteSpace: "pre" }}>{line || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const codeRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, key = 0, match: RegExpExecArray | null;
  while ((match = codeRe.exec(text)) !== null) {
    if (match.index > last) parts.push(<p key={key++} style={{ margin: "0 0 6px 0", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{text.slice(last, match.index)}</p>);
    parts.push(<CodeBlock key={key++} language={match[1]} code={match[2].trim()} />);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<p key={key++} style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{text.slice(last)}</p>);
  return <>{parts.length ? parts : <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{text}</p>}</>;
}

function langTag(sources: Source[]) {
  const exts = new Set(sources.map(s => s.file_path.split(".").pop()?.toLowerCase() ?? ""));
  const map: Record<string, { label: string; color: string }> = {
    py: { label: "PYTHON", color: "#3b82f6" }, ts: { label: "TYPESCRIPT", color: "#818cf8" },
    tsx: { label: "TYPESCRIPT", color: "#818cf8" }, js: { label: "JAVASCRIPT", color: "#f59e0b" },
    jsx: { label: "JAVASCRIPT", color: "#f59e0b" }, go: { label: "GO", color: "#10b981" },
    rs: { label: "RUST", color: "#f97316" }, md: { label: "MARKDOWN", color: "#9ca3af" },
    ipynb: { label: "NOTEBOOK", color: "#8b5cf6" },
  };
  for (const ext of exts) { if (map[ext]) return map[ext]; }
  return null;
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

const GITHUB_URL_RE = /https?:\/\/github\.com\/[\w.\-]+\/[\w.\-]+/i;
const extractGithubUrl = (t: string) => { const m = t.match(GITHUB_URL_RE); return m ? m[0].replace(/\/$/, "").replace(/\.git$/, "") : null; };
const stripGithubUrl   = (t: string) => t.replace(GITHUB_URL_RE, "").replace(/\s{2,}/g, " ").trim();

async function startIndexing(url: string) {
  const res  = await fetch("/api/index", { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": "dev-secret" }, body: JSON.stringify({ repo_url: url }) });
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

async function streamQuery(question: string, repo: string | null, onToken: (t: string) => void, onSources: (s: Source[]) => void) {
  const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, top_k: 8, repo }) });
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: `HTTP ${res.status}` })); throw new Error(e.detail ?? `Request failed: ${res.status}`); }
  const reader = res.body!.getReader();
  const dec    = new TextDecoder();
  let buf      = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "token")   onToken(evt.token);
        if (evt.type === "sources") onSources(evt.sources);
      } catch { /* ignore */ }
    }
  }
}

const SUGGESTIONS = ["How does the indexer chunk files?", "Explain the architecture", "Find security vulnerabilities", "What dependencies does this project use?"];

// ── Main component ────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  activeRepo: string | null;
  activeFile: string | null;
  onRepoChange?: (col: string) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export default function ChatInterface({ activeRepo, activeFile, onRepoChange, messages, setMessages }: ChatInterfaceProps) {
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const navRef                = useRef<HTMLDivElement>(null);

  // Close nav popup when clicking outside
  useEffect(() => {
    if (!navOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [navOpen]);

  function scrollToMessage(index: number) {
    document.getElementById(`msg-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setNavOpen(false);
  }

  const userMessages = messages
    .map((m, i) => ({ index: i, content: m.content }))
    .filter(m => messages[m.index].role === "user");

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const setLast = (fn: (m: Message) => Message) =>
    setMessages(prev => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setInput("");
    setLoading(true);
    setMessages(prev => [...prev, { role: "user", content: question }]);

    try {
      const githubUrl = extractGithubUrl(question);
      let repoCol = activeRepo;
      let cleanQ  = question;

      if (githubUrl) {
        cleanQ = stripGithubUrl(question) || `Explain this repository: ${githubUrl}`;
        const existing = await fetch("/api/repos").then(r => r.json()).then(d => d.repos ?? []);
        const slug = githubUrl.replace(/https?:\/\/github\.com\//i, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase().slice(0, 63);
        const expectedCol = slug.length >= 3 ? slug : slug + "_repo";

        if (!existing.includes(expectedCol)) {
          setMessages(prev => [...prev, { role: "assistant", content: `Indexing **${githubUrl}**… this may take a minute`, loading: false }]);
          const { collection } = await startIndexing(githubUrl);
          repoCol = collection;
          onRepoChange?.(collection);
          await pollUntilDone(collection);
          setLast(m => ({ ...m, content: `✓ Indexed **${githubUrl}**` }));
        } else {
          repoCol = expectedCol;
          onRepoChange?.(expectedCol);
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: "", loading: true }]);
      let sources: Source[] = [];

      await streamQuery(cleanQ, repoCol,
        token => setLast(m => ({ ...m, content: m.content + token, loading: false })),
        srcs  => { sources = srcs; },
      );

      setLast(m => ({ ...m, sources, loading: false }));
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message ?? "Something went wrong"}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const breadcrumb = activeFile
    ? activeFile.split("/").map((p, i, arr) => (
        <span key={i} style={{ color: i === arr.length - 1 ? "var(--text-primary)" : "var(--text-muted)" }}>
          {i > 0 && <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>/</span>}{p}
        </span>
      ))
    : activeRepo ? <span style={{ color: "var(--text-secondary)" }}>{activeRepo.replace(/_/g, "/")}</span> : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {breadcrumb && (
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", fontSize: 12, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 2, background: "var(--bg-sidebar)", flexShrink: 0 }}>
          {breadcrumb}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column" }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, animation: "fadeUp 0.4s ease" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--accent-dim)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>💬</div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                {activeRepo ? `Ask about ${activeRepo.split("_").slice(-1)[0]}` : "Ask about any codebase"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 380 }}>
                {activeRepo ? "Ask about code, architecture, bugs, or anything in this repo." : "Paste a GitHub URL in your message to auto-index and query any repo."}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
              {SUGGESTIONS.map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{ padding: "8px 14px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "#818cf8"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                >{q}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} id={`msg-${i}`} style={{ display: "flex", gap: 12, justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.2s ease" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "var(--accent-dim)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#818cf8" }}>AI</div>
                )}
                <div style={{ maxWidth: "76%", background: msg.role === "user" ? "var(--accent)" : "var(--bg-card)", color: "var(--text-primary)", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "12px 16px", border: msg.role === "assistant" ? "1px solid var(--border)" : "none", fontSize: 14 }}>
                  {msg.loading ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
                      {[0, 150, 300].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", animation: "bounce 1.2s infinite", animationDelay: `${d}ms` }} />)}
                    </div>
                  ) : (
                    <>
                      <MessageContent text={msg.content} />
                      {loading && i === messages.length - 1 && msg.role === "assistant" && (
                        <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--accent)", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {(() => { const lt = langTag(msg.sources!); return lt ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${lt.color}22`, color: lt.color, letterSpacing: "0.06em" }}>{lt.label}</span> : null; })()}
                            <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em" }}>SOURCES:</span>
                            {msg.sources.filter((s, i2, arr) => arr.findIndex(x => x.file_path === s.file_path) === i2).map((s, si) => (
                              <span key={si} title={`Lines ${s.start_line}–${s.end_line}`} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--accent-dim)", color: "#818cf8", fontFamily: "monospace", border: "1px solid rgba(99,102,241,0.2)", cursor: "default" }}>
                                {s.file_path}:{s.start_line}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {msg.role === "user" && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "#1e1e3f", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#818cf8" }}>U</div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-sidebar)", padding: "12px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "4px 4px 4px 16px", transition: "border-color 0.15s" }}
          onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
          onBlurCapture={e  => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
        >
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder={activeRepo ? "Ask about your code, debug issues, or request refactors…" : "Ask anything — or paste a GitHub URL to auto-index and query"}
            disabled={loading}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 14, padding: "8px 0" }}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{ padding: "8px 18px", borderRadius: 8, background: loading || !input.trim() ? "rgba(99,102,241,0.3)" : "var(--accent)", border: "none", color: "white", fontWeight: 600, fontSize: 14, cursor: loading || !input.trim() ? "not-allowed" : "pointer" }}>
            {loading ? "…" : "▶"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, position: "relative" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>

            {/* Chat navigator button — only shown when there are messages */}
            {userMessages.length > 0 && (
              <div ref={navRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setNavOpen(o => !o)}
                  title="Jump to message"
                  style={{
                    background: navOpen ? "var(--accent-dim)" : "none",
                    border: navOpen ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
                    borderRadius: 6, cursor: "pointer",
                    color: navOpen ? "#818cf8" : "var(--text-muted)",
                    fontSize: 12, padding: "3px 8px",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {/* Hamburger lines */}
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <rect y="0"  width="13" height="1.5" rx="1" fill="currentColor" />
                    <rect y="4"  width="9"  height="1.5" rx="1" fill="currentColor" />
                    <rect y="8"  width="11" height="1.5" rx="1" fill="currentColor" />
                  </svg>
                  <span>{userMessages.length}</span>
                </button>

                {/* Popup */}
                {navOpen && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                    width: 280, maxHeight: 320, overflowY: "auto",
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    zIndex: 50, padding: "6px",
                  }}>
                    <p style={{ margin: "4px 8px 6px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Jump to
                    </p>
                    {userMessages.map((m, n) => (
                      <button
                        key={m.index}
                        onClick={() => scrollToMessage(m.index)}
                        style={{
                          width: "100%", textAlign: "left", background: "none",
                          border: "none", borderRadius: 7, cursor: "pointer",
                          padding: "7px 10px", display: "flex", alignItems: "center", gap: 9,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                      >
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: "#818cf8",
                          background: "var(--accent-dim)", border: "1px solid rgba(99,102,241,0.3)",
                          borderRadius: 4, padding: "1px 6px", flexShrink: 0,
                        }}>Q{n + 1}</span>
                        <span style={{
                          fontSize: 12, color: "var(--text-secondary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{m.content.slice(0, 60)}{m.content.length > 60 ? "…" : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>⚡ llama3.2:3b</span>
        </div>
      </div>
    </div>
  );
}
