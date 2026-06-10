// preview.ts — full-page commit preview opened by the popup's Review button.
// Fetches the staged solution from background.ts, generates both file contents,
// and lets the user inspect them in full before deciding to push or discard.

import type { SolutionData } from "./types";
import { buildFilePath, buildReadme } from "./utils";

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function showPageMessage(msg: string) {
  document.getElementById("root")!.innerHTML =
    `<div class="page-message">${msg}</div>`;
}

function setLoading(loading: boolean) {
  const btn = document.getElementById("push-btn") as HTMLButtonElement;
  if (!btn) return;
  btn.disabled = loading;
  (document.getElementById("spinner") as HTMLElement).style.display = loading ? "block" : "none";
  (document.getElementById("push-label") as HTMLElement).textContent = loading ? "Pushing..." : "Push to GitHub";
}

function showStatus(msg: string, type: "success" | "error") {
  const el = document.getElementById("status")!;
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.style.display = "block";
}

// Calls the GitHub Markdown API to render markdown as HTML.
// Returns null on any failure — caller falls back to raw text.
async function fetchRenderedMarkdown(markdown: string): Promise<string | null> {
  try {
    const { githubToken } = await chrome.storage.local.get("githubToken");
    if (!githubToken) return null;

    const res = await fetch("https://api.github.com/markdown", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ text: markdown }),
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function render(solution: SolutionData) {
  const solutionFilename = `solution.${solution.fileExtension}`;
  const solutionPath = buildFilePath(solution, solutionFilename);
  const readmePath = buildFilePath(solution, "README.md");
  const readmeContent = buildReadme(solution);

  // Track which tab is active
  let activeTab: "solution" | "readme" = "solution";

  function getPathBar() {
    const path = activeTab === "solution" ? solutionPath : readmePath;
    const parts = path.split("/");
    const dir = parts.slice(0, -1).join("/") + "/";
    const file = parts[parts.length - 1];
    return `<span>${dir}</span>${file}`;
  }

  document.getElementById("root")!.innerHTML = `
    <!-- Top bar -->
    <div class="topbar">
      <div class="topbar-left">
        <div class="problem-title">#${solution.problemNumber}. ${solution.problemTitle}</div>
        <div class="badges">
          <span class="badge badge-${solution.difficulty.toLowerCase()}">${solution.difficulty}</span>
          <span class="badge badge-lang">${solution.language}</span>
        </div>
      </div>
    </div>

    <!-- File area -->
    <div class="file-area">
      <div class="tabs">
        <button class="tab active" id="tab-solution">${solutionFilename}</button>
        <button class="tab" id="tab-readme">README.md</button>
      </div>
      <div class="file-path-bar" id="path-bar">${getPathBar()}</div>
      <div class="file-content">
        <pre id="content-solution"></pre>
        <div id="content-readme" class="markdown-body" style="display:none"></div>
      </div>
    </div>

    <!-- Action bar -->
    <div class="action-bar">
      <div class="status-msg" id="status"></div>
      <button class="btn btn-secondary" id="discard-btn">Discard</button>
      <button class="btn btn-primary" id="push-btn">
        <span class="spinner" id="spinner"></span>
        <span id="push-label">Push to GitHub</span>
      </button>
    </div>
  `;

  // Solution tab: use textContent so user code is never interpreted as HTML
  (document.getElementById("content-solution") as HTMLElement).textContent = solution.code;

  // README tab: fetch rendered HTML from GitHub on first view, fall back to raw text
  let readmeRendered = false;

  async function showReadmeTab() {
    const readmeEl = document.getElementById("content-readme")!;
    if (!readmeRendered) {
      readmeEl.textContent = "Rendering…";
      const html = await fetchRenderedMarkdown(readmeContent);
      readmeEl.innerHTML = html ?? `<pre>${readmeContent}</pre>`;
      readmeRendered = true;
    }
  }

  function switchTab(tab: "solution" | "readme") {
    activeTab = tab;
    document.getElementById("content-solution")!.style.display = tab === "solution" ? "block" : "none";
    document.getElementById("content-readme")!.style.display = tab === "readme" ? "block" : "none";
    document.getElementById("tab-solution")!.className = `tab ${tab === "solution" ? "active" : ""}`;
    document.getElementById("tab-readme")!.className = `tab ${tab === "readme" ? "active" : ""}`;
    document.getElementById("path-bar")!.innerHTML = getPathBar();
    if (tab === "readme") showReadmeTab();
  }

  document.getElementById("tab-solution")!.addEventListener("click", () => switchTab("solution"));
  document.getElementById("tab-readme")!.addEventListener("click", () => switchTab("readme"));

  // Push
  document.getElementById("push-btn")!.addEventListener("click", async () => {
    setLoading(true);
    document.getElementById("status")!.style.display = "none";

    const res = await chrome.runtime.sendMessage({ type: "PUSH_TO_GITHUB", data: solution });
    setLoading(false);

    if (res.success) {
      showStatus("✓ Pushed to GitHub successfully!", "success");
      (document.getElementById("push-btn") as HTMLButtonElement).style.display = "none";
      (document.getElementById("discard-btn") as HTMLElement).textContent = "Close";
    } else {
      showStatus(`Error: ${res.error}`, "error");
    }
  });

  // Discard / Close
  document.getElementById("discard-btn")!.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "CLEAR_PENDING" });
    window.close();
  });
}

async function init() {
  showPageMessage("Loading...");

  const response = await chrome.runtime.sendMessage({ type: "GET_PENDING_SOLUTION" });

  if (!response.success || !response.data) {
    showPageMessage("No staged solution found. Go back to LeetCode and click Push to GitHub.");
    return;
  }

  render(response.data as SolutionData);
}

init();
