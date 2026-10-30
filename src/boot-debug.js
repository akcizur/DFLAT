// Visible startup diagnostics for failures that otherwise leave a blank game screen.
(function bootDiagnostics() {
  function showBootError(message) {
    let panel = document.getElementById("boot-debug");
    if (!panel) {
      panel = document.createElement("pre");
      panel.id = "boot-debug";
      panel.style.cssText = "position:fixed;z-index:99999;inset:12px;overflow:auto;white-space:pre-wrap;background:#170b08;color:#ffb7a8;border:1px solid #b94a36;padding:16px;font:12px/1.5 monospace";
      document.body.appendChild(panel);
    }
    panel.textContent += (panel.textContent ? "\\n\\n" : "DEPOO BOOT DEBUG\\n") + message;
  }
  window.addEventListener("error", event => {
    showBootError("ERROR: " + (event.message || "Script failed") + (event.filename ? "\\n" + event.filename + ":" + event.lineno : ""));
  });
  window.addEventListener("unhandledrejection", event => {
    const reason = event.reason;
    showBootError("PROMISE REJECTION: " + (reason?.stack || reason?.message || String(reason)));
  });
})();
