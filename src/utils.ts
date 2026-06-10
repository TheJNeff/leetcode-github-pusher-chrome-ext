// utils.ts — pure functions shared between background.ts and preview.ts.
// No Chrome APIs here — importable in any context.

import type { SolutionData } from "./types";

// Builds the GitHub file path, e.g.:
//   golang/easy/two-sum/solution.go
export function buildFilePath(solution: SolutionData, filename: string): string {
  return [
    solution.language,
    solution.difficulty.toLowerCase(),
    solution.problemSlug,
    filename,
  ].join("/");
}

// Builds the commit message for a solution push.
export function buildCommitMessage(solution: SolutionData): string {
  return `Solve #${solution.problemNumber}: ${solution.problemTitle} (${solution.difficulty})`;
}

// Generates the README.md content committed alongside the solution file.
export function buildReadme(solution: SolutionData): string {

  const runtime =
    solution.runtimeValue && solution.runtimePercentile !== null
      ? `${solution.runtimeValue} (beats ${solution.runtimePercentile.toFixed(1)}% of submissions)`
      : "N/A";

  const memory =
    solution.memoryValue && solution.memoryPercentile !== null
      ? `${solution.memoryValue} (beats ${solution.memoryPercentile.toFixed(1)}% of submissions)`
      : "N/A";

  return `# ${solution.problemNumber}. ${solution.problemTitle} - ${solution.problemUrl}

## Difficulty: ${solution.difficulty}
## Language: ${solution.language}
## Solved: ${new Date(solution.submittedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}

## Performance

| Metric  | Result |
|---------|--------|
| Runtime | ${runtime} |
| Memory  | ${memory} |

`;
}
