// background.ts — Manifest V3 service worker (runs in the background, no DOM access).
// Responsibilities:
//   1. Hold the most recently staged solution in memory (pendingSolution).
//   2. Show/clear the extension badge when a solution is staged.
//   3. Handle all GitHub API calls (push solution file + README).
// This is the only file that talks to the GitHub API.
// content.ts feeds data in; popup.ts reads data out and triggers pushes.

import type { SolutionData, ExtensionSettings, MessageType, MessageResponse } from "./types";
import { buildFilePath, buildReadme } from "./utils";

// In-memory store for the staged solution. Cleared after a successful push
// or when the user discards. Lost on service worker restart (Chrome may kill
// the worker when idle), but that's acceptable — the user just clicks again.
let pendingSolution: SolutionData | null = null;

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse: (r: MessageResponse) => void) => {
  // Fired by content.ts when the user clicks "Push to GitHub" and a valid
  // accepted submission is found. Stores the solution and lights up the badge.
  if (message.type === "SOLUTION_CAPTURED") {
    pendingSolution = message.data;
    chrome.action.setBadgeText({ text: "*" });
    chrome.action.setBadgeBackgroundColor({ color: "#00b8a3" });
    sendResponse({ success: true });
    return true;
  }

  // Fired by popup.ts on open to check whether there's a staged solution to display.
  if (message.type === "GET_PENDING_SOLUTION") {
    sendResponse({ success: true, data: pendingSolution ?? undefined });
    return true;
  }

  // Fired by popup.ts when the user clicks Discard.
  if (message.type === "CLEAR_PENDING") {
    pendingSolution = null;
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ success: true });
    return true;
  }

  // Fired by popup.ts when the user confirms the push.
  // Runs the full GitHub upsert flow and responds with success/error.
  if (message.type === "PUSH_TO_GITHUB") {
    pushToGitHub(message.data, message.commitMessage)
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true; // keeps the message channel open for the async response
  }
});

// Reads GitHub settings from chrome.storage.local.
// Rejects if the token or repo hasn't been configured yet.
async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["githubToken", "githubRepo", "githubBranch"],
      (result) => {
        if (!result.githubToken || !result.githubRepo) {
          reject(new Error("GitHub settings not configured. Please open Options."));
          return;
        }
        resolve({
          githubToken: result.githubToken as string,
          githubRepo: result.githubRepo as string,
          githubBranch: (result.githubBranch as string) || "main",
        });
      }
    );
  });
}

// Thin wrapper around the GitHub Contents API.
// All GitHub requests go through here so auth headers are set consistently.
async function githubRequest(
  settings: ExtensionSettings,
  path: string,
  method: string,
  body?: object
): Promise<Response> {
  return fetch(`https://api.github.com/repos/${settings.githubRepo}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${settings.githubToken}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Commits multiple files to GitHub in a single atomic commit using the Git Data API.
async function pushToGitHub(solution: SolutionData, commitMessage: string): Promise<void> {
  const settings = await getSettings();

  const solutionPath = buildFilePath(solution, `solution.${solution.fileExtension}`);
  const readmePath = buildFilePath(solution, "README.md");

  // 1. Get the current commit SHA for the branch
  const refRes = await githubRequest(settings, `git/ref/heads/${settings.githubBranch}`, "GET");
  if (!refRes.ok) throw new Error(`Failed to get branch ref: ${refRes.status}`);
  const latestCommitSha = (await refRes.json()).object.sha;

  // 2. Get the base tree SHA from that commit
  const commitRes = await githubRequest(settings, `git/commits/${latestCommitSha}`, "GET");
  if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`);
  const baseTreeSha = (await commitRes.json()).tree.sha;

  // 3. Create a new tree with both files inline (GitHub creates the blobs)
  const treeRes = await githubRequest(settings, "git/trees", "POST", {
    base_tree: baseTreeSha,
    tree: [
      { path: solutionPath, mode: "100644", type: "blob", content: solution.code },
      { path: readmePath,   mode: "100644", type: "blob", content: buildReadme(solution) },
    ],
  });
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`);
  const newTreeSha = (await treeRes.json()).sha;

  // 4. Create the commit and advance the branch ref
  const newCommitRes = await githubRequest(settings, "git/commits", "POST", {
    message: commitMessage,
    tree: newTreeSha,
    parents: [latestCommitSha],
  });
  if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.status}`);
  const newCommitSha = (await newCommitRes.json()).sha;

  const updateRes = await githubRequest(settings, `git/refs/heads/${settings.githubBranch}`, "PATCH", {
    sha: newCommitSha,
  });
  if (!updateRes.ok) throw new Error(`Failed to update branch ref: ${updateRes.status}`);

  pendingSolution = null;
  chrome.action.setBadgeText({ text: "" });
}
