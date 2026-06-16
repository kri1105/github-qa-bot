"use client";

import { useState, useEffect } from "react";

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  isDir: boolean;
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const path of paths) {
    const parts = path.split("/");
    let nodes   = root;

    for (let i = 0; i < parts.length; i++) {
      const name    = parts[i];
      const isLast  = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");
      let existing  = nodes.find(n => n.name === name);

      if (!existing) {
        existing = { name, path: fullPath, isDir: !isLast, children: isLast ? undefined : [] };
        nodes.push(existing);
      }
      if (!isLast) nodes = existing.children!;
    }
  }

  return root;
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "🐍", ts: "🔷", tsx: "⚛️", js: "🟨", jsx: "⚛️",
    md: "📝", json: "📋", yaml: "⚙️", yml: "⚙️",
    go: "🐹", rs: "🦀", java: "☕", sh: "📜",
    ipynb: "📓", toml: "⚙️", txt: "📄",
  };
  return map[ext] ?? "📄";
}

function TreeNodeView({
  node, depth, activeFile, onFileClick,
}: {
  node: TreeNode; depth: number; activeFile: string | null;
  onFileClick: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isActive = !node.isDir && node.path === activeFile;

  if (node.isDir) {
    return (
      <div>
        <button onClick={() => setOpen(o => !o)} style={{
          display: "flex", alignItems: "center", gap: 6,
          width: "100%", padding: `5px 8px 5px ${12 + depth * 14}px`,
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--text-secondary)", fontSize: 12, textAlign: "left",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span style={{ fontSize: 10, color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▶</span>
          <span>📁</span>
          <span style={{ fontWeight: 500 }}>{node.name}</span>
        </button>
        {open && node.children?.map(child => (
          <TreeNodeView key={child.path} node={child} depth={depth + 1} activeFile={activeFile} onFileClick={onFileClick} />
        ))}
      </div>
    );
  }

  return (
    <button onClick={() => onFileClick(node.path)} style={{
      display: "flex", alignItems: "center", gap: 6,
      width: "100%", padding: `5px 8px 5px ${12 + depth * 14}px`,
      background: isActive ? "var(--accent-dim)" : "transparent",
      border: "none", cursor: "pointer",
      color: isActive ? "#818cf8" : "var(--text-secondary)",
      fontSize: 12, textAlign: "left",
    }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span>{fileIcon(node.name)}</span>
      <span style={{ fontFamily: "monospace", fontSize: 11 }}>{node.name}</span>
    </button>
  );
}

interface FileTreeProps {
  collection: string;
  activeFile: string | null;
  onFileClick: (path: string) => void;
}

export default function FileTree({ collection, activeFile, onFileClick }: FileTreeProps) {
  const [tree, setTree]     = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/files/${collection}`);
      const data = await res.json();
      setTree(buildTree(data.files ?? []));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [collection]);

  return (
    <div style={{
      width: 210, flexShrink: 0,
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 12px 8px",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Files
        </span>
        <button onClick={load} title="Refresh" style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-muted)", fontSize: 14, padding: 2,
        }}>↻</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {loading ? (
          <p style={{ padding: 12, fontSize: 12, color: "var(--text-muted)" }}>Loading…</p>
        ) : tree.length === 0 ? (
          <p style={{ padding: 12, fontSize: 12, color: "var(--text-muted)" }}>No files found</p>
        ) : (
          tree.map(node => (
            <TreeNodeView key={node.path} node={node} depth={0} activeFile={activeFile} onFileClick={onFileClick} />
          ))
        )}
      </div>
    </div>
  );
}
