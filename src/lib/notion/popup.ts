// src/lib/notion/popup.ts
// Opens the Notion OAuth flow in a popup and resolves when it closes or messages back.

export interface OpenOAuthPopupResult {
  outcome: "success" | "error" | "closed";
}

export function openNotionOAuthPopup(authorizeUrl: string): Promise<OpenOAuthPopupResult> {
  return new Promise((resolve) => {
    const w = 520;
    const h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      authorizeUrl,
      "notion-oauth",
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no`,
    );
    if (!popup) {
      resolve({ outcome: "error" });
      return;
    }
    let settled = false;
    const finish = (outcome: OpenOAuthPopupResult["outcome"]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
      clearTimeout(maxTimeout);
      try { if (!popup.closed) popup.close(); } catch { /* noop */ }
      resolve({ outcome });
    };
    const onMessage = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.type === "notion-oauth-success") finish("success");
      else if (ev.data.type === "notion-oauth-error") finish("error");
    };
    window.addEventListener("message", onMessage);
    const timer = window.setInterval(() => {
      if (popup.closed) finish("closed");
    }, 500);
    // Safety net: nunca deixar a UI travada — fecha em 5 min mesmo sem sinal.
    const maxTimeout = window.setTimeout(() => finish("closed"), 5 * 60 * 1000);
  });
}
