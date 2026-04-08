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
      // Refresh session first to ensure valid token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        // Try refreshing
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          toast.error("Sessão expirada. Faça login novamente.");
          setLoading(false);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create Phyllo user
      const { data: userData, error: userError } = await supabase.functions.invoke("phyllo-create-user", {
        body: { name: user.email, external_id: user.id },
      });
      if (userError) {
        const errorBody = userData ? JSON.stringify(userData) : userError.message;
        throw new Error(`Erro ao criar usuário Phyllo: ${errorBody}`);
      }
      const phylloUserId = userData?.id;
      if (!phylloUserId) throw new Error("Erro ao criar usuário Phyllo");

      // Create SDK token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("phyllo-create-sdk-token", {
        body: { user_id: phylloUserId },
      });
      if (tokenError) throw tokenError;
      const sdkToken = tokenData?.sdk_token || tokenData?.data?.sdk_token;
      if (!sdkToken) throw new Error("Erro ao gerar token SDK");

      await loadPhylloScript();

      const config = {
        clientDisplayName: "BiMaster",
        environment: "staging",
        userId: phylloUserId,
        token: sdkToken,
        workPlatformId: null,
        onAccountConnected: async (accountId: string, workPlatformId: string, userId: string) => {
          try {
            // Fetch profile from Phyllo API
            const { data: profileData } = await supabase.functions.invoke("phyllo-proxy", {
              body: { action: "get_profile", account_id: accountId },
            });
            const profile = profileData?.data || profileData;

            // Save to phyllo_accounts (upsert by phyllo_account_id)
            const { error: insertError } = await supabase
              .from("phyllo_accounts")
              .upsert({
                user_id: user.id,
                phyllo_user_id: phylloUserId,
                phyllo_account_id: accountId,
                platform: profile?.work_platform?.name || profile?.platform_name || "unknown",
                username: profile?.username || profile?.platform_username || null,
                avatar_url: profile?.image_url || profile?.profile_pic_url || null,
                profile_url: profile?.url || profile?.profile_url || null,
                follower_count: profile?.follower_count ?? profile?.reputation?.follower_count ?? 0,
                following_count: profile?.following_count ?? profile?.reputation?.following_count ?? 0,
                status: "active",
                last_synced_at: new Date().toISOString(),
              }, { onConflict: "phyllo_account_id" });

            if (insertError) console.error("Error saving account:", insertError);
            toast.success("Conta conectada com sucesso!");
            onSuccess?.();
          } catch (err) {
            console.error("Error fetching profile:", err);
            toast.success("Conta conectada!");
            onSuccess?.();
          }
        },
        onAccountDisconnected: (accountId: string) => {
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
