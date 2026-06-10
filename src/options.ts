function $(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

// Load saved settings
chrome.storage.local.get(["githubToken", "githubRepo", "githubBranch"], (result) => {
  if (result.githubToken) $("github-token").value = result.githubToken;
  if (result.githubRepo) $("github-repo").value = result.githubRepo;
  $("github-branch").value = result.githubBranch || "main";
});

// Save settings
document.getElementById("save-btn")!.addEventListener("click", async () => {
  const token = $("github-token").value.trim();
  const repo = $("github-repo").value.trim();
  const branch = $("github-branch").value.trim() || "main";
  const statusEl = document.getElementById("save-status")!;

  if (!token || !repo) {
    statusEl.textContent = "Token and repository are required.";
    statusEl.className = "error";
    statusEl.style.display = "inline";
    return;
  }

  if (!repo.includes("/")) {
    statusEl.textContent = "Repository must be in the format username/repo.";
    statusEl.className = "error";
    statusEl.style.display = "inline";
    return;
  }

  // Verify token works by hitting the GitHub API
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (res.status === 401) throw new Error("Invalid token — authentication failed.");
    if (res.status === 404) throw new Error("Repository not found. Check the name and token permissions.");
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

    chrome.storage.local.set({ githubToken: token, githubRepo: repo, githubBranch: branch }, () => {
      statusEl.textContent = "✓ Settings saved and verified!";
      statusEl.className = "success";
      statusEl.style.display = "inline";
      setTimeout(() => (statusEl.style.display = "none"), 3000);
    });
  } catch (err) {
    statusEl.textContent = (err as Error).message;
    statusEl.className = "error";
    statusEl.style.display = "inline";
  }
});
