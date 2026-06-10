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
}

async function queryBackend(question: string, repo: string | null) {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, top_k: 5, repo }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export default function ChatBox({ activeRepo }: { activeRepo: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", loading: true },
    ]);
    setLoading(true);

    try {
      const { answer, sources } = await queryBackend(question, activeRepo);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: answer, sources },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `Error: ${msg}` },
      ]);
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
      `}</style>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", display: "flex", flexDirection: "column" }}>
        {!hasConversation ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, animation: "fadeIn 0.4s ease" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30, boxShadow: "0 8px 24px rgba(99,102,241,0.3)"
            }}>💬</div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 22, fontWeight: 700, color: "#111827" }}>Ask about your codebase</h2>
              <p style={{ margin: 0, fontSize: 15, color: "#6b7280", maxWidth: 380 }}>
                {activeRepo
                  ? <>Asking about <span style={{ fontWeight: 600, color: "#6366f1" }}>{activeRepo.replace(/_/g, "/")}</span></>
                  : "Load a repo above, or ask about the default indexed codebase."}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 480 }}>
              {["How does ChromaDB connect?", "What does the indexer do?", "Explain the RAG pipeline"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  style={{
                    padding: "8px 16px", borderRadius: 20, border: "1.5px solid #e0e7ff",
                    background: "white", color: "#6366f1", fontSize: 13, fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = "#f0f1ff"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = "white"; }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", animation: "fadeIn 0.25s ease" }}>
                {msg.role === "assistant" && (
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 13, fontWeight: 700, marginRight: 10, flexShrink: 0
                  }}>AI</div>
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
                          animation: "bounce 1.2s infinite", animationDelay: `${delay}ms`
                        }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                      {msg.sources && <SourceCitation sources={msg.sources} />}
                    </>
                  )}
                </div>
                {msg.role === "user" && (
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", background: "#e0e7ff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#6366f1", fontSize: 13, fontWeight: 700, marginLeft: 10, flexShrink: 0
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
            placeholder="Ask about the codebase..."
            disabled={loading}
            style={{
              flex: 1, borderRadius: 28, border: "1.5px solid #e5e7eb",
              padding: "13px 20px", fontSize: 15, outline: "none",
              background: loading ? "#f9fafb" : "white", color: "#111827",
            }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")}
            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
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
