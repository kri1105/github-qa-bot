import ChatBox from "@/components/ChatBox";

export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Repo Q&amp;A Bot</h1>
          <p className="text-xs text-gray-500">Powered by Ollama + ChromaDB</p>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden max-w-3xl w-full mx-auto w-full">
        <ChatBox />
      </div>
    </main>
  );
}
