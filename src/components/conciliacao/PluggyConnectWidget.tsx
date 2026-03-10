import { useEffect, useRef } from "react";

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

export function PluggyConnectWidget({
  connectToken,
  onSuccess,
  onError,
  onClose,
}: PluggyConnectWidgetProps) {
  const closedHandled = useRef(false);

  useEffect(() => {
    if (!connectToken) return;
    closedHandled.current = false;

    console.log("[PluggyWidget] Opening popup with token length:", connectToken.length);

    const url = `https://connect.pluggy.ai/?connect_token=${connectToken}`;
    const popup = window.open(
      url,
      "pluggy_connect",
      "width=450,height=700,left=200,top=100,scrollbars=yes"
    );

    if (!popup) {
      console.error("[PluggyWidget] Popup blocked by browser");
      onError?.({ message: "Popup bloqueado pelo navegador. Permita popups para este site." });
      return;
    }

    const handleMessage = (event: MessageEvent) => {
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

    // Detect manual close of popup
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
