// content.ts — injected into every https://leetcode.com/problems/* page.
// Responsibilities:
//   1. Inject the "Push to GitHub" button into LeetCode's editor toolbar.
//   2. On button click, scrape the accepted submission + fetch problem metadata,
//      then send the result to background.ts for staging.
//   3. Show on-page success/error notifications.
// Nothing here touches GitHub — all GitHub API calls live in background.ts.

import type { SolutionData } from "./types";
import { LANGUAGE_MAP } from "./constants";

// Extracts the problem slug from the URL, e.g. "two-sum" from /problems/two-sum/.
// Returns "" if not on a problem page.
function getProblemSlug(): string {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : "";
}

// Calls LeetCode's GraphQL API to get the problem's title, number, difficulty,
// and topic tags. This is needed because the DOM only shows the slug.
// Returns null on any network or parsing error.
async function fetchProblemMeta(slug: string): Promise<{
  title: string;
  number: number;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
} | null> {
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query getProblem($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionFrontendId
              title
              difficulty
              topicTags { slug }
            }
          }
        `,
        variables: { titleSlug: slug },
      }),
    });
    const json = await res.json();
    const q = json?.data?.question;
    if (!q) return null;
    return {
      title: q.title,
      number: parseInt(q.questionFrontendId),
      difficulty: q.difficulty as "Easy" | "Medium" | "Hard",
      tags: q.topicTags.map((t: { slug: string }) => t.slug),
    };
  } catch {
    return null;
  }
}



// Scrapes the accepted submission from the current page DOM.
// Looks for the submission result banner, then reads runtime/memory stat text
// and the code from Monaco's rendered lines.
// Returns null if no accepted result is currently visible — this is the main
// guard that prevents capturing on non-accepted or pending submissions.
function scrapeAcceptedSubmission(): {
  runtimeMs: string | null;
  runtimePercentile: string | null;
  memoryMb: string | null;
  memoryPercentile: string | null;
} | null {
  const resultEl = document.querySelector('[data-e2e-locator="submission-result"]');
  if (!resultEl || !resultEl.textContent?.toLowerCase().includes("accepted")) {
    return null;
  }

  let runtimeMs: string | null = null;
  let runtimePercentile: string | null = null;
  let memoryMb: string | null = null;
  let memoryPercentile: string | null = null;

  for (const el of document.querySelectorAll("*")) {
    const text = (el as HTMLElement).innerText || "";
    const m = text.match(/Runtime\n([\d.]+)\n(\w+)\nBeats\n([\d.]+)%\nMemory\n([\d.]+)\n(\w+)\nBeats\n([\d.]+)%/);
    console.log(text);
    if (m) {
      runtimeMs = `${m[1]} ${m[2]}`;
      runtimePercentile = m[3];
      memoryMb = `${m[4]} ${m[5]}`;
      memoryPercentile = m[6];
      break;
    }
  }

  return { runtimeMs, runtimePercentile, memoryMb, memoryPercentile };
}

// Asks page-bridge.ts (running in MAIN world) to read the full Monaco editor
// value and return it via a CustomEvent. Avoids CSP issues with inline scripts.
function getMonacoData(): Promise<{ code: string; language: string }> {
  return new Promise((resolve) => {
    document.addEventListener("lcgp-code", (e) => {
      resolve((e as CustomEvent).detail || { code: "", language: "" });
    }, { once: true });
    document.dispatchEvent(new CustomEvent("lcgp-request-code"));
  });
}

// --- Capture handler ---

// Called when the user clicks "Push to GitHub" in the toolbar.
// Validates that there's an accepted submission, scrapes + enriches the data,
// then sends it to background.ts via SOLUTION_CAPTURED.
// The background stores it; the popup is where the user reviews and confirms.
async function handleCapture() {
  const btn = document.getElementById("lcgp-push-btn") as HTMLButtonElement | null;

  const setBtn = (text: string, disabled: boolean, type: "normal" | "error" = "normal") => {
    if (!btn) return;
    btn.disabled = disabled;
    btn.style.background = type === "error" ? "#ef4743" : "#00b8a3";
    btn.style.color = type === "error" ? "#fff" : "#000";
    const label = btn.querySelector("#lcgp-btn-label") as HTMLElement | null;
    if (!label) return;
    label.style.opacity = "0";
    setTimeout(() => {
      label.textContent = text;
      label.style.opacity = "1";
    }, 150);
  };

  const setError = async () => {
    setBtn("Error (Did you submit an accepted solution?)", false, "error");
    setTimeout(() => setBtn("Push to GitHub", false), 2500);
  };

  setBtn("Staging…", true);
  const minDelay = new Promise(res => setTimeout(res, 800));

  const slug = getProblemSlug();
  if (!slug) {
    await minDelay;
    setError();
    return;
  }

  const submission = scrapeAcceptedSubmission();
  if (!submission) {
    await minDelay;
    setError();
    return;
  }

  const [meta, monacoData] = await Promise.all([fetchProblemMeta(slug), getMonacoData(), minDelay]);
  if (!meta) {
    setError();
    return;
  }

  const langInfo = LANGUAGE_MAP[monacoData.language] || { name: monacoData.language || "unknown", ext: "txt" };

  const solution: SolutionData = {
    problemTitle: meta.title,
    problemSlug: slug,
    problemNumber: meta.number,
    difficulty: meta.difficulty,
    language: langInfo.name,
    fileExtension: langInfo.ext,
    code: monacoData.code,
    runtimePercentile: submission.runtimePercentile ? parseFloat(submission.runtimePercentile) : null,
    memoryPercentile: submission.memoryPercentile ? parseFloat(submission.memoryPercentile) : null,
    runtimeValue: submission.runtimeMs,
    memoryValue: submission.memoryMb,
    problemUrl: `https://leetcode.com/problems/${slug}/`,
    submittedAt: new Date().toISOString(),
  };

  chrome.runtime.sendMessage({ type: "SOLUTION_CAPTURED", data: solution });
  setBtn("Staged!", false);
  setTimeout(() => setBtn("Push to GitHub", false), 2500);
}

// --- Button injection ---

// Appends the "Push to GitHub" button to LeetCode's editor toolbar (#ide-top-btns).
// Bails silently if the toolbar isn't in the DOM yet — the navObserver retries
// automatically on every DOM mutation until it succeeds.
function injectButton(): boolean {
  if (document.getElementById("lcgp-push-btn")) return true;

  const toolbar = document.getElementById("ide-top-btns");
  if (!toolbar) return false;

  const btn = document.createElement("button");
  btn.id = "lcgp-push-btn";
  btn.innerHTML = `<span id="lcgp-btn-label" style="transition: opacity 0.15s">Push to GitHub</span>`;
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: #00b8a3;
    color: #000;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'Inter', -apple-system, sans-serif;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s;
  `;
  btn.addEventListener("mouseenter", () => (btn.style.opacity = "0.85"));
  btn.addEventListener("mouseleave", () => (btn.style.opacity = "1"));
  btn.addEventListener("click", handleCapture);

  toolbar.appendChild(btn);
  return true;
}

// Waits for #ide-top-btns to appear in the DOM, then injects the button.
// Uses a MutationObserver that disconnects itself as soon as it succeeds —
// so it only runs during the brief render window after navigation, not forever.
function waitForToolbarAndInject() {
  if (injectButton()) return;
  const interval = setInterval(() => {
    if (injectButton()) clearInterval(interval);
  }, 200);
}

// injectButton now returns true/false so waitForToolbarAndInject knows when to stop.
// (The original function bails early if the button already exists or toolbar isn't found.)

// Use the Navigation API (Chrome 102+) to detect SPA route changes.
// This fires exactly once per navigation instead of on every DOM mutation.
navigation.addEventListener("navigate", () => {
  document.getElementById("lcgp-push-btn")?.remove();
  waitForToolbarAndInject();
});

waitForToolbarAndInject();
