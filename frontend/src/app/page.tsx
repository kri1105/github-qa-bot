"use client";

import { useState } from "react";
import Sidebar       from "@/components/Sidebar";
import RepoHome      from "@/components/RepoHome";
import FileTree      from "@/components/FileTree";
import ChatInterface from "@/components/ChatInterface";

type View = "repositories" | "chat" | "history";

export default function Home() {
  const [view, setView]             = useState<View>("repositories");
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  function selectRepo(col: string) {
    setActiveRepo(col);
    setActiveFile(null);
    setView("chat");
  }

  function newAnalysis() {
    setActiveRepo(null);
    setActiveFile(null);
    setView("repositories");
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
      <Sidebar
        view={view}
        onViewChange={setView}
        onNewAnalysis={newAnalysis}
        projectName={activeRepo ? activeRepo.replace(/_/g, "/").split("/").pop() : undefined}
      />

      {view === "repositories" || !activeRepo ? (
        /* ── Landing / repo picker ── */
        <RepoHome onRepoSelect={selectRepo} />
      ) : (
        /* ── Analysis view: FileTree + Chat ── */
        <div style={{ flex: 1, display: "flex", height: "100%", overflow: "hidden" }}>
          <FileTree
            collection={activeRepo}
            activeFile={activeFile}
            onFileClick={setActiveFile}
          />
          <ChatInterface
            activeRepo={activeRepo}
            activeFile={activeFile}
            onRepoChange={col => { setActiveRepo(col); setActiveFile(null); }}
          />
        </div>
      )}
    </div>
  );
}
