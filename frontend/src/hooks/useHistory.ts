"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatSession, Message } from "@/types";

const STORAGE_KEY = "qabot_history";
const TTL_MS      = 15 * 24 * 60 * 60 * 1000; // 15 days

function prune(sessions: ChatSession[]): ChatSession[] {
  const cutoff = Date.now() - TTL_MS;
  return sessions.filter(s => s.lastMessageAt >= cutoff);
}

function load(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return prune(JSON.parse(raw) as ChatSession[]);
  } catch {
    return [];
  }
}

function persist(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

export function useHistory() {
  const [history, setHistory] = useState<ChatSession[]>([]);

  // Load + prune on mount
  useEffect(() => {
    const sessions = load();
    persist(sessions); // write back pruned list
    setHistory(sessions);
  }, []);

  /** Save the current messages as a completed session. No-op if messages is empty. */
  const saveSession = useCallback((repoName: string | null, messages: Message[]) => {
    if (messages.length === 0) return;
    const now     = Date.now();
    const session: ChatSession = {
      id:            crypto.randomUUID(),
      repoName,
      messages,
      startedAt:     now,
      lastMessageAt: now,
    };
    setHistory(prev => {
      const updated = prune([session, ...prev]);
      persist(updated);
      return updated;
    });
  }, []);

  /** Delete a single session by id. */
  const deleteSession = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(s => s.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  /** Wipe all history. */
  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { history, saveSession, deleteSession, clearHistory };
}
