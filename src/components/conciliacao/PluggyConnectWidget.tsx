import { useEffect, useState, useCallback } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (itemData: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

const PLUGGY_CONNECT_URL = "https://connect.pluggy.ai";

export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
}: PluggyConnectWidgetProps) {
  const [loading, setLoading] = useState(true);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Only accept messages from Pluggy
      if (event.origin !== PLUGGY_CONNECT_URL) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;

      console.log("📩 Pluggy postMessage:", data);

      if (data.event === "onSuccess" || data.type === "PLUGGY_CONNECT_SUCCESS") {
        onSuccess({ item: data.item || data });
      } else if (data.event === "onError" || data.type === "PLUGGY_CONNECT_ERROR") {
        onError?.(data.error || data);
      } else if (data.event === "onClose" || data.type === "PLUGGY_CONNECT_CLOSE") {
        onClose?.();
      }
    },
    [onSuccess, onError, onClose]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const iframeSrc = `${PLUGGY_CONNECT_URL}/?connect_token=${connectToken}${includeSandbox ? "&include_sandbox=true" : ""}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-md h-[600px] rounded-xl overflow-hidden bg-background shadow-xl border">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando conexão bancária...</span>
          </div>
        )}

        <iframe
          src={iframeSrc}
          title="Pluggy Connect"
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          allow="camera"
        />
      </div>
    </div>
  );
}
