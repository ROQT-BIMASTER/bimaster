/* global self, clients */
/**
 * Handler de Web Push importado pelo Service Worker do Workbox
 * (via `workbox.importScripts` em vite.config.ts).
 *
 * - `push`: mostra notificação com título/corpo/ícone vindos do servidor.
 *   Se já houver alguma janela do app focada na conversa de destino,
 *   suprime a notificação para evitar ruído duplicado (igual WhatsApp).
 * - `notificationclick`: foca janela existente ou abre nova na URL.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "Nova mensagem", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Nova mensagem";
  const url = data.url || "/dashboard/chat";
  const tag = data.tag || "msg";
  const urgent = !!data.urgent;

  const options = {
    body: data.body || "",
    icon:
      data.icon ||
      "https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png",
    badge:
      data.badge ||
      "https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png",
    tag,
    renotify: urgent,
    requireInteraction: urgent,
    vibrate: urgent ? [400, 100, 400, 100, 400] : [200, 100, 200],
    data: { url },
  };

  event.waitUntil(
    (async () => {
      // Se existe uma janela visível focada na mesma URL, não notifica.
      try {
        const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const focused = list.find((c) => c.focused && c.url.includes(url.split("?")[0]));
        if (focused && !urgent) return; // não duplica
      } catch (_e) {/* noop */}
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard/chat";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Tenta focar uma janela já aberta com a mesma URL base
      const same = all.find((c) => c.url.includes(url.split("?")[0]));
      if (same) {
        await same.focus();
        try { await same.navigate(url); } catch (_e) {/* noop em cross-origin */}
        return;
      }
      if (all[0]) {
        await all[0].focus();
        try { await all[0].navigate(url); } catch (_e) {/* noop */}
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
