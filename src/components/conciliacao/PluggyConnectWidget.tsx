import { useEffect, useRef } from "react";

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

const PLUGGY_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-proxy`;

export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
  onOpen,
}: PluggyConnectWidgetProps) {
  const initedRef = useRef(false);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    let mounted = true;

    const loadAndInit = async () => {
      try {
        // Load script via proxy if not already loaded
        if (!window.PluggyConnect) {
          console.log("📡 Loading Pluggy script via proxy...");
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = PLUGGY_PROXY_URL;
            script.async = true;
            script.onload = () => {
              console.log("✅ Pluggy script loaded");
              resolve();
            };
            script.onerror = () => reject(new Error("Failed to load Pluggy script via proxy"));
            document.head.appendChild(script);
          });
        }

        if (!mounted) return;

        if (!window.PluggyConnect) {
          throw new Error("PluggyConnect not available after script load");
        }

        console.log("🔌 Initializing Pluggy Connect widget...");
        const pluggy = new window.PluggyConnect({
          connectToken,
          includeSandbox,
          onSuccess: (data: any) => {
            console.log("✅ Pluggy onSuccess");
            onSuccess(data);
          },
          onError: (error: any) => {
            console.error("❌ Pluggy onError:", error);
            onError?.(error);
          },
          onClose: () => {
            console.log("Pluggy closed");
            onClose?.();
          },
          onOpen: () => {
            console.log("✅ Pluggy opened");
            onOpen?.();
          },
        });

        pluggy.init();
        console.log("✅ Pluggy init() called");
      } catch (err: any) {
        console.error("❌ Pluggy init failed:", err);
        if (mounted) onError?.(err);
      }
    };

    loadAndInit();

    return () => {
      mounted = false;
    };
  }, [connectToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="pluggy-connect-container" />;
}
