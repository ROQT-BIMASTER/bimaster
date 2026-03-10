import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    PluggyConnect: any;
  }
}

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (itemData: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

const PLUGGY_CDN_URL = "https://cdn.pluggy.ai/pluggy-connect/v2.12.0/pluggy-connect.js";

export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
  onOpen,
}: PluggyConnectWidgetProps) {
  const pluggyInstanceRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.PluggyConnect) {
        resolve();
        return;
      }

      const existing = document.querySelector(`script[src="${PLUGGY_CDN_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        return;
      }

      const script = document.createElement("script");
      script.src = PLUGGY_CDN_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Pluggy Connect script"));
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const initPluggy = async () => {
      try {
        await loadScript();
        
        if (!mounted || !window.PluggyConnect) {
          console.error("PluggyConnect not available after script load");
          onError?.({ message: "Widget não disponível" });
          return;
        }

        console.log("✅ Pluggy script loaded, initializing widget...");

        const pluggyConnect = new window.PluggyConnect({
          connectToken,
          includeSandbox,
          onSuccess: (data: any) => {
            console.log("✅ Pluggy onSuccess:", data);
            onSuccess(data);
          },
          onError: (error: any) => {
            console.error("❌ Pluggy onError:", error);
            onError?.(error);
          },
          onClose: () => {
            console.log("Pluggy widget closed");
            onClose?.();
          },
          onOpen: () => {
            console.log("✅ Pluggy widget opened");
            onOpen?.();
          },
        });

        pluggyInstanceRef.current = pluggyConnect;

        // Init the widget - render as modal
        pluggyConnect.init();
        console.log("✅ Pluggy widget init() called");
      } catch (err: any) {
        console.error("❌ Failed to initialize Pluggy:", err);
        onError?.(err);
      }
    };

    initPluggy();

    return () => {
      mounted = false;
    };
  }, [connectToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} id="pluggy-connect-container" />;
}
