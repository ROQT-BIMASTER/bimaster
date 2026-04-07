import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PhylloConnectButton } from "@/components/marketing/social/PhylloConnectButton";
import { SocialAccountCard } from "@/components/marketing/social/SocialAccountCard";
import { SocialAccountPanel } from "@/components/marketing/social/SocialAccountPanel";
import { Share2 } from "lucide-react";

export default function SocialNetworksPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ["phyllo-accounts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("phyllo_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Redes Sociais</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie suas contas conectadas e acompanhe métricas
              </p>
            </div>
          </div>
          <PhylloConnectButton onSuccess={() => refetch()} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : !accounts?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Share2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Nenhuma conta conectada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte sua primeira rede social para começar
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <SocialAccountCard
                key={account.id}
                account={account}
                onClick={() => setSelectedAccountId(account.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedAccount && (
        <SocialAccountPanel
          account={selectedAccount}
          open={!!selectedAccountId}
          onOpenChange={(open) => !open && setSelectedAccountId(null)}
        />
      )}
    </DashboardLayout>
  );
}
