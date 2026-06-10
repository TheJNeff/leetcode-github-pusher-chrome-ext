"use strict";
(() => {
  // src/utils.ts
  function buildFilePath(solution, filename) {
    return [
      solution.language,
      solution.difficulty.toLowerCase(),
      solution.problemSlug,
      filename
    ].join("/");
  }
  function buildReadme(solution) {
    const runtime = solution.runtimeValue && solution.runtimePercentile !== null ? `${solution.runtimeValue} (beats ${solution.runtimePercentile.toFixed(1)}% of submissions)` : "N/A";
    const memory = solution.memoryValue && solution.memoryPercentile !== null ? `${solution.memoryValue} (beats ${solution.memoryPercentile.toFixed(1)}% of submissions)` : "N/A";
    return `# ${solution.problemNumber}. ${solution.problemTitle} - ${solution.problemUrl}

## Difficulty: ${solution.difficulty}
## Language: ${solution.language}
## Solved: ${new Date(solution.submittedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })}

## Performance

| Metric  | Result |
|---------|--------|
| Runtime | ${runtime} |
| Memory  | ${memory} |

`;
  }

  // src/preview.ts
  function showPageMessage(msg) {
    document.getElementById("root").innerHTML = `<div class="page-message">${msg}</div>`;
  }
  function setLoading(loading) {
    const btn = document.getElementById("push-btn");
    if (!btn) return;
    btn.disabled = loading;
    document.getElementById("spinner").style.display = loading ? "block" : "none";
    document.getElementById("push-label").textContent = loading ? "Pushing..." : "Push to GitHub";
  }
  function showStatus(msg, type) {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = `status-msg ${type}`;
    el.style.display = "block";
  }
  async function fetchRenderedMarkdown(markdown) {
    try {
      const { githubToken } = await chrome.storage.local.get("githubToken");
      if (!githubToken) return null;
      const res = await fetch("https://api.github.com/markdown", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json"
        },
        body: JSON.stringify({ text: markdown })
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }
  function render(solution) {
    const solutionFilename = `solution.${solution.fileExtension}`;
    const solutionPath = buildFilePath(solution, solutionFilename);
    const readmePath = buildFilePath(solution, "README.md");
    const readmeContent = buildReadme(solution);
    let activeTab = "solution";
    function getPathBar() {
      const path = activeTab === "solution" ? solutionPath : readmePath;
      const parts = path.split("/");
      const dir = parts.slice(0, -1).join("/") + "/";
      const file = parts[parts.length - 1];
      return `<span>${dir}</span>${file}`;
    }
    document.getElementById("root").innerHTML = `
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
    document.getElementById("content-solution").textContent = solution.code;
    let readmeRendered = false;
    async function showReadmeTab() {
      const readmeEl = document.getElementById("content-readme");
      if (!readmeRendered) {
        readmeEl.textContent = "Rendering\u2026";
        const html = await fetchRenderedMarkdown(readmeContent);
        readmeEl.innerHTML = html ?? `<pre>${readmeContent}</pre>`;
        readmeRendered = true;
      }
    }
    function switchTab(tab) {
      activeTab = tab;
      document.getElementById("content-solution").style.display = tab === "solution" ? "block" : "none";
      document.getElementById("content-readme").style.display = tab === "readme" ? "block" : "none";
      document.getElementById("tab-solution").className = `tab ${tab === "solution" ? "active" : ""}`;
      document.getElementById("tab-readme").className = `tab ${tab === "readme" ? "active" : ""}`;
      document.getElementById("path-bar").innerHTML = getPathBar();
      if (tab === "readme") showReadmeTab();
    }
    document.getElementById("tab-solution").addEventListener("click", () => switchTab("solution"));
    document.getElementById("tab-readme").addEventListener("click", () => switchTab("readme"));
    document.getElementById("push-btn").addEventListener("click", async () => {
      setLoading(true);
      document.getElementById("status").style.display = "none";
      const res = await chrome.runtime.sendMessage({ type: "PUSH_TO_GITHUB", data: solution });
      setLoading(false);
      if (res.success) {
        showStatus("\u2713 Pushed to GitHub successfully!", "success");
        document.getElementById("push-btn").style.display = "none";
        document.getElementById("discard-btn").textContent = "Close";
      } else {
        showStatus(`Error: ${res.error}`, "error");
      }
    });
    document.getElementById("discard-btn").addEventListener("click", async () => {
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
    render(response.data);
  }
  init();
})();
