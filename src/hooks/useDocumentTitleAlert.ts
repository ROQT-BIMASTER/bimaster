import { useEffect, useRef } from "react";

/**
 * Quando há menções não lidas E a aba está em background,
 * alterna o `document.title` entre o original e um alerta a cada 1.5s.
 * Restaura o título ao focar a aba ou quando a contagem zera.
 */
export function useDocumentTitleAlert(naoLidas: number) {
  const originalRef = useRef<string>(typeof document !== "undefined" ? document.title : "");

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Sempre que o usuário navega, atualiza o "original" enquanto a aba está visível
    if (document.visibilityState === "visible") {
      // Captura título atual sem o prefixo de alerta
      originalRef.current = document.title.replace(/^\(\d+\)\s+Você foi mencionado\s*[—-]\s*/, "");
    }

    if (naoLidas <= 0) {
      document.title = originalRef.current;
      return;
    }

    let interval: number | undefined;
    let toggle = false;

    const tick = () => {
      if (document.visibilityState === "hidden") {
        toggle = !toggle;
        document.title = toggle
          ? `(${naoLidas}) Você foi mencionado — ${originalRef.current}`
          : originalRef.current;
      } else {
        document.title = originalRef.current;
      }
    };

    const start = () => {
      if (interval) window.clearInterval(interval);
      tick();
      interval = window.setInterval(tick, 1500);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        document.title = originalRef.current;
        if (interval) {
          window.clearInterval(interval);
          interval = undefined;
        }
      } else {
        start();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "hidden") start();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (interval) window.clearInterval(interval);
      document.title = originalRef.current;
    };
  }, [naoLidas]);
}
