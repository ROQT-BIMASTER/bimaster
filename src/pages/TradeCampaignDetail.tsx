import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ClipboardEdit, Package, Receipt, CheckCircle, History, Loader2, Building2, AlertCircle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { CampaignLancamentosList } from "@/components/trade/campaigns/CampaignLancamentosList";

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
  valor_pedido?: number | null;
  tipo_brinde?: string | null;
  acoes_manuais?: string | null;
  unon_anterior?: number | null;
  unon_atual?: number | null;
  budget?: { name: string; code: string } | null;
  customer?: { nome: string } | null;
  responsible?: { nome: string } | null;
}

interface Lancamento {
  id: string;
  customer_id: string | null;
  cliente_nome: string;
  data_lancamento: string;
  status: string;
}

export default function TradeCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState("lancamento");
  const [selectedLancamentoId, setSelectedLancamentoId] = useState<string | null>(null);

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ["trade-campaign-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaigns")
        .select(`
          *,
          budget:trade_budgets(name, code)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // Fetch responsible user separately to avoid FK issues
      let responsibleName = null;
      if (data.responsible_user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", data.responsible_user_id)
          .maybeSingle();
        responsibleName = profile?.nome || null;
      }
      
      return {
        ...data,
        responsible: responsibleName ? { nome: responsibleName } : null,
      } as unknown as Campaign;
    },
    enabled: !!id,
  });

  // Fetch lancamentos for this campaign
  const { data: lancamentos = [] } = useQuery({
    queryKey: ["campaign-lancamentos-selector", id],
    queryFn: async () => {
      const { data: lancamentosData, error } = await supabase
        .from("trade_campaign_lancamentos")
        .select("id, customer_id, data_lancamento, status")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch customer names
      const customerIds = lancamentosData
        ?.map(l => l.customer_id)
        .filter(Boolean) as string[];
      
      let customersMap = new Map<string, string>();
      
      if (customerIds.length > 0) {
        const { data: prospects } = await supabase
          .from("prospects")
          .select("id, nome_empresa")
          .in("id", customerIds);
        
        customersMap = new Map(
          prospects?.map(p => [p.id, p.nome_empresa]) || []
        );
      }

      return lancamentosData?.map(l => ({
        ...l,
        cliente_nome: l.customer_id ? customersMap.get(l.customer_id) || "Cliente não encontrado" : "Sem cliente",
      })) as Lancamento[];
    },
    enabled: !!id,
  });

  const selectedLancamento = lancamentos.find(l => l.id === selectedLancamentoId);

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

  const handleLancamentoSelect = (lancamentoId: string) => {
    setSelectedLancamentoId(lancamentoId);
    // Automatically move to products tab when selecting
    if (activeTab === "lancamento") {
      setActiveTab("products");
    }
  };

  // Check if tabs other than "lancamento" should be disabled
  const isTabsDisabled = !selectedLancamentoId && activeTab !== "lancamento" && activeTab !== "history";

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

        {/* Lancamento Selector - shows when a lancamento is selected or when on other tabs */}
        {(selectedLancamentoId || (activeTab !== "lancamento" && lancamentos.length > 0)) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-medium">Cliente Selecionado:</span>
                </div>
                <Select
                  value={selectedLancamentoId || ""}
                  onValueChange={setSelectedLancamentoId}
                >
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Selecione um lançamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lancamentos.map((lancamento) => (
                      <SelectItem key={lancamento.id} value={lancamento.id}>
                        <div className="flex items-center gap-2">
                          <span>{lancamento.cliente_nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {lancamento.status === "approved" ? "Aprovado" : 
                             lancamento.status === "rejected" ? "Rejeitado" : "Pendente"}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLancamento && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedLancamentoId(null);
                      setActiveTab("lancamento");
                    }}
                  >
                    Limpar Seleção
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warning when no lancamento selected */}
        {!selectedLancamentoId && activeTab !== "lancamento" && activeTab !== "history" && activeTab !== "validation" && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <p>Selecione um lançamento na aba "Lançamento" para registrar informações do cliente.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="lancamento" className="gap-2">
              <ClipboardEdit className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamento</span>
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

          <TabsContent value="lancamento" className="mt-6">
            <CampaignLancamentosList 
              campaign={campaign} 
              onSelectLancamento={handleLancamentoSelect}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <CampaignProducts 
              campaignId={campaign.id}
              lancamentoId={selectedLancamentoId}
            />
          </TabsContent>

          <TabsContent value="expenses" className="mt-6">
            <CampaignExpenses 
              campaignId={campaign.id} 
              verbaOrcada={campaign.verba_orcada}
              lancamentoId={selectedLancamentoId}
            />
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
