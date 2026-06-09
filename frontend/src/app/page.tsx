import ChatBox from "@/components/ChatBox";

export default function Home() {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8f9ff", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{
        background: "white", borderBottom: "1px solid #f3f4f6",
        padding: "16px 24px", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>💬</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>GitHub Repo Q&amp;A</h1>
        </div>
      </header>

      {/* Chat area */}
      <div style={{ flex: 1, overflow: "hidden", width: "100%", display: "flex", flexDirection: "column" }}>
        <ChatBox />
      </div>
    </main>
  );
}
