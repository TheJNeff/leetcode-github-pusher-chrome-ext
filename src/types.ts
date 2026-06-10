// types.ts — shared TypeScript interfaces used across content, background, and popup.
// No runtime code here — types are erased at build time.

// Everything captured from a single accepted LeetCode submission.
// Assembled in content.ts and passed through background.ts to popup.ts.
export interface SolutionData {
  problemTitle: string;
  problemSlug: string;       // URL slug, e.g. "two-sum" — used as the folder name on GitHub
  problemNumber: number;
  difficulty: "Easy" | "Medium" | "Hard";
  language: string;          // canonical name, e.g. "golang"
  fileExtension: string;     // e.g. "go"
  code: string;              // full solution source scraped from the Monaco editor
  runtimePercentile: number | null;
  memoryPercentile: number | null;
  runtimeValue: string | null;   // e.g. "3 ms"
  memoryValue: string | null;    // e.g. "2.1 MB"
  problemUrl: string;
  submittedAt: string;       // ISO timestamp of when the button was clicked
}

// GitHub connection settings stored in chrome.storage.local via the options page.
export interface ExtensionSettings {
  githubToken: string;
  githubRepo: string;    // "username/repo" format
  githubBranch: string;  // default: "main"
}

// All message types sent between content.ts, popup.ts, and background.ts.
// background.ts switches on message.type to route each one.
export type MessageType =
  | { type: "SOLUTION_CAPTURED"; data: SolutionData }  // content → background: stage a solution
  | { type: "GET_PENDING_SOLUTION" }                    // popup → background: fetch staged solution
  | { type: "PUSH_TO_GITHUB"; data: SolutionData; commitMessage: string }  // popup → background: confirm and push
  | { type: "CLEAR_PENDING" };                          // popup → background: discard staged solution

export type MessageResponse =
  | { success: true; data?: SolutionData }
  | { success: false; error: string };
