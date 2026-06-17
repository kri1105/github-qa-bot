"use client";

import { useState, useEffect, useRef } from "react";
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

  // Stable ID for the current conversation — survives tab switches
  const sessionIdRef = useRef<string | null>(null);

  const { history, upsertSession, deleteSession, clearHistory } = useHistory();

  // ── Auto-save after each completed AI response ──────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    // Only save when assistant has finished streaming (has content, not loading)
    if (last.role !== "assistant" || last.loading || !last.content) return;

    if (!sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID();
    }
    upsertSession(sessionIdRef.current, activeRepo, messages);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  function handleViewChange(newView: View) {
    setView(newView);
  }

  function selectRepo(col: string) {
    sessionIdRef.current = null; // new conversation
    setMessages([]);
    setActiveRepo(col);
    setActiveFile(null);
    setView("chat");
  }

  function newAnalysis() {
    sessionIdRef.current = null; // new conversation
    setMessages([]);
    setActiveRepo(null);
    setActiveFile(null);
    setView("repositories");
  }

  function restoreSession(session: ChatSession) {
    sessionIdRef.current = session.id; // continue updating this exact session
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
        onViewChange={handleViewChange}
        onNewAnalysis={newAnalysis}
        projectName={activeRepo ? activeRepo.replace(/_/g, "/").split("/").pop() : undefined}
      />

      {view === "history" && (
        <HistoryView
          history={history}
          onRestore={restoreSession}
          onDelete={deleteSession}
          onClear={clearHistory}
        />
      )}

      {view === "settings" && (
        <SettingsView onClearHistory={clearHistory} historyCount={history.length} />
      )}

      {view === "support" && (
        <SupportView />
      )}

      {(view === "repositories" || (view !== "history" && view !== "settings" && view !== "support" && !activeRepo)) && (
        <div style={{ flex: 1, display: view === "repositories" || !activeRepo ? "flex" : "none" }}>
          <RepoHome onRepoSelect={selectRepo} />
        </div>
      )}

      {/* Chat stays mounted — display:none keeps messages alive across tab switches */}
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
