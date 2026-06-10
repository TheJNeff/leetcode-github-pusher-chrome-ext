"use strict";
(() => {
  // src/constants.ts
  var LANGUAGE_MAP = {
    go: { name: "golang", ext: "go" },
    python3: { name: "python", ext: "py" },
    python: { name: "python", ext: "py" },
    javascript: { name: "javascript", ext: "js" },
    typescript: { name: "typescript", ext: "ts" },
    java: { name: "java", ext: "java" },
    cpp: { name: "cpp", ext: "cpp" },
    c: { name: "c", ext: "c" },
    rust: { name: "rust", ext: "rs" },
    kotlin: { name: "kotlin", ext: "kt" },
    swift: { name: "swift", ext: "swift" },
    ruby: { name: "ruby", ext: "rb" },
    scala: { name: "scala", ext: "scala" },
    csharp: { name: "csharp", ext: "cs" }
  };

  // src/content.ts
  function getProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : "";
  }
  async function fetchProblemMeta(slug) {
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
          variables: { titleSlug: slug }
        })
      });
      const json = await res.json();
      const q = json?.data?.question;
      if (!q) return null;
      return {
        title: q.title,
        number: parseInt(q.questionFrontendId),
        difficulty: q.difficulty,
        tags: q.topicTags.map((t) => t.slug)
      };
    } catch {
      return null;
    }
  }
  function scrapeAcceptedSubmission() {
    const resultEl = document.querySelector('[data-e2e-locator="submission-result"]');
    if (!resultEl || !resultEl.textContent?.toLowerCase().includes("accepted")) {
      return null;
    }
    let runtimeMs = null;
    let runtimePercentile = null;
    let memoryMb = null;
    let memoryPercentile = null;
    for (const el of document.querySelectorAll("*")) {
      const text = el.innerText || "";
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
  function getMonacoData() {
    return new Promise((resolve) => {
      document.addEventListener("lcgp-code", (e) => {
        resolve(e.detail || { code: "", language: "" });
      }, { once: true });
      document.dispatchEvent(new CustomEvent("lcgp-request-code"));
    });
  }
  async function handleCapture() {
    const btn = document.getElementById("lcgp-push-btn");
    const setBtn = (text, disabled, type = "normal") => {
      if (!btn) return;
      btn.disabled = disabled;
      btn.style.background = type === "error" ? "#ef4743" : "#00b8a3";
      btn.style.color = type === "error" ? "#fff" : "#000";
      const label = btn.querySelector("#lcgp-btn-label");
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
    setBtn("Staging\u2026", true);
    const minDelay = new Promise((res) => setTimeout(res, 800));
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
    const solution = {
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
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    chrome.runtime.sendMessage({ type: "SOLUTION_CAPTURED", data: solution });
    setBtn("Staged!", false);
    setTimeout(() => setBtn("Push to GitHub", false), 2500);
  }
  function injectButton() {
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
    btn.addEventListener("mouseenter", () => btn.style.opacity = "0.85");
    btn.addEventListener("mouseleave", () => btn.style.opacity = "1");
    btn.addEventListener("click", handleCapture);
    toolbar.appendChild(btn);
    return true;
  }
  function waitForToolbarAndInject() {
    if (injectButton()) return;
    const interval = setInterval(() => {
      if (injectButton()) clearInterval(interval);
    }, 200);
  }
  navigation.addEventListener("navigate", () => {
    document.getElementById("lcgp-push-btn")?.remove();
    waitForToolbarAndInject();
  });
  waitForToolbarAndInject();
})();
