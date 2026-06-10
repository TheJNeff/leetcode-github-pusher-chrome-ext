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

  // src/background.ts
  var pendingSolution = null;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SOLUTION_CAPTURED") {
      pendingSolution = message.data;
      chrome.action.setBadgeText({ text: "*" });
      chrome.action.setBadgeBackgroundColor({ color: "#00b8a3" });
      sendResponse({ success: true });
      return true;
    }
    if (message.type === "GET_PENDING_SOLUTION") {
      sendResponse({ success: true, data: pendingSolution ?? void 0 });
      return true;
    }
    if (message.type === "CLEAR_PENDING") {
      pendingSolution = null;
      chrome.action.setBadgeText({ text: "" });
      sendResponse({ success: true });
      return true;
    }
    if (message.type === "PUSH_TO_GITHUB") {
      pushToGitHub(message.data, message.commitMessage).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
  async function getSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        ["githubToken", "githubRepo", "githubBranch"],
        (result) => {
          if (!result.githubToken || !result.githubRepo) {
            reject(new Error("GitHub settings not configured. Please open Options."));
            return;
          }
          resolve({
            githubToken: result.githubToken,
            githubRepo: result.githubRepo,
            githubBranch: result.githubBranch || "main"
          });
        }
      );
    });
  }
  async function githubRequest(settings, path, method, body) {
    return fetch(`https://api.github.com/repos/${settings.githubRepo}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${settings.githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: body ? JSON.stringify(body) : void 0
    });
  }
  async function pushToGitHub(solution, commitMessage) {
    const settings = await getSettings();
    const solutionPath = buildFilePath(solution, `solution.${solution.fileExtension}`);
    const readmePath = buildFilePath(solution, "README.md");
    const refRes = await githubRequest(settings, `git/ref/heads/${settings.githubBranch}`, "GET");
    if (!refRes.ok) throw new Error(`Failed to get branch ref: ${refRes.status}`);
    const latestCommitSha = (await refRes.json()).object.sha;
    const commitRes = await githubRequest(settings, `git/commits/${latestCommitSha}`, "GET");
    if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`);
    const baseTreeSha = (await commitRes.json()).tree.sha;
    const treeRes = await githubRequest(settings, "git/trees", "POST", {
      base_tree: baseTreeSha,
      tree: [
        { path: solutionPath, mode: "100644", type: "blob", content: solution.code },
        { path: readmePath, mode: "100644", type: "blob", content: buildReadme(solution) }
      ]
    });
    if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`);
    const newTreeSha = (await treeRes.json()).sha;
    const newCommitRes = await githubRequest(settings, "git/commits", "POST", {
      message: commitMessage,
      tree: newTreeSha,
      parents: [latestCommitSha]
    });
    if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.status}`);
    const newCommitSha = (await newCommitRes.json()).sha;
    const updateRes = await githubRequest(settings, `git/refs/heads/${settings.githubBranch}`, "PATCH", {
      sha: newCommitSha
    });
    if (!updateRes.ok) throw new Error(`Failed to update branch ref: ${updateRes.status}`);
    pendingSolution = null;
    chrome.action.setBadgeText({ text: "" });
  }
})();
