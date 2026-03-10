import { useEffect, useRef } from "react";

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
  popupRef?: React.MutableRefObject<Window | null>;
}

/**
 * This component doesn't open the popup itself (browser blocks non-user-gesture popups).
 * Instead, it attaches postMessage listeners to an already-opened popup window.
 * 
 * Usage:
 * 1. Parent opens popup via window.open() in click handler (user gesture)
 * 2. Parent passes the popup ref to this component
 * 3. This component listens for postMessage events and polls for close
 */
export function PluggyConnectWidget({
  connectToken,
  onSuccess,
  onError,
  onClose,
  popupRef,
}: PluggyConnectWidgetProps) {
  const closedHandled = useRef(false);

  useEffect(() => {
    if (!connectToken) return;
    closedHandled.current = false;

    const popup = popupRef?.current;
    if (!popup || popup.closed) {
      console.warn("[PluggyWidget] No popup reference available");
      return;
    }

    console.log("[PluggyWidget] Attaching listeners to popup");

    const handleMessage = (event: MessageEvent) => {
      // Accept messages from Pluggy
      if (event.origin !== "https://connect.pluggy.ai") return;

      console.log("[PluggyWidget] postMessage received:", event.data);

      if (event.data?.event === "onSuccess") {
        console.log("✅ Pluggy onSuccess", event.data.data);
        closedHandled.current = true;
        onSuccess(event.data.data);
        popup.close();
      }
      if (event.data?.event === "onError") {
        console.error("❌ Pluggy onError:", event.data.data);
        onError?.(event.data.data);
      }
      if (event.data?.event === "onClose") {
        console.log("[PluggyWidget] onClose via postMessage");
        closedHandled.current = true;
        onClose?.();
      }
    };

    window.addEventListener("message", handleMessage);

    // Poll to detect manual close
    const timer = setInterval(() => {
      if (popup.closed && !closedHandled.current) {
        console.log("[PluggyWidget] Popup closed manually");
        closedHandled.current = true;
        onClose?.();
        clearInterval(timer);
      }
    }, 500);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(timer);
      if (!popup.closed) popup.close();
    };
  }, [connectToken]);

  return null;
}
