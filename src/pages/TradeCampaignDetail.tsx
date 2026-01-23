import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LayoutDashboard, TrendingUp, Package, Receipt, CheckCircle, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { CampaignDashboard } from "@/components/trade/campaigns/CampaignDashboard";
import { CampaignSellComparison } from "@/components/trade/campaigns/CampaignSellComparison";
import { CampaignProducts } from "@/components/trade/campaigns/CampaignProducts";
import { CampaignExpenses } from "@/components/trade/campaigns/CampaignExpenses";
import { CampaignValidation } from "@/components/trade/campaigns/CampaignValidation";
import { CampaignAuditLog } from "@/components/trade/campaigns/CampaignAuditLog";

interface Campaign {
  id: string;
  code: string;
  name: string;
  description: string | null;
  campaign_type: string;
  status: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  actual_cost: number | null;
  target_revenue: number | null;
  region: string | null;
  channel: string | null;
  customer_id: string | null;
  verba_prevista: number;
  verba_orcada: number;
  sell_in_anterior: number;
  sell_in_atual: number;
  sell_out_anterior: number;
  sell_out_atual: number;
  crescimento_percentual: number | null;
  roi_percentual: number | null;
  roi_valor: number | null;
  validation_status: string;
  validation_notes: string | null;
  responsible_user_id: string;
  budget?: { name: string; code: string } | null;
  customer?: { nome: string } | null;
  responsible?: { nome: string } | null;
}

export default function TradeCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ["trade-campaign-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaigns")
        .select(`
          *,
          budget:trade_budgets(name, code),
          responsible:profiles!trade_campaigns_responsible_user_id_fkey(nome)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as Campaign;
    },
    enabled: !!id,
  });

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sell_in: "Sell In",
      sell_out: "Sell Out",
      institucional: "Institucional",
      cooperada: "Cooperada",
      mdf: "MDF",
      midia: "Mídia",
      incentivo: "Incentivo",
      degustacao: "Degustação",
      bonificacao: "Bonificação",
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
      pending_approval: { label: "Pendente Aprovação", color: "bg-yellow-100 text-yellow-800" },
      approved: { label: "Aprovada", color: "bg-green-100 text-green-800" },
      active: { label: "Em Execução", color: "bg-blue-100 text-blue-800" },
      paused: { label: "Pausada", color: "bg-orange-100 text-orange-800" },
      completed: { label: "Encerrada", color: "bg-gray-100 text-gray-800" },
      cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800" },
    };
    return labels[status] || { label: status, color: "bg-muted text-muted-foreground" };
  };

  if (isLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !campaign) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar campanha</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            Voltar
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = getStatusLabel(campaign.status);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{campaign.name}</h1>
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {campaign.code} • {getCampaignTypeLabel(campaign.campaign_type)}
                {campaign.customer?.nome && ` • ${campaign.customer.nome}`}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="sell" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Sell In/Out</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Gastos</span>
            </TabsTrigger>
            {isAdminOrSupervisor && (
              <TabsTrigger value="validation" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Validação</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <CampaignDashboard campaign={campaign} />
          </TabsContent>

          <TabsContent value="sell" className="mt-6">
            <CampaignSellComparison campaignId={campaign.id} campaign={campaign} />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <CampaignProducts campaignId={campaign.id} />
          </TabsContent>

          <TabsContent value="expenses" className="mt-6">
            <CampaignExpenses campaignId={campaign.id} verbaOrcada={campaign.verba_orcada} />
          </TabsContent>

          {isAdminOrSupervisor && (
            <TabsContent value="validation" className="mt-6">
              <CampaignValidation campaignId={campaign.id} campaign={campaign} />
            </TabsContent>
          )}

          <TabsContent value="history" className="mt-6">
            <CampaignAuditLog campaignId={campaign.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
