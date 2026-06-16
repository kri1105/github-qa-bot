"use client";

export type View = "repositories" | "chat" | "history" | "settings" | "support";

interface SidebarProps {
  view: View;
  onViewChange: (v: View) => void;
  onNewAnalysis: () => void;
  projectName?: string;
}

const NavItem = ({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "9px 14px", borderRadius: 8,
    background: active ? "rgba(99,102,241,0.15)" : "transparent",
    border: "none", cursor: "pointer", textAlign: "left",
    color: active ? "#818cf8" : "#9ca3af",
    fontSize: 14, fontWeight: active ? 600 : 400,
    transition: "background 0.15s, color 0.15s",
  }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#1e1e1e"; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
  >
    <span style={{ opacity: 0.8, fontSize: 16 }}>{icon}</span>
    {label}
  </button>
);

export default function Sidebar({ view, onViewChange, onNewAnalysis, projectName }: SidebarProps) {
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100vh",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", fontFamily: "monospace" }}>
          &lt;/&gt;bot
        </div>
        {projectName && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {projectName} · main
          </div>
        )}
      </div>

      {/* New Analysis */}
      <div style={{ padding: "12px 12px 8px" }}>
        <button onClick={onNewAnalysis} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%", padding: "9px 0", borderRadius: 8,
          background: "var(--accent)", border: "none", cursor: "pointer",
          color: "white", fontSize: 13, fontWeight: 600,
          transition: "background 0.15s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--accent)"; }}
        >
          + New Analysis
        </button>
      </div>

      {/* Main Nav */}
      <nav style={{ flex: 1, padding: "4px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        <NavItem icon="💬" label="Current Chat"   active={view === "chat"}         onClick={() => onViewChange("chat")} />
        <NavItem icon="🕐" label="History"        active={view === "history"}      onClick={() => onViewChange("history")} />
        <NavItem icon="📦" label="Repositories"   active={view === "repositories"} onClick={() => onViewChange("repositories")} />
      </nav>

      {/* Bottom Nav */}
      <div style={{ padding: "8px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2 }}>
        <NavItem icon="⚙️" label="Settings" active={view === "settings"} onClick={() => onViewChange("settings")} />
        <NavItem icon="❓" label="Support"  active={view === "support"}  onClick={() => onViewChange("support")} />
      </div>
    </aside>
  );
}
