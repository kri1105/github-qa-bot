"use client";

import type { ChatSession, Message } from "@/types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function preview(messages: Message[]): string {
  const first = messages.find(m => m.role === "user");
  return first ? first.content.slice(0, 80) + (first.content.length > 80 ? "…" : "") : "Empty session";
}

interface HistoryViewProps {
  history: ChatSession[];
  onRestore: (session: ChatSession) => void;
  onDelete:  (id: string) => void;
  onClear:   () => void;
}

export default function HistoryView({ history, onRestore, onDelete, onClear }: HistoryViewProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-base)", overflowY: "auto" }}>
      <div style={{ padding: "28px 28px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>History</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Conversations are kept for 15 days then deleted automatically.
            </p>
          </div>
          {history.length > 0 && (
            <button onClick={onClear} style={{
              padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444", cursor: "pointer",
            }}>Clear all</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: "16px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
        {history.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 40 }}>🕐</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No history yet. Start a conversation to see it here.</p>
          </div>
        ) : (
          history.map(session => (
            <div key={session.id} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 14,
              cursor: "pointer", transition: "border-color 0.15s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
              onClick={() => onRestore(session)}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                background: "var(--accent-dim)", border: "1px solid rgba(99,102,241,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>💬</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  {session.repoName && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                      background: "var(--accent-dim)", color: "#818cf8",
                      fontFamily: "monospace", letterSpacing: "0.04em",
                    }}>{session.repoName.split("_").slice(-1)[0]}</span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(session.startedAt)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{session.messages.filter(m => m.role === "user").length} messages</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {preview(session.messages)}
                </p>
              </div>

              <button onClick={e => { e.stopPropagation(); onDelete(session.id); }} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: 16, padding: "4px 6px", borderRadius: 6,
                flexShrink: 0,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                title="Delete"
              >✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
