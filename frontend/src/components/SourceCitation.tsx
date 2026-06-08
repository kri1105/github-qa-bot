interface Source {
  file_path: string;
  start_line: number;
  end_line: number;
}

interface SourceCitationProps {
  sources: Source[];
}

export default function SourceCitation({ sources }: SourceCitationProps) {
  if (!sources || sources.length === 0) return null;

  // Deduplicate by file_path
  const unique = sources.filter(
    (s, i, arr) => arr.findIndex((x) => x.file_path === s.file_path) === i
  );

  return (
    <div className="mt-2 pt-2 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 mb-1">Sources</p>
      <div className="flex flex-wrap gap-2">
        {unique.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50
                       text-blue-700 text-xs font-mono border border-blue-200"
            title={`Lines ${s.start_line}–${s.end_line}`}
          >
            <svg
              className="w-3 h-3 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
                   a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19
                   a2 2 0 01-2 2z"
              />
            </svg>
            {s.file_path}
            <span className="text-blue-400">
              :{s.start_line}–{s.end_line}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
