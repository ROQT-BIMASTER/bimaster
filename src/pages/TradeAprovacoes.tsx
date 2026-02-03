import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, FileText, AlertCircle, Target, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { AprovarLancamentoDialog } from "@/components/trade/AprovarLancamentoDialog";
import { AprovacaoCampanhaDialog } from "@/components/trade/campaigns/AprovacaoCampanhaDialog";
import { usePendingFinancialEntries, usePendingInvestments, usePendingCampaigns } from "@/hooks/useTradeData";
import { useQueryClient } from "@tanstack/react-query";
import { TourButton, TRADE_APROVACOES_TOUR_ID, tradeAprovacoesTourSteps } from "@/components/tour";

export default function TradeAprovacoes() {
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<"entry" | "investment">("entry");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Usar hooks otimizados com React Query
  const { data: entries = [], isLoading: entriesLoading } = usePendingFinancialEntries();
  const { data: investments = [], isLoading: investmentsLoading } = usePendingInvestments();
  const { data: campaigns = [], isLoading: campaignsLoading } = usePendingCampaigns();

  const loading = entriesLoading || investmentsLoading || campaignsLoading;

  useEffect(() => {
    // Aguarda o carregamento do role antes de verificar
    if (roleLoading) return;
    
    if (!isAdminOrSupervisor) {
      toast.error("Acesso negado. Apenas supervisores e administradores podem aprovar lançamentos.");
      navigate("/dashboard");
      return;
    }
  }, [isAdminOrSupervisor, roleLoading, navigate]);

  // Forçar refetch ao montar o componente para garantir dados frescos
  useEffect(() => {
    handleRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['trade-pending-entries'] });
    queryClient.invalidateQueries({ queryKey: ['trade-pending-investments'] });
    queryClient.invalidateQueries({ queryKey: ['trade-pending-campaigns'] });
  };

  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      budget_allocation: "Alocação de Verba",
      investment: "Investimento",
      expense: "Despesa",
      revenue: "Receita",
      adjustment: "Ajuste",
    };
    return labels[type] || type;
  };

  const handleApproveClick = (entry: any, type: "entry" | "investment") => {
    setSelectedEntry(entry);
    setSelectedType(type);
    setApprovalDialogOpen(true);
  };

  const handleCampaignClick = (campaign: any) => {
    setSelectedCampaign(campaign);
    setCampaignDialogOpen(true);
  };

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sell_in: "Sell-In",
      sell_out: "Sell-Out",
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

  // Calcular métricas com useMemo
  const { pendingCount, totalAmount, campaignsCount } = useMemo(() => ({
    pendingCount: entries.length + investments.length + campaigns.length,
    totalAmount: 
      entries.reduce((sum, entry: any) => sum + parseFloat(String(entry.amount || 0)), 0) +
      investments.reduce((sum, inv: any) => sum + parseFloat(String(inv.amount || 0)), 0) +
      campaigns.reduce((sum, c: any) => sum + parseFloat(String(c.estimated_cost || 0)), 0),
    campaignsCount: campaigns.length
  }), [entries, investments, campaigns]);

  // Mostra loading enquanto verifica permissões
  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-muted-foreground">Verificando permissões...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between" data-tour="aprovacoes-header">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/trade/financeiro">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Aprovação de Lançamentos</h1>
              <p className="text-muted-foreground mt-1">
                Revise e aprove os lançamentos financeiros pendentes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                handleRefetch();
                toast.success("Dados atualizados!");
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <TourButton 
              tourId={TRADE_APROVACOES_TOUR_ID} 
              tourSteps={tradeAprovacoesTourSteps} 
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3" data-tour="aprovacoes-kpis">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  R$ {totalAmount.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ação Necessária</p>
                <p className="text-xl font-semibold">
                  {pendingCount > 0 ? "Revisar agora" : "Tudo em dia"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card data-tour="aprovacoes-tabela">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando pendências...
            </div>
          ) : pendingCount === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
              <p className="text-lg font-semibold mb-2">Nenhuma pendência</p>
              <p className="text-sm">Todos os lançamentos, investimentos e campanhas foram processados</p>
            </div>
          ) : (
            <Tabs defaultValue="lancamentos" className="w-full">
              <div className="p-4 border-b">
                <TabsList>
                  <TabsTrigger value="lancamentos">
                    Lançamentos / Investimentos
                    {(entries.length + investments.length) > 0 && (
                      <Badge variant="secondary" className="ml-2">{entries.length + investments.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="campanhas">
                    <Target className="h-4 w-4 mr-1" />
                    Campanhas
                    {campaignsCount > 0 && (
                      <Badge variant="destructive" className="ml-2">{campaignsCount}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="lancamentos" className="mt-0">
                {(entries.length + investments.length) === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                    <p>Nenhum lançamento ou investimento pendente</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Conta/Categoria</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Lançamentos Financeiros */}
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {entry.created_by_profile?.nome || "N/A"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {entry.created_by_profile?.email || ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {getEntryTypeLabel(entry.entry_type)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="space-y-1">
                              <div className="truncate" title={entry.description}>
                                {entry.description}
                              </div>
                              {entry.budget && (
                                <div className="text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                                  <div className="font-semibold mb-0.5">
                                    {entry.budget.code} - {entry.budget.name}
                                  </div>
                                  <div className="flex gap-3">
                                    <span>
                                      💰 Disponível: R${" "}
                                      {(
                                        parseFloat(String(entry.budget.total_amount || 0)) -
                                        parseFloat(String(entry.budget.spent_amount || 0)) -
                                        parseFloat(String(entry.budget.reserved_amount || 0))
                                      ).toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                    <span>
                                      📊 Utilizado: R${" "}
                                      {parseFloat(String(entry.budget.spent_amount || 0)).toLocaleString(
                                        "pt-BR",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.account ? (
                              <span className="font-mono text-xs">
                                {entry.account.code}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.store ? (
                              <span className="text-xs">
                                {entry.store.code}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            R$ {parseFloat(String(entry.amount || 0)).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleApproveClick(entry, "entry")}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Revisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Investimentos */}
                      {investments.map((investment) => (
                        <TableRow key={investment.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(investment.investment_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {investment.created_by_profile?.nome || "N/A"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {investment.created_by_profile?.email || ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            <Badge variant="outline">Investimento PDV</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={investment.description}>
                              {investment.description}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="capitalize text-xs bg-muted px-2 py-1 rounded">
                              {investment.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {investment.store ? (
                              <span className="text-xs">
                                {investment.store.code}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            R$ {parseFloat(String(investment.amount || 0)).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleApproveClick(investment, "investment")}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Revisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="campanhas" className="mt-0">
                {campaignsCount === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                    <p>Nenhuma campanha pendente de aprovação</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Verba</TableHead>
                        <TableHead className="text-right">Custo Estimado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign: any) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-mono text-sm">
                            {campaign.code}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {campaign.created_by_profile?.nome || "N/A"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {campaign.created_by_profile?.email || ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCampaignTypeLabel(campaign.campaign_type)}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate font-medium" title={campaign.name}>
                              {campaign.name}
                            </div>
                            {campaign.description && (
                              <div className="truncate text-xs text-muted-foreground" title={campaign.description}>
                                {campaign.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(campaign.start_date), "dd/MM/yy")} - {format(new Date(campaign.end_date), "dd/MM/yy")}
                          </TableCell>
                          <TableCell>
                            {campaign.budget ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                {campaign.budget.code}
                              </span>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                Sem verba
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            R$ {parseFloat(String(campaign.estimated_cost || 0)).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleCampaignClick(campaign)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Revisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </div>

      {selectedEntry && (
        <AprovarLancamentoDialog
          open={approvalDialogOpen}
          onOpenChange={setApprovalDialogOpen}
          entry={selectedEntry}
          type={selectedType}
          onSuccess={handleRefetch}
        />
      )}

      {selectedCampaign && (
        <AprovacaoCampanhaDialog
          open={campaignDialogOpen}
          onOpenChange={setCampaignDialogOpen}
          campaign={selectedCampaign}
          onSuccess={handleRefetch}
        />
      )}
    </DashboardLayout>
  );
}
