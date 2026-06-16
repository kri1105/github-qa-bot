"use client";

import { useState }    from "react";
import Sidebar, { View } from "@/components/Sidebar";
import RepoHome          from "@/components/RepoHome";
import FileTree          from "@/components/FileTree";
import ChatInterface     from "@/components/ChatInterface";
import HistoryView       from "@/components/HistoryView";
import SettingsView      from "@/components/SettingsView";
import SupportView       from "@/components/SupportView";
import { useHistory }    from "@/hooks/useHistory";
import type { Message, ChatSession } from "@/types";

export default function Home() {
  const [view, setView]             = useState<View>("repositories");
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);

  const { history, saveSession, deleteSession, clearHistory } = useHistory();

  function selectRepo(col: string) {
    // Save current chat before switching to a new repo
    if (activeRepo !== col && messages.length > 0) {
      saveSession(activeRepo, messages);
      setMessages([]);
    }
    setActiveRepo(col);
    setActiveFile(null);
    setView("chat");
  }

  function newAnalysis() {
    if (messages.length > 0) {
      saveSession(activeRepo, messages);
    }
    setMessages([]);
    setActiveRepo(null);
    setActiveFile(null);
    setView("repositories");
  }

  function restoreSession(session: ChatSession) {
    if (messages.length > 0) {
      saveSession(activeRepo, messages);
    }
    setMessages(session.messages);
    setActiveRepo(session.repoName);
    setActiveFile(null);
    setView("chat");
  }

  const showChat = view === "chat" && activeRepo;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
      <Sidebar
        view={view}
        onViewChange={setView}
        onNewAnalysis={newAnalysis}
        projectName={activeRepo ? activeRepo.replace(/_/g, "/").split("/").pop() : undefined}
      />

      {/* ── History ── */}
      {view === "history" && (
        <HistoryView
          history={history}
          onRestore={restoreSession}
          onDelete={deleteSession}
          onClear={clearHistory}
        />
      )}

      {/* ── Settings ── */}
      {view === "settings" && (
        <SettingsView onClearHistory={clearHistory} historyCount={history.length} />
      )}

      {/* ── Support ── */}
      {view === "support" && (
        <SupportView />
      )}

      {/* ── Repositories / landing ── */}
      {(view === "repositories" || (view !== "history" && view !== "settings" && view !== "support" && !activeRepo)) && (
        <div style={{ flex: 1, display: view === "repositories" || !activeRepo ? "flex" : "none" }}>
          <RepoHome onRepoSelect={selectRepo} />
        </div>
      )}

      {/* ── Chat view — stays mounted to preserve messages across view switches ── */}
      {activeRepo && (
        <div style={{ flex: 1, display: showChat ? "flex" : "none", height: "100%", overflow: "hidden" }}>
          <FileTree
            collection={activeRepo}
            activeFile={activeFile}
            onFileClick={path => { setActiveFile(path); setView("chat"); }}
          />
          <ChatInterface
            activeRepo={activeRepo}
            activeFile={activeFile}
            onRepoChange={col => { setActiveRepo(col); setActiveFile(null); }}
            messages={messages}
            setMessages={setMessages}
          />
        </div>
      )}
    </div>
  );
}
