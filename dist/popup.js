"use strict";
(() => {
  // src/utils.ts
  function buildCommitMessage(solution) {
    return `Solve #${solution.problemNumber}: ${solution.problemTitle} (${solution.difficulty})`;
  }

  // src/popup.ts
  function $(id) {
    return document.getElementById(id);
  }
  function fillStat(valId, pctId, val, pct) {
    const valEl = $(valId);
    valEl.textContent = val || "N/A";
    if (!val) valEl.classList.add("na");
    else valEl.classList.remove("na");
    $(pctId).textContent = pct !== null ? `Beats ${pct.toFixed(1)}%` : "";
  }
  function showStatus(msg, type) {
    const el = $("status");
    el.textContent = msg;
    el.className = `status-msg ${type}`;
    el.style.display = "block";
  }
  function setLoading(loading) {
    const btn = $("push-btn");
    btn.disabled = loading;
    $("spinner").style.display = loading ? "block" : "none";
    $("push-label").textContent = loading ? "Pushing..." : "Push to GitHub";
  }
  async function init() {
    const response = await chrome.runtime.sendMessage({ type: "GET_PENDING_SOLUTION" });
    if (!response.success || !response.data) return;
    const solution = response.data;
    $("empty-state").style.display = "none";
    $("summary-state").style.display = "block";
    $("sum-title").textContent = `#${solution.problemNumber}. ${solution.problemTitle}`;
    fillStat("sum-runtime-val", "sum-runtime-pct", solution.runtimeValue, solution.runtimePercentile);
    fillStat("sum-memory-val", "sum-memory-pct", solution.memoryValue, solution.memoryPercentile);
    const msgInput = $("commit-msg");
    msgInput.value = buildCommitMessage(solution);
    const { githubBranch } = await chrome.storage.local.get("githubBranch");
    const branch = githubBranch || "main";
    const updatePreview = () => {
      $("git-preview").textContent = `git commit -m "${msgInput.value}"
git push origin ${branch}`;
    };
    updatePreview();
    msgInput.addEventListener("input", updatePreview);
    $("review-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") });
    });
    $("push-btn").addEventListener("click", async () => {
      setLoading(true);
      $("status").style.display = "none";
      const res = await chrome.runtime.sendMessage({
        type: "PUSH_TO_GITHUB",
        data: solution,
        commitMessage: msgInput.value
      });
      setLoading(false);
      if (res.success) {
        showStatus("\u2713 Pushed to GitHub successfully!", "success");
        $("push-btn").style.display = "none";
        $("discard-btn").textContent = "Close";
      } else {
        showStatus(`Error: ${res.error}`, "error");
      }
    });
    $("discard-btn").addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "CLEAR_PENDING" });
      window.close();
    });
  }
  $("open-options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  init();
})();
