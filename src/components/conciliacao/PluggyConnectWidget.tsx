import { useEffect } from "react";
import { PluggyConnect } from "pluggy-connect-sdk";

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
}: PluggyConnectWidgetProps) {
  useEffect(() => {
    const pluggyConnect = new PluggyConnect({
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
        console.log("Pluggy closed");
        onClose?.();
      },
    });

    pluggyConnect.init();

    return () => {
      try {
        pluggyConnect.destroy();
      } catch {}
    };
  }, [connectToken]);

  return null;
}
