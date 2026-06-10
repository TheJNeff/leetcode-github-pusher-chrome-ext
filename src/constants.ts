// Maps LeetCode's internal language keys to a canonical name and file extension.
// Add new languages here; nothing else needs to change.
export const LANGUAGE_MAP: Record<string, { name: string; ext: string }> = {
  go: { name: "golang", ext: "go" },
  python3: { name: "python", ext: "py" },
  python: { name: "python", ext: "py" },
  javascript: { name: "javascript", ext: "js" },
  typescript: { name: "typescript", ext: "ts" },
  java: { name: "java", ext: "java" },
  cpp: { name: "cpp", ext: "cpp" },
  c: { name: "c", ext: "c" },
  rust: { name: "rust", ext: "rs" },
  kotlin: { name: "kotlin", ext: "kt" },
  swift: { name: "swift", ext: "swift" },
  ruby: { name: "ruby", ext: "rb" },
  scala: { name: "scala", ext: "scala" },
  csharp: { name: "csharp", ext: "cs" },
};
