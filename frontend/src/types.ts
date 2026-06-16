export interface Source {
  file_path: string;
  start_line: number;
  end_line: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  loading?: boolean;
}

export interface ChatSession {
  id: string;
  repoName: string | null;
  messages: Message[];
  startedAt: number;    // ms since epoch
  lastMessageAt: number;
}
