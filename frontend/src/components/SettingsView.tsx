"use client";

interface SettingsViewProps {
  onClearHistory: () => void;
  historyCount: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 16px", borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

export default function SettingsView({ onClearHistory, historyCount }: SettingsViewProps) {
  return (
    <div style={{ flex: 1, background: "var(--bg-base)", overflowY: "auto", padding: "28px" }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Settings</h2>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "var(--text-muted)" }}>
        Runtime config is managed via environment variables in <code style={{ background: "var(--bg-card)", padding: "1px 5px", borderRadius: 4 }}>backend/.env</code>.
      </p>

      {/* Model config */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Model</p>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <Row label="LLM (local dev)"   value="llama3.2:3b via Ollama" />
          <Row label="LLM (production)"  value="llama-3.1-8b-instant via Groq" />
          <Row label="Embeddings (local)" value="nomic-embed-text via Ollama" />
          <Row label="Embeddings (prod)"  value="all-MiniLM-L6-v2 (in-process)" />
        </div>
      </div>

      {/* Retrieval config */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Retrieval</p>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <Row label="Top-K chunks"       value="8" />
          <Row label="Distance threshold" value="0.85 cosine" />
          <Row label="Chunk size"         value="1500 chars" />
          <Row label="Chunk overlap"      value="200 chars" />
        </div>
      </div>

      {/* History */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>History</p>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <Row label="Retention"       value="15 days (auto-deleted)" />
          <Row label="Stored sessions" value={String(historyCount)} />
          <div style={{ padding: "12px 16px" }}>
            <button onClick={onClearHistory} style={{
              padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444", cursor: "pointer",
            }}>Clear all history</button>
          </div>
        </div>
      </div>
    </div>
  );
}
