import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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
}

const PLUGGY_SCRIPT_URL = "https://plg.unpluggy.ai/connect.js";

export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
}: PluggyConnectWidgetProps) {
  const [status, setStatus] = useState<"loading" | "open" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const connectRef = useRef<any>(null);
  const initedRef = useRef(false);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    let mounted = true;

    const loadAndOpen = async () => {
      try {
        // Load script if needed
        if (!window.PluggyConnect) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById("pluggy-connect-script");
            if (existing) {
              existing.remove();
            }
            const script = document.createElement("script");
            script.id = "pluggy-connect-script";
            script.src = PLUGGY_SCRIPT_URL;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Falha ao carregar script do Pluggy"));
            document.head.appendChild(script);
          });
        }

        if (!mounted || !window.PluggyConnect) {
          throw new Error("PluggyConnect não disponível");
        }

        console.log("🔌 Creating Pluggy Connect instance...");

        const connect = window.PluggyConnect.create({
          connectToken,
          includeSandbox,
          onSuccess: (itemData: any) => {
            console.log("✅ Pluggy onSuccess", itemData);
            if (mounted) setStatus("open");
            onSuccess(itemData);
          },
          onError: (error: any) => {
            console.error("❌ Pluggy onError:", error);
            if (mounted) {
              setStatus("error");
              setErrorMsg(error?.message || "Erro no Pluggy Connect");
            }
            onError?.(error);
          },
          onClose: () => {
            console.log("Pluggy closed");
            onClose?.();
          },
          onOpen: () => {
            console.log("✅ Pluggy widget opened");
            if (mounted) setStatus("open");
          },
        });

        connectRef.current = connect;
        connect.open();
        console.log("✅ Pluggy connect.open() called");
      } catch (err: any) {
        console.error("❌ Pluggy init failed:", err);
        if (mounted) {
          setStatus("error");
          setErrorMsg(err?.message || "Falha ao inicializar Pluggy");
          onError?.(err);
        }
      }
    };

    loadAndOpen();

    return () => {
      mounted = false;
      if (connectRef.current?.destroy) {
        connectRef.current.destroy();
      }
    };
  }, [connectToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "error") {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center space-y-2">
        <p className="text-sm text-destructive font-medium">❌ {errorMsg}</p>
        <button
          className="text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => onClose?.()}
        >
          Fechar
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 p-6 rounded-lg border bg-muted/30">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Abrindo conexão bancária...</span>
      </div>
    );
  }

  return null;
}
