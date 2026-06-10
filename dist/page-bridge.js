"use strict";
(() => {
  // src/page-bridge.ts
  document.addEventListener("lcgp-request-code", () => {
    try {
      const editors = monaco.editor.getEditors();
      const editor = editors.length > 0 ? editors[0] : null;
      const code = editor?.getValue() ?? "";
      const language = editor?.getModel()?.getLanguageId() ?? "";
      document.dispatchEvent(new CustomEvent("lcgp-code", { detail: { code, language } }));
    } catch {
      document.dispatchEvent(new CustomEvent("lcgp-code", { detail: { code: "", language: "" } }));
    }
  });
})();
