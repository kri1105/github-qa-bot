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

  useEffect(() => {
    const sessions = load();
    persist(sessions);
    setHistory(sessions);
  }, []);

  /**
   * Create or update a session by ID.
   * - First call with a new ID: creates a new session at the top of the list.
   * - Subsequent calls with the same ID: updates messages in place (no duplicate).
   */
  const upsertSession = useCallback((id: string, repoName: string | null, messages: Message[]) => {
    if (messages.length === 0) return;
    const now = Date.now();
    setHistory(prev => {
      const existing = prev.find(s => s.id === id);
      let updated: ChatSession[];
      if (existing) {
        // Update in place, keep original startedAt
        updated = prev.map(s =>
          s.id === id ? { ...s, messages, repoName, lastMessageAt: now } : s
        );
      } else {
        // New session — prepend
        const session: ChatSession = { id, repoName, messages, startedAt: now, lastMessageAt: now };
        updated = prune([session, ...prev]);
      }
      persist(updated);
      return updated;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(s => s.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { history, upsertSession, deleteSession, clearHistory };
}
