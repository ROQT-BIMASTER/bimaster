import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSuccess?: () => void;
}

declare global {
  interface Window {
    PhylloConnect?: {
      initialize: (config: Record<string, unknown>) => { open: () => void };
    };
  }
}

function loadPhylloScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PhylloConnect) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Phyllo SDK"));
    document.head.appendChild(script);
  });
}

export function PhylloConnectButton({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 2. Create Phyllo user
      const { data: userData, error: userError } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "create_user", name: user.email, external_id: user.id },
      });
      if (userError) throw userError;
      const phylloUserId = userData?.id || userData?.data?.id;
      if (!phylloUserId) throw new Error("Erro ao criar usuário Phyllo");

      // 3. Create SDK token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "create_sdk_token", user_id: phylloUserId },
      });
      if (tokenError) throw tokenError;
      const sdkToken = tokenData?.sdk_token || tokenData?.data?.sdk_token;
      if (!sdkToken) throw new Error("Erro ao gerar token SDK");

      // 4. Load SDK and open
      await loadPhylloScript();
      
      const config = {
        clientDisplayName: "BiMaster",
        environment: "production",
        userId: phylloUserId,
        token: sdkToken,
        workPlatformId: null, // allow all platforms
        onAccountConnected: (accountId: string, workPlatformId: string, userId: string) => {
          toast.success("Conta conectada com sucesso!");
          onSuccess?.();
        },
        onAccountDisconnected: (accountId: string, workPlatformId: string, userId: string) => {
          toast.info("Conta desconectada");
          onSuccess?.();
        },
        onTokenExpired: () => {
          toast.error("Sessão expirada, tente novamente");
        },
        onExit: () => {
          setLoading(false);
        },
      };

      const phylloConnect = window.PhylloConnect?.initialize(config);
      phylloConnect?.open();
    } catch (err: any) {
      console.error("Phyllo connect error:", err);
      toast.error(err.message || "Erro ao conectar rede social");
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
      Conectar Rede Social
    </Button>
  );
}
