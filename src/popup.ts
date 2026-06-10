// popup.ts — controls popup.html, the extension's quick summary UI.
// Responsibilities:
//   1. On open, fetch the staged solution from background.ts and show the summary.
//   2. Summary: problem name + runtime/memory stats + Discard / Review / Push buttons.
//   3. Review opens a full-page preview tab (preview.html) showing both files.
//   4. Push sends PUSH_TO_GITHUB to background.ts directly from the summary.

import type { SolutionData } from "./types";
import { buildCommitMessage } from "./utils";

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function fillStat(valId: string, pctId: string, val: string | null, pct: number | null) {
  const valEl = $(valId);
  valEl.textContent = val || "N/A";
  if (!val) valEl.classList.add("na"); else valEl.classList.remove("na");
  $(pctId).textContent = pct !== null ? `Beats ${pct.toFixed(1)}%` : "";
}

function showStatus(msg: string, type: "success" | "error") {
  const el = $("status");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.style.display = "block";
}

function setLoading(loading: boolean) {
  const btn = $("push-btn") as HTMLButtonElement;
  btn.disabled = loading;
  $("spinner").style.display = loading ? "block" : "none";
  $("push-label").textContent = loading ? "Pushing..." : "Push to GitHub";
}

async function init() {
  const response = await chrome.runtime.sendMessage({ type: "GET_PENDING_SOLUTION" });
  if (!response.success || !response.data) return;

  const solution: SolutionData = response.data;

  $("empty-state").style.display = "none";
  $("summary-state").style.display = "block";

  $("sum-title").textContent = `#${solution.problemNumber}. ${solution.problemTitle}`;
  fillStat("sum-runtime-val", "sum-runtime-pct", solution.runtimeValue, solution.runtimePercentile);
  fillStat("sum-memory-val", "sum-memory-pct", solution.memoryValue, solution.memoryPercentile);

  const msgInput = $("commit-msg") as HTMLTextAreaElement;
  msgInput.value = buildCommitMessage(solution);

  const { githubBranch } = await chrome.storage.local.get("githubBranch");
  const branch = githubBranch || "main";

  const updatePreview = () => {
    $("git-preview").textContent =
      `git commit -m "${msgInput.value}"\ngit push origin ${branch}`;
  };
  updatePreview();
  msgInput.addEventListener("input", updatePreview);

  // Opens the full-page preview tab so the user can see both files before pushing.
  $("review-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") });
  });

  $("push-btn").addEventListener("click", async () => {
    setLoading(true);
    $("status").style.display = "none";

    const res = await chrome.runtime.sendMessage({
      type: "PUSH_TO_GITHUB",
      data: solution,
      commitMessage: msgInput.value,
    });
    setLoading(false);

    if (res.success) {
      showStatus("✓ Pushed to GitHub successfully!", "success");
      ($("push-btn") as HTMLButtonElement).style.display = "none";
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
