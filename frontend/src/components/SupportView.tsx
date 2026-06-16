"use client";

function Card({ icon, title, desc, href, cta }: { icon: string; title: string; desc: string; href: string; cta: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "20px", cursor: "pointer", transition: "border-color 0.15s",
        display: "flex", gap: 16, alignItems: "flex-start",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: "var(--accent-dim)", border: "1px solid rgba(99,102,241,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{icon}</div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{desc}</p>
          <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{cta} →</span>
        </div>
      </div>
    </a>
  );
}

export default function SupportView() {
  return (
    <div style={{ flex: 1, background: "var(--bg-base)", overflowY: "auto", padding: "28px" }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Support</h2>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "var(--text-muted)" }}>Resources and help for the GitHub Repo Q&A Bot.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card icon="📖" title="Documentation" desc="Setup guide, API reference, and configuration options." href="https://github.com/kri1105/github-qa-bot#readme" cta="Read docs" />
        <Card icon="🐛" title="Report a Bug" desc="Found something broken? Open an issue on GitHub." href="https://github.com/kri1105/github-qa-bot/issues/new" cta="Open issue" />
        <Card icon="💡" title="Source Code" desc="Browse the full source code, submit PRs, or fork the project." href="https://github.com/kri1105/github-qa-bot" cta="View on GitHub" />
      </div>

      <div style={{ marginTop: 28, padding: "16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Quick Tips</p>
        {[
          "Paste any GitHub URL directly in the chat — the repo will be indexed automatically.",
          "Ask architecture questions like \"How does routing work?\" for high-level answers.",
          "Click a file in the file tree to pin it as context for your next question.",
          "Use specific function names in questions for more precise answers.",
        ].map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginTop: i > 0 ? 8 : 0 }}>
            <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>✦</span>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
