interface Source {
  file_path: string;
  start_line: number;
  end_line: number;
}

export default function SourceCitation({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;

  const unique = sources.filter(
    (s, i, arr) => arr.findIndex((x) => x.file_path === s.file_path) === i
  );

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
      <p style={{ margin: "0 0 6px 0", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Sources
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {unique.map((s, i) => (
          <span
            key={i}
            title={`Lines ${s.start_line}–${s.end_line}`}
            style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: 20,
              background: "rgba(99,102,241,0.1)",
              color: "#6366f1",
              fontSize: 12,
              fontFamily: "monospace",
              border: "1px solid rgba(99,102,241,0.2)",
              whiteSpace: "nowrap",
            }}
          >
            📄 {s.file_path}:{s.start_line}–{s.end_line}
          </span>
        ))}
      </div>
    </div>
  );
}
