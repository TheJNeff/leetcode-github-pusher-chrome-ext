// page-bridge.ts — runs in the MAIN world (page's JS context).
// Has access to page globals like `monaco` that content scripts cannot see.
// Listens for requests from content.ts and replies via CustomEvents.

declare const monaco: {
  editor: {
    getEditors(): {
      getValue(): string;
      getModel(): { getLanguageId(): string } | null;
    }[];
  };
};

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
