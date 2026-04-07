import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AccountCard } from "./AccountCard";
import { AccountsManager } from "./AccountsManager";
import { RefreshCw, BarChart3, Users, TrendingUp, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  account_name?: string;
  status: 'active' | 'error' | 'syncing' | 'inactive';
  last_sync_at?: string;
  error_message?: string;
  region?: string;
  account_group?: string;
}

interface AccountMetrics {
  [accountId: string]: {
    followers: number;
    engagement: number;
    posts: number;
    reach: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

export const MultiAccountDashboard = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [metrics, setMetrics] = useState<AccountMetrics>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "aggregated">("cards");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

  const { data, error } = await supabase
    .from("social_media_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  setAccounts(data as SocialAccount[] || []);
      
      // Carregar métricas do histórico
      if (data && data.length > 0) {
        await loadMetricsHistory(data.map(acc => acc.id));
      }
    } catch (error: any) {
      toast.error(`Erro ao carregar contas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMetricsHistory = async (accountIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from("social_media_metrics_history")
        .select("*")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Agrupar métricas mais recentes por conta
      const latestMetrics: AccountMetrics = {};
      data?.forEach((metric) => {
        if (metric.account_id && !latestMetrics[metric.account_id]) {
          latestMetrics[metric.account_id] = {
            followers: metric.followers || 0,
            engagement: metric.engagement || 0,
            posts: metric.posts || 0,
            reach: metric.reach || 0,
            likes: metric.likes || 0,
            comments: metric.comments || 0,
            shares: metric.shares || 0,
          };
        }
      });

      setMetrics(latestMetrics);
    } catch (error: any) {
      console.error("Erro ao carregar métricas:", error);
    }
  };

  const syncAccount = async (account: SocialAccount) => {
    setSyncing(account.id);

    try {
      // Atualizar status para syncing
      await supabase
        .from("social_media_accounts")
        .update({ status: "syncing" })
        .eq("id", account.id);

      // Chamar edge function para sincronizar (token decriptado server-side)
      const { data, error } = await supabase.functions.invoke("social-media-metrics", {
        body: {
          accountId: account.id,
          saveToHistory: true,
        },
      });

      if (error) throw error;

      // Atualizar métricas locais
      setMetrics((prev) => ({
        ...prev,
        [account.id]: data,
      }));

      // Atualizar status para active
      await supabase
        .from("social_media_accounts")
        .update({
          status: "active",
          last_sync_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", account.id);

      toast.success(`Conta ${account.account_name || account.username} sincronizada!`);
      loadAccounts();
    } catch (error: any) {
      // Atualizar status para error
      await supabase
        .from("social_media_accounts")
        .update({
          status: "error",
          error_message: error.message,
        })
        .eq("id", account.id);

      toast.error(`Erro ao sincronizar: ${error.message}`);
      loadAccounts();
    } finally {
      setSyncing(null);
    }
  };

  const syncAllAccounts = async () => {
    const activeAccounts = accounts.filter((acc) => acc.status !== "inactive");
    
    for (const account of activeAccounts) {
      await syncAccount(account);
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm("Tem certeza que deseja remover esta conta?")) return;

    try {
      const { error } = await supabase
        .from("social_media_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;

      toast.success("Conta removida com sucesso");
      loadAccounts();
    } catch (error: any) {
      toast.error(`Erro ao remover conta: ${error.message}`);
    }
  };

  const filteredAccounts =
    selectedPlatform === "all"
      ? accounts
      : accounts.filter((acc) => acc.platform === selectedPlatform);

  const aggregatedMetrics = filteredAccounts.reduce(
    (acc, account) => {
      const accountMetrics = metrics[account.id];
      if (accountMetrics) {
        return {
          followers: acc.followers + accountMetrics.followers,
          engagement: acc.engagement + accountMetrics.engagement,
          posts: acc.posts + accountMetrics.posts,
          reach: acc.reach + accountMetrics.reach,
        };
      }
      return acc;
    },
    { followers: 0, engagement: 0, posts: 0, reach: 0 }
  );

  const platformCount = accounts.reduce((acc, account) => {
    acc[account.platform] = (acc[account.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando contas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gerenciamento de Contas</h2>
          <p className="text-sm text-muted-foreground">
            {accounts.length} {accounts.length === 1 ? "conta configurada" : "contas configuradas"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={syncAllAccounts} variant="outline" className="gap-2" disabled={!!syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar Todas
          </Button>
          <AccountsManager onAccountAdded={loadAccounts} />
        </div>
      </div>

      {accounts.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você ainda não possui contas configuradas. Clique em "Adicionar Conta" para começar.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas as plataformas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as plataformas</SelectItem>
                {Object.keys(platformCount).map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)} ({platformCount[platform]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="cards">Visualização Individual</TabsTrigger>
                <TabsTrigger value="aggregated">Métricas Agregadas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {viewMode === "aggregated" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Seguidores Totais</p>
                    <p className="text-2xl font-bold text-foreground">
                      {aggregatedMetrics.followers.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Engajamento Médio</p>
                    <p className="text-2xl font-bold text-foreground">
                      {(aggregatedMetrics.engagement / filteredAccounts.length || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Posts Totais</p>
                    <p className="text-2xl font-bold text-foreground">
                      {aggregatedMetrics.posts.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alcance Total</p>
                    <p className="text-2xl font-bold text-foreground">
                      {aggregatedMetrics.reach.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                metrics={metrics[account.id]}
                onSync={() => syncAccount(account)}
                onEdit={() => toast.info("Edição em desenvolvimento")}
                onDelete={() => deleteAccount(account.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
