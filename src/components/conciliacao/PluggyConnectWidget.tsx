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
  onOpen?: () => void;
}

const PLUGGY_SCRIPT_URL = "/pluggy-connect.js";
const INIT_TIMEOUT_MS = 15000;

export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
  onOpen,
}: PluggyConnectWidgetProps) {
  const initedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "open" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loadAndInit = async () => {
      try {
        // Load script if not already loaded
        if (!window.PluggyConnect) {
          console.log("📡 Loading Pluggy script...");
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = PLUGGY_SCRIPT_URL;
            script.async = true;
            script.onload = () => {
              console.log("✅ Pluggy script loaded");
              resolve();
            };
            script.onerror = () => reject(new Error("Falha ao carregar script do Pluggy"));
            document.head.appendChild(script);
          });
        }

        if (!mounted) return;

        if (!window.PluggyConnect) {
          throw new Error("PluggyConnect não disponível após carregar script");
        }

        console.log("🔌 Initializing Pluggy Connect widget...");

        // Set a timeout — if onOpen never fires, something is wrong
        timeoutId = setTimeout(() => {
          if (mounted && status === "loading") {
            console.error("❌ Pluggy widget timeout — widget did not open in time");
            setStatus("error");
            setErrorMsg("O widget do Pluggy não abriu. Pode ser um problema temporário. Tente novamente.");
            onError?.(new Error("Pluggy widget timeout"));
          }
        }, INIT_TIMEOUT_MS);

        const pluggy = new window.PluggyConnect({
          connectToken,
          includeSandbox,
          onSuccess: (data: any) => {
            console.log("✅ Pluggy onSuccess", data);
            if (mounted) setStatus("open");
            onSuccess(data);
          },
          onError: (error: any) => {
            console.error("❌ Pluggy onError:", error);
            if (mounted) {
              setStatus("error");
              setErrorMsg(error?.message || "Erro desconhecido no Pluggy");
            }
            onError?.(error);
          },
          onClose: () => {
            console.log("Pluggy closed");
            onClose?.();
          },
          onOpen: () => {
            console.log("✅ Pluggy widget opened!");
            clearTimeout(timeoutId);
            if (mounted) setStatus("open");
            onOpen?.();
          },
        });

        // init() returns a Promise — await it to catch render errors
        await pluggy.init();
        console.log("✅ Pluggy init() resolved");
      } catch (err: any) {
        console.error("❌ Pluggy init failed:", err);
        if (mounted) {
          setStatus("error");
          setErrorMsg(err?.message || "Falha ao inicializar Pluggy");
          onError?.(err);
        }
      }
    };

    loadAndInit();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [connectToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "error") {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center space-y-2">
        <p className="text-sm text-destructive font-medium">❌ {errorMsg}</p>
        <button
          className="text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => {
            initedRef.current = false;
            setStatus("loading");
            setErrorMsg("");
            // Force re-mount by toggling
            onClose?.();
          }}
        >
          Fechar e tentar novamente
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

  return <div id="pluggy-connect-container" />;
}
