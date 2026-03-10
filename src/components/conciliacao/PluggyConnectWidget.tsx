import { useEffect, useRef } from "react";

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

// Load Pluggy Connect from CDN and open in a popup-like approach
export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
}: PluggyConnectWidgetProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !connectToken) return;
    initialized.current = true;

    console.log("[PluggyWidget] Initializing with token length:", connectToken.length);
    console.log("[PluggyWidget] Token preview:", connectToken.substring(0, 30) + "...");

    // Load Pluggy Connect SDK from CDN
    const script = document.createElement("script");
    script.src = "https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js";
    script.async = true;

    script.onload = () => {
      console.log("[PluggyWidget] CDN script loaded");
      const PluggyConnectClass = (window as any).PluggyConnect;
      
      if (!PluggyConnectClass) {
        console.error("[PluggyWidget] PluggyConnect not found on window after script load");
        onError?.({ message: "PluggyConnect SDK not loaded" });
        return;
      }

      try {
        const pluggyConnect = new PluggyConnectClass({
          connectToken,
          includeSandbox,
          onSuccess: (data: any) => {
            console.log("✅ Pluggy onSuccess", data);
            onSuccess(data);
          },
          onError: (error: any) => {
            console.error("❌ Pluggy onError:", error);
            onError?.(error);
          },
          onClose: () => {
            console.log("[PluggyWidget] onClose fired");
            onClose?.();
          },
          onOpen: () => {
            console.log("[PluggyWidget] onOpen fired - widget opened");
          },
          onEvent: (payload: any) => {
            console.log("[PluggyWidget] onEvent:", JSON.stringify(payload));
          },
        });

        console.log("[PluggyWidget] Calling init()...");
        pluggyConnect.init().then(() => {
          console.log("[PluggyWidget] init() resolved - widget rendered");
        }).catch((err: any) => {
          console.error("[PluggyWidget] init() failed:", err);
          onError?.(err);
        });
      } catch (err) {
        console.error("[PluggyWidget] Error creating PluggyConnect:", err);
        onError?.(err);
      }
    };

    script.onerror = (err) => {
      console.error("[PluggyWidget] Failed to load CDN script:", err);
      onError?.({ message: "Failed to load Pluggy Connect script" });
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      try {
        const existingScript = document.querySelector(
          'script[src*="cdn.pluggy.ai"]'
        );
        if (existingScript) existingScript.remove();
      } catch {}
      // Remove any pluggy modal elements
      document.querySelectorAll('[id*="pluggy"], [class*="pluggy"]').forEach(el => el.remove());
      initialized.current = false;
    };
  }, [connectToken]);

  return null; // SDK creates its own modal overlay
}
